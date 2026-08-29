import { supabase } from './supabaseClient'
import { ensureUUID } from './scheduleService'

export interface SelectedVideoItem {
  id: string          // e.g. "bab_1_video_1"
  title: string       // e.g. "Bab 1: Video 1 (Bunpou A)"
  jilid: 1 | 2
  bab: number
  videoNum: number
}

export interface DailyMissionBaseline {
  videoReplays?: Record<string, number> // videoId -> replay count at mission creation
  kotobaCount?: number                  // total kotoba submissions at mission creation
  quizCount?: number                    // total passed quizzes at mission creation
}

export interface DailyMissionData {
  date: string                       // YYYY-MM-DD
  selectedVideos: SelectedVideoItem[] // User selected videos
  targetReplayCount: number          // selectedVideos.length * 3
  targetQuizCount: number            // e.g. 1
  targetKotobaCount: number          // e.g. 1
  baseline?: DailyMissionBaseline    // snapshot of user progress when mission was created
  isCompleted?: boolean
}

export interface MissionProgress {
  actualReplays: number
  targetReplays: number
  videoCompleted: boolean
  videoProgressMap?: Record<string, number> // videoId -> incremental replays since mission creation
  
  actualQuizzes: number
  targetQuizzes: number
  quizCompleted: boolean

  actualKotoba: number
  targetKotoba: number
  kotobaCompleted: boolean

  overallPct: number
  isFullyCompleted: boolean
}

export function getTodayDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

export function getDailyMission(userId: string, targetDate?: string): DailyMissionData | null {
  const dateStr = targetDate || getTodayDateString()
  const raw = localStorage.getItem(`kaiwa_daily_mission_${userId}_${dateStr}`) || 
              (dateStr === getTodayDateString() ? localStorage.getItem(`kaiwa_daily_mission_${userId}`) : null)
  
  if (!raw) return null
  try {
    const parsed: DailyMissionData = JSON.parse(raw)
    if (parsed.date === dateStr) return parsed
    return null
  } catch {
    return null
  }
}

export async function fetchDailyMission(userId: string, targetDate: string): Promise<DailyMissionData | null> {
  if (!userId) return null

  // 1. Try DB first for ground truth across devices
  try {
    const { data, error } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('student_id', userId)
      .eq('date', targetDate)
      .maybeSingle()

    if (!error && data) {
      const mission: DailyMissionData = {
        date: data.date,
        selectedVideos: data.selected_videos || [],
        targetReplayCount: typeof data.target_replay_count === 'number' ? data.target_replay_count : (data.selected_videos?.length ? data.selected_videos.length * 3 : 0),
        targetQuizCount: typeof data.target_quiz_count === 'number' ? data.target_quiz_count : 0,
        targetKotobaCount: typeof data.target_kotoba_count === 'number' ? data.target_kotoba_count : 0,
        baseline: data.baseline_snapshot || undefined,
      }
      localStorage.setItem(`kaiwa_daily_mission_${userId}_${targetDate}`, JSON.stringify(mission))
      if (targetDate === getTodayDateString()) {
        localStorage.setItem(`kaiwa_daily_mission_${userId}`, JSON.stringify(mission))
      }
      return mission
    }
  } catch (e) {
    console.warn('DB fetch error, falling back to local storage:', e)
  }

  // 2. Fallback to local storage if DB is unreachable or empty
  return getDailyMission(userId, targetDate)
}

