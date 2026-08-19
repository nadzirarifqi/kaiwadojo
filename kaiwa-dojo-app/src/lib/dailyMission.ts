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

export function saveDailyMission(userId: string, data: Omit<DailyMissionData, 'date'>, targetDate?: string): DailyMissionData {
  const dateStr = targetDate || getTodayDateString()
  const mission: DailyMissionData = {
    ...data,
    date: dateStr,
    targetReplayCount: data.selectedVideos.length * 3,
  }
  
  localStorage.setItem(`kaiwa_daily_mission_${userId}_${dateStr}`, JSON.stringify(mission))
  
  // Also save to default key if date is today
  if (dateStr === getTodayDateString()) {
    localStorage.setItem(`kaiwa_daily_mission_${userId}`, JSON.stringify(mission))
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
      // Check if watched on the target date or overall
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

  const videoCompleted = actualReplays >= mission.targetReplayCount
  const quizCompleted  = actualQuizzes >= mission.targetQuizCount
  const kotobaCompleted = actualKotoba  >= mission.targetKotobaCount

  const isFullyCompleted = videoCompleted && quizCompleted && kotobaCompleted

  const videoPct  = Math.min(100, mission.targetReplayCount > 0 ? (actualReplays / mission.targetReplayCount) * 100 : 100)
  const quizPct   = Math.min(100, mission.targetQuizCount > 0 ? (actualQuizzes / mission.targetQuizCount) * 100 : 100)
  const kotobaPct = Math.min(100, mission.targetKotobaCount > 0 ? (actualKotoba / mission.targetKotobaCount) * 100 : 100)

  const overallPct = Math.round((videoPct + quizPct + kotobaPct) / 3)

  // Sync streak if fully completed on today's date
  if (isFullyCompleted && dateStr === getTodayDateString()) {
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
