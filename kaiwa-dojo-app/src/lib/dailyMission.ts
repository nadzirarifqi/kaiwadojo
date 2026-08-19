import { supabase } from './supabaseClient'

export interface SelectedVideoItem {
  id: string          // e.g. "bab_1_video_1"
  title: string       // e.g. "Bab 1: Video 1 (Bunpou A)"
  jilid: 1 | 2
  bab: number
  videoNum: number
}

export interface DailyMissionData {
  date: string                       // YYYY-MM-DD
  selectedVideos: SelectedVideoItem[] // User selected videos
  targetReplayCount: number          // selectedVideos.length * 3
  targetQuizCount: number            // e.g. 1
  targetKotobaCount: number          // e.g. 1
  isCompleted?: boolean
}

export interface MissionProgress {
  actualReplays: number
  targetReplays: number
  videoCompleted: boolean
  
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
  const local = getDailyMission(userId, targetDate)
  if (local) return local

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
        targetReplayCount: data.target_replay_count || 3,
        targetQuizCount: data.target_quiz_count || 1,
        targetKotobaCount: data.target_kotoba_count || 1,
      }
      localStorage.setItem(`kaiwa_daily_mission_${userId}_${targetDate}`, JSON.stringify(mission))
      return mission
    }
  } catch (e) {
    // Ignore DB error
  }

  return null
}

export async function fetchAllUserMissions(userId: string): Promise<Map<string, DailyMissionData>> {
  const missionMap = new Map<string, DailyMissionData>()

  // 1. Load all local missions first
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`kaiwa_daily_mission_${userId}_`)) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed: DailyMissionData = JSON.parse(raw)
          if (parsed.date) missionMap.set(parsed.date, parsed)
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 2. Load DB missions
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
          targetReplayCount: row.target_replay_count || 3,
          targetQuizCount: row.target_quiz_count || 1,
          targetKotobaCount: row.target_kotoba_count || 1,
        }
        missionMap.set(row.date, mission)
        localStorage.setItem(`kaiwa_daily_mission_${userId}_${row.date}`, JSON.stringify(mission))
      })
    }
  } catch (e) {
    // Ignore DB fallback
  }

  return missionMap
}

export async function saveDailyMission(
  userId: string,
  data: Omit<DailyMissionData, 'date'>,
  targetDate?: string
): Promise<DailyMissionData> {
  const dateStr = targetDate || getTodayDateString()
  const mission: DailyMissionData = {
    ...data,
    date: dateStr,
    targetReplayCount: data.selectedVideos.length * 3,
  }
  
  // 1. Save to LocalStorage immediately
  localStorage.setItem(`kaiwa_daily_mission_${userId}_${dateStr}`, JSON.stringify(mission))
  if (dateStr === getTodayDateString()) {
    localStorage.setItem(`kaiwa_daily_mission_${userId}`, JSON.stringify(mission))
  }

  // 2. Save to Supabase DB for cross-device persistence
  try {
    const customId = `${userId}_${dateStr}`
    await supabase.from('daily_missions').upsert({
      id: customId,
      student_id: userId,
      date: dateStr,
      selected_videos: mission.selectedVideos,
      target_replay_count: mission.targetReplayCount,
      target_quiz_count: mission.targetQuizCount,
      target_kotoba_count: mission.targetKotobaCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,date' })
  } catch (err) {
    console.warn('Supabase saveDailyMission note:', err)
  }
  
  return mission
}

export async function calculateMissionProgress(
  userId: string,
  mission: DailyMissionData
): Promise<MissionProgress> {
  const dateStr = mission.date || getTodayDateString()

  // Fetch lesson progress
  const { data: progressData } = await supabase
    .from('lesson_progress')
    .select('lesson_id, is_completed, replay_count, last_watched_at')
    .eq('student_id', userId)

  let actualReplays = 0
  let actualQuizzes = 0
  let actualKotoba  = 0

  if (progressData) {
    const selectedVideoIds = new Set(mission.selectedVideos.map(v => v.id))

    progressData.forEach((p: any) => {
      const matchVideo = selectedVideoIds.has(p.lesson_id) || selectedVideoIds.has(p.lesson_id?.toLowerCase())
      if (matchVideo) {
        actualReplays += (p.replay_count || 1)
      } else if (p.lesson_id?.includes('video_')) {
        actualReplays += (p.replay_count || 1)
      }

      if (p.lesson_id?.includes('quiz') || p.lesson_id?.includes('item_4')) {
        if (p.is_completed) actualQuizzes++
      }

      if (p.lesson_id?.includes('kotoba') || p.lesson_id?.includes('item_5')) {
        if (p.is_completed) actualKotoba++
      }
    })
  }

  const videoCompleted = mission.targetReplayCount === 0 || actualReplays >= mission.targetReplayCount
  const quizCompleted  = mission.targetQuizCount === 0 || actualQuizzes >= mission.targetQuizCount
  const kotobaCompleted = mission.targetKotobaCount === 0 || actualKotoba  >= mission.targetKotobaCount

  const isFullyCompleted = videoCompleted && quizCompleted && kotobaCompleted

  const videoPct  = mission.targetReplayCount === 0 ? 100 : Math.min(100, (actualReplays / mission.targetReplayCount) * 100)
  const quizPct   = mission.targetQuizCount === 0 ? 100 : Math.min(100, (actualQuizzes / mission.targetQuizCount) * 100)
  const kotobaPct = mission.targetKotobaCount === 0 ? 100 : Math.min(100, (actualKotoba / mission.targetKotobaCount) * 100)

  const overallPct = Math.round((videoPct + quizPct + kotobaPct) / 3)

  // Sync streak if fully completed on target date
  if (isFullyCompleted) {
    await supabase.from('learning_streaks').upsert({
      student_id: userId,
      date: dateStr,
    }, { onConflict: 'student_id,date' })
  }

  return {
    actualReplays,
    targetReplays: mission.targetReplayCount,
    videoCompleted,

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