export async function fetchAllUserMissions(userId: string): Promise<Map<string, DailyMissionData>> {
  const missionMap = new Map<string, DailyMissionData>()
  if (!userId) return missionMap

  // 1. Load DB missions first (Source of Truth)
  try {
    const { data, error } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('student_id', userId)

    if (!error && data && data.length > 0) {
      data.forEach((row: any) => {
        const mission: DailyMissionData = {
          date: row.date,
          selectedVideos: row.selected_videos || [],
          targetReplayCount: typeof row.target_replay_count === 'number' ? row.target_replay_count : (row.selected_videos?.length ? row.selected_videos.length * 3 : 0),
          targetQuizCount: typeof row.target_quiz_count === 'number' ? row.target_quiz_count : 0,
          targetKotobaCount: typeof row.target_kotoba_count === 'number' ? row.target_kotoba_count : 0,
          baseline: row.baseline_snapshot || undefined,
        }
        missionMap.set(row.date, mission)
        localStorage.setItem(`kaiwa_daily_mission_${userId}_${row.date}`, JSON.stringify(mission))
      })
    }
  } catch (e) {
    console.warn('Fetch all DB missions warning:', e)
  }

  // 2. Load local storage as backup for offline dates not present in DB
  try {
    const prefix = `kaiwa_daily_mission_${userId}_`
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const dateStr = key.replace(prefix, '')
        if (!missionMap.has(dateStr)) {
          const raw = localStorage.getItem(key)
          if (raw) {
            const parsed: DailyMissionData = JSON.parse(raw)
            if (parsed.date) missionMap.set(parsed.date, parsed)
          }
        }
      }
    }
  } catch (e) {
    // Ignore local storage error
  }

  return missionMap
}

/**
 * Capture current user progress as baseline snapshot so new daily mission starts from 0 relative progress
 */
export async function captureCurrentProgressSnapshot(
  userId: string,
  selectedVideos: SelectedVideoItem[]
): Promise<DailyMissionBaseline> {
  const baseline: DailyMissionBaseline = {
    videoReplays: {},
    kotobaCount: 0,
    quizCount: 0,
  }
  if (!userId) return baseline

  try {
    const [{ data: pData }, { data: kData }, { data: qData }] = await Promise.all([
      supabase.from('lesson_progress').select('lesson_id, is_completed, replay_count').eq('student_id', userId),
      supabase.from('user_kotoba_submissions').select('id').eq('user_id', userId),
      supabase.from('quiz_attempts').select('id, passed').eq('student_id', userId).eq('passed', true),
    ])

    // Merge with Local Storage progress
    const localProgKey = `kaiwa_lesson_progress_${userId}`
    const globalProgKey = `kaiwa_lesson_progress_active_global`
    const savedProgRaw = localStorage.getItem(localProgKey) || localStorage.getItem(globalProgKey)
    let progressData: any[] = pData || []
    if (savedProgRaw) {
      try {
        const parsedArr: [string, { is_completed: boolean; replay_count: number }][] = JSON.parse(savedProgRaw)
        const progMap = new Map<string, { is_completed: boolean; replay_count: number }>()
        progressData.forEach(p => progMap.set(p.lesson_id, { is_completed: p.is_completed, replay_count: p.replay_count || 0 }))
        parsedArr.forEach(([lId, val]) => {
          const existing = progMap.get(lId)
          progMap.set(lId, {
            is_completed: val.is_completed || existing?.is_completed || false,
            replay_count: Math.max(val.replay_count || 0, existing?.replay_count || 0),
          })
        })
        progressData = Array.from(progMap.entries()).map(([lId, val]) => ({
          lesson_id: lId,
          is_completed: val.is_completed,
          replay_count: val.replay_count,
        }))
      } catch {}
    }

    // Video baseline per selected video
    selectedVideos.forEach(v => {
      const patterns = [
        v.id.toLowerCase(),
        `bab_${v.bab}_video_${v.videoNum}`.toLowerCase(),
        `bab_${v.bab}_item_${v.videoNum}`.toLowerCase(),
        `lesson_bab_${v.bab}_${v.videoNum}`.toLowerCase(),
      ]
      let currentCount = 0
      progressData.forEach((p: any) => {
        const lessonIdLower = (p.lesson_id || '').toLowerCase()
        if (patterns.some(pat => lessonIdLower.includes(pat))) {
          const count = p.replay_count && p.replay_count > 0 ? p.replay_count : (p.is_completed ? 1 : 0)
          currentCount += count
        }
      })
      baseline.videoReplays![v.id] = currentCount
    })

    // Kotoba baseline
    const localKotobaKey = `kaiwa_user_kotoba_${userId}`
    const globalKotobaKey = `kaiwa_user_kotoba_active_global`
    const savedKotobaRaw = localStorage.getItem(localKotobaKey) || localStorage.getItem(globalKotobaKey)
    let kotobaLen = kData ? kData.length : 0
    if (savedKotobaRaw) {
      try {
        const parsedKotoba: any[] = JSON.parse(savedKotobaRaw)
        if (parsedKotoba.length > kotobaLen) kotobaLen = parsedKotoba.length
      } catch {}
    }
    baseline.kotobaCount = kotobaLen

    // Quiz baseline
    let quizLen = qData ? qData.length : 0
    let quizFromLessons = 0
    progressData.forEach((p: any) => {
      if ((p.lesson_id?.includes('quiz') || p.lesson_id?.includes('item_4')) && p.is_completed) {
        quizFromLessons++
      }
    })
    baseline.quizCount = Math.max(quizLen, quizFromLessons)
  } catch (e) {
    console.warn('Error taking daily mission baseline snapshot:', e)
  }

  return baseline
}

export async function saveDailyMission(
  userId: string,
  data: Omit<DailyMissionData, 'date'>,
  targetDate?: string
): Promise<DailyMissionData> {
  const dateStr = targetDate || getTodayDateString()

  // Capture baseline snapshot if not already provided
  const baselineSnapshot = data.baseline || (await captureCurrentProgressSnapshot(userId, data.selectedVideos))

  const mission: DailyMissionData = {
    ...data,
    date: dateStr,
    targetReplayCount: data.selectedVideos.length * 3,
    baseline: baselineSnapshot,
  }

  if (!userId) {
    throw new Error('ID pengguna tidak valid. Silakan login kembali.')
  }
  
  // 1. Save to Supabase DB for persistent database storage across devices
  const customId = `${userId}_${dateStr}`
  const { error } = await supabase.from('daily_missions').upsert({
    id: customId,
    student_id: userId,
    date: dateStr,
    selected_videos: mission.selectedVideos,
    target_replay_count: mission.targetReplayCount,
    target_quiz_count: mission.targetQuizCount,
    target_kotoba_count: mission.targetKotobaCount,
    baseline_snapshot: mission.baseline || {},
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,date' })

  if (error) {
    console.error('Supabase saveDailyMission error:', error)
    throw new Error(`Gagal menyimpan ke database: ${error.message || 'Error pada Supabase DB'}`)
  }

  // 2. Sync LocalStorage cache after successful DB write
  localStorage.setItem(`kaiwa_daily_mission_${userId}_${dateStr}`, JSON.stringify(mission))
  if (dateStr === getTodayDateString()) {
    localStorage.setItem(`kaiwa_daily_mission_${userId}`, JSON.stringify(mission))
  }
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DAILY_MISSION_UPDATE_EVENT, { detail: mission }))
  }

  return mission
}

export const DAILY_MISSION_UPDATE_EVENT = 'kaiwa_daily_mission_updated'

export function subscribeToDailyMissionRealtime(onUpdate: () => void) {
  if (typeof window === 'undefined') return () => {}

  const channel = supabase
    .channel('public_daily_missions_realtime_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_missions' }, () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(DAILY_MISSION_UPDATE_EVENT))
      }
      onUpdate()
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function isNoPlanMission(mission: DailyMissionData | null | undefined): boolean {
  if (!mission) return false
  const hasVideos = (mission.selectedVideos?.length || 0) > 0 && (mission.targetReplayCount || 0) > 0
  const hasQuiz = (mission.targetQuizCount || 0) > 0
  const hasKotoba = (mission.targetKotobaCount || 0) > 0
  return !hasVideos && !hasQuiz && !hasKotoba
}

export function calculateStreakFromDates(streakDatesSet: Set<string>, todayStr: string = getTodayDateString()): number {
  let streak = 0
  const formatDateParts = (y: number, m: number, d: number) => {
    const monthStr = String(m + 1).padStart(2, '0')
    const dayStr = String(d).padStart(2, '0')
    return `${y}-${monthStr}-${dayStr}`
  }

  const parts = todayStr.split('-').map(Number)
  const y = parts[0] || new Date().getFullYear()
  const m = (parts[1] || (new Date().getMonth() + 1)) - 1
  const d = parts[2] || new Date().getDate()

  const todayFormatted = formatDateParts(y, m, d)
  const hasToday = streakDatesSet.has(todayFormatted)

  const yesterdayDateObj = new Date(y, m, d - 1)
  const yesterdayFormatted = formatDateParts(yesterdayDateObj.getFullYear(), yesterdayDateObj.getMonth(), yesterdayDateObj.getDate())
  const hasYesterday = streakDatesSet.has(yesterdayFormatted)

  if (!hasToday && !hasYesterday) {
    return 0
  }

  let curr = hasToday ? new Date(y, m, d) : new Date(y, m, d - 1)

  while (true) {
    const dStr = formatDateParts(curr.getFullYear(), curr.getMonth(), curr.getDate())
    if (streakDatesSet.has(dStr)) {
      streak++
      curr.setDate(curr.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

export async function calculateMissionProgress(
  userId: string,
  mission: DailyMissionData,
  preFetched?: { progressData: any[]; kotobaSubmissions: any[] }
): Promise<MissionProgress> {
  const dateStr = mission.date || getTodayDateString()

  let progressData: any[] = preFetched?.progressData || []
  let kotobaSubmissions: any[] = preFetched?.kotobaSubmissions || []
  let totalRawReplays = 0
  let totalRawQuizzes = 0
  let totalRawKotoba  = 0

  if (!preFetched) {
    // Fetch lesson progress, quiz attempts & kotoba submissions from Supabase if not pre-fetched
    try {
      const [{ data: pData }, { data: kData }, { data: qData }] = await Promise.all([
        supabase
          .from('lesson_progress')
          .select('lesson_id, is_completed, replay_count, last_watched_at')
          .eq('student_id', userId),
        supabase
          .from('user_kotoba_submissions')
          .select('id')
          .eq('user_id', userId),
        supabase
          .from('quiz_attempts')
          .select('id, passed')
          .eq('student_id', userId)
          .eq('passed', true),
      ])
      progressData = pData || []
      kotobaSubmissions = kData || []
      if (qData && qData.length > 0) {
        totalRawQuizzes = Math.max(totalRawQuizzes, qData.length)
      }
    } catch {}
  }

  // Merge with Local Storage backup
  const localProgKey = `kaiwa_lesson_progress_${userId}`
  const globalProgKey = `kaiwa_lesson_progress_active_global`
  const savedProgRaw = localStorage.getItem(localProgKey) || localStorage.getItem(globalProgKey)
  if (savedProgRaw) {
    try {
      const parsedArr: [string, { is_completed: boolean; replay_count: number }][] = JSON.parse(savedProgRaw)
      const progMap = new Map<string, { is_completed: boolean; replay_count: number }>()
      progressData.forEach(p => progMap.set(p.lesson_id, { is_completed: p.is_completed, replay_count: p.replay_count || 0 }))
      parsedArr.forEach(([lId, val]) => {
        const existing = progMap.get(lId)
        progMap.set(lId, {
          is_completed: val.is_completed || existing?.is_completed || false,
          replay_count: Math.max(val.replay_count || 0, existing?.replay_count || 0),
        })
      })
      progressData = Array.from(progMap.entries()).map(([lId, val]) => ({
        lesson_id: lId,
        is_completed: val.is_completed,
        replay_count: val.replay_count,
      }))
    } catch {}
  }

  const localKotobaKey = `kaiwa_user_kotoba_${userId}`
  const globalKotobaKey = `kaiwa_user_kotoba_active_global`
  const savedKotobaRaw = localStorage.getItem(localKotobaKey) || localStorage.getItem(globalKotobaKey)
  if (savedKotobaRaw) {
    try {
      const parsedKotoba: any[] = JSON.parse(savedKotobaRaw)
      if (parsedKotoba.length > kotobaSubmissions.length) {
        kotobaSubmissions = parsedKotoba
      }
    } catch {}
  }

  totalRawKotoba = kotobaSubmissions ? kotobaSubmissions.length : 0

  // Calculate per-video progress
  const videoProgressMap: Record<string, number> = {}
  let actualReplays = 0

  if (mission.selectedVideos && mission.selectedVideos.length > 0) {
    mission.selectedVideos.forEach(v => {
      const patterns = [
        v.id.toLowerCase(),
        `bab_${v.bab}_video_${v.videoNum}`.toLowerCase(),
        `bab_${v.bab}_item_${v.videoNum}`.toLowerCase(),
        `lesson_bab_${v.bab}_${v.videoNum}`.toLowerCase(),
      ]

      let currentRawCount = 0
      if (progressData) {
        progressData.forEach((p: any) => {
          const idLower = (p.lesson_id || '').toLowerCase()
          if (patterns.some(pat => idLower.includes(pat))) {
            const count = p.replay_count && p.replay_count > 0 ? p.replay_count : (p.is_completed ? 1 : 0)
            currentRawCount += count
          }
        })
      }

      // Baseline count for this specific video when mission was created
      const baselineForVideo = mission.baseline?.videoReplays?.[v.id] || 0
      // Incremental replays made since mission creation
      const effectiveCount = Math.max(0, currentRawCount - baselineForVideo)
      videoProgressMap[v.id] = effectiveCount
      actualReplays += effectiveCount
    })
  } else {
    // If no videos selected, calculate general video replays
    if (progressData) {
      progressData.forEach((p: any) => {
        if (p.lesson_id?.includes('video_') || p.lesson_id?.includes('item_1') || p.lesson_id?.includes('item_2') || p.lesson_id?.includes('item_3')) {
          const count = p.replay_count && p.replay_count > 0 ? p.replay_count : (p.is_completed ? 1 : 0)
          totalRawReplays += count
        }
      })
    }
    actualReplays = totalRawReplays
  }

  // Quizzes progress
  let rawQuizzesFromLesson = 0
  if (progressData) {
    progressData.forEach((p: any) => {
      if ((p.lesson_id?.includes('quiz') || p.lesson_id?.includes('item_4')) && p.is_completed) {
        rawQuizzesFromLesson++
      }
    })
  }
  const totalQuizDone = Math.max(totalRawQuizzes, rawQuizzesFromLesson)
  const quizBaseline = mission.baseline?.quizCount || 0
  const actualQuizzes = Math.max(0, totalQuizDone - quizBaseline)

  // Kotoba progress
  let rawKotobaFromLesson = 0
  if (progressData) {
    progressData.forEach((p: any) => {
      if ((p.lesson_id?.includes('kotoba') || p.lesson_id?.includes('item_5')) && p.is_completed) {
        rawKotobaFromLesson++
      }
    })
  }
  const totalKotobaDone = Math.max(totalRawKotoba, rawKotobaFromLesson)
  const kotobaBaseline = mission.baseline?.kotobaCount || 0
  const actualKotoba = Math.max(0, totalKotobaDone - kotobaBaseline)

  // Determine active planned targets & Rest Day / Freeze status
  const isNoPlan = isNoPlanMission(mission)
  const hasVideos = (mission.selectedVideos && mission.selectedVideos.length > 0 && mission.targetReplayCount > 0)
  const hasQuiz   = (mission.targetQuizCount || 0) > 0
  const hasKotoba = (mission.targetKotobaCount || 0) > 0
  const hasAnyTarget = hasVideos || hasQuiz || hasKotoba

  const videoCompleted  = !hasVideos || actualReplays >= mission.targetReplayCount
  const quizCompleted   = !hasQuiz || actualQuizzes >= mission.targetQuizCount
  const kotobaCompleted = !hasKotoba || actualKotoba >= mission.targetKotobaCount

  const videoPct  = !hasVideos ? 100 : Math.min(100, (actualReplays / mission.targetReplayCount) * 100)
  const quizPct   = !hasQuiz ? 100 : Math.min(100, (actualQuizzes / mission.targetQuizCount) * 100)
  const kotobaPct = !hasKotoba ? 100 : Math.min(100, (actualKotoba / mission.targetKotobaCount) * 100)

  // Overall percentage strictly based on planned active targets
  let targetComponentsCount = 0
  let targetPctSum = 0
  if (hasVideos) {
    targetComponentsCount++
    targetPctSum += videoPct
  }
  if (hasQuiz) {
    targetComponentsCount++
    targetPctSum += quizPct
  }
  if (hasKotoba) {
    targetComponentsCount++
    targetPctSum += kotobaPct
  }

  const overallPct = isNoPlan ? 100 : (targetComponentsCount > 0 ? Math.round(targetPctSum / targetComponentsCount) : 0)
  
  // Streak is earned if:
  // 1) Explicit rest day ("Tidak Ada Rencana" / Freeze Cap Biru), OR
  // 2) User set specific targets and all of them are completed 100%
  const isFullyCompleted = isNoPlan || (hasAnyTarget && videoCompleted && quizCompleted && kotobaCompleted && overallPct === 100)

  // Sync streak if fully completed on target date
  if (isFullyCompleted) {
    try {
      const customId = ensureUUID(`${userId}_${dateStr}`, '00000000-0000-0000-0005-')
      await supabase.from('learning_streaks').upsert({
        id: customId,
        student_id: userId,
        date: dateStr,
      }, { onConflict: 'student_id,date' })

      // Calculate streak & update profile streak_days count in DB
      const { data: streaksData } = await supabase
        .from('learning_streaks')
        .select('date')
        .eq('student_id', userId)

      if (streaksData) {
        const streakDates = new Set(streaksData.map((s: any) => s.date))
        const streakCount = calculateStreakFromDates(streakDates, getTodayDateString())
        await supabase
          .from('profiles')
          .update({ streak_days: streakCount, last_active_at: new Date().toISOString() })
          .eq('id', userId)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('kaiwa_profile_updated'))
        }
      }
    } catch (e) {
      console.warn('Learning streak DB upsert note:', e)
    }
  } else {
    // If progress is NOT 100% completed, remove entry from learning_streaks so streak is not awarded prematurely
    try {
      await supabase
        .from('learning_streaks')
        .delete()
        .eq('student_id', userId)
        .eq('date', dateStr)

      const { data: streaksData } = await supabase
        .from('learning_streaks')
        .select('date')
        .eq('student_id', userId)

      if (streaksData) {
        const streakDates = new Set(streaksData.map((s: any) => s.date))
        const streakCount = calculateStreakFromDates(streakDates, getTodayDateString())
        await supabase
          .from('profiles')
          .update({ streak_days: streakCount, last_active_at: new Date().toISOString() })
          .eq('id', userId)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('kaiwa_profile_updated'))
        }
      }
    } catch (e) {
      console.warn('Learning streak delete note:', e)
    }
  }

  return {
    actualReplays,
    targetReplays: mission.targetReplayCount,
    videoCompleted,
    videoProgressMap,

    actualQuizzes,
    targetQuizzes: mission.targetQuizCount,
    quizCompleted,

    actualKotoba,
    targetKotoba: mission.targetKotobaCount,
    kotobaCompleted,

    overallPct,
    isFullyCompleted,
  }
}
