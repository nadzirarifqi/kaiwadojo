import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import {
  type DailyMissionData,
  type MissionProgress,
  getDailyMission,
  fetchDailyMission,
  fetchAllUserMissions,
  calculateMissionProgress,
  calculateStreakFromDates,
  isNoPlanMission,
  getTodayDateString,
  DAILY_MISSION_UPDATE_EVENT,
  subscribeToDailyMissionRealtime,
  backfillHistoricalStreakCaps,
} from '../lib/dailyMission'
import {
  SCHEDULE_UPDATE_EVENT,
  RESERVATION_UPDATE_EVENT,
  subscribeToScheduleRealtime,
  fetchSchedules,
  fetchReservations,
  matchScheduleId,
} from '../lib/scheduleService'
import { useLanguage } from '../contexts/LanguageContext'
import { DashboardSkeleton } from '../components/Skeleton'
import {
  type Announcement,
  fetchActiveAnnouncementsForUser,
  ANNOUNCEMENT_UPDATE_EVENT,
  subscribeToAnnouncementRealtime,
} from '../lib/announcementService'
import AnnouncementModal from '../components/AnnouncementModal'

function formatIndonesianFullDate(dateStr: string): string {
  if (!dateStr) return ''
  const clean = dateStr.split('T')[0]
  const parts = clean.split('-')
  if (parts.length !== 3) return dateStr

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)

  const dateObj = new Date(year, month, day)
  if (isNaN(dateObj.getTime())) return dateStr

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]

  return `${days[dateObj.getDay()]}, ${day} ${months[dateObj.getMonth()]} ${year}`
}

function getLast7DayLabels() {
  const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const today  = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    return labels[d.getDay()]
  })
}

export interface StreakDayHistory {
  date: string
  done: boolean
  isFreeze?: boolean
}

/* ── Sakura Evolution Data & Stages ──────────────────── */
interface SakuraStage {
  level: string
  stageName: string
  japaneseName: string
  description: string
  nextGoal: number
  colorClass: string
  bgClass: string
}

function getSakuraStage(streakDays: number, isFreeze: boolean): SakuraStage {
  if (isFreeze) {
    return {
      level: 'Istirahat',
      stageName: 'Pohon Sakura Salju',
      japaneseName: '冬桜',
      description: 'Dahan sakura dilindungi salju es; streak kamu aman terjaga.',
      nextGoal: streakDays < 7 ? 7 : streakDays < 30 ? 30 : 100,
      colorClass: 'text-sky-500',
      bgClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-400/30',
    }
  }

  if (streakDays >= 100) {
    return {
      level: 'Master',
      stageName: 'Pohon Sakura Abadi',
      japaneseName: '悠久の桜',
      description: 'Pencapaian legendaris 100+ hari! Pohon sakura kokoh mekar abadi di dojo kamu.',
      nextGoal: 365,
      colorClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/30',
    }
  } else if (streakDays >= 30) {
    return {
      level: 'Pakar',
      stageName: 'Pohon Sakura Rimbun',
      japaneseName: '満開の桜',
      description: '30+ hari konsisten! Mahkota sakura rimbun memesona menghiasi perjalanan belajarmu.',
      nextGoal: 100,
      colorClass: 'text-rose-500',
      bgClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-400/30',
    }
  } else if (streakDays >= 7) {
    return {
      level: 'Aktif',
      stageName: 'Pohon Sakura Mekar',
      japaneseName: '開花の桜',
      description: '7+ hari berturut-turut! Bunga sakura mekar penuh menebarkan semangat belajar.',
      nextGoal: 30,
      colorClass: 'text-pink-500',
      bgClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-400/30',
    }
  } else if (streakDays >= 3) {
    return {
      level: 'Tekun',
      stageName: 'Pohon Muda Sakura',
      japaneseName: '若木の桜',
      description: '3+ hari berturut-turut! Pohon muda bertumbuh kuat dengan kuncup bunga pertama.',
      nextGoal: 7,
      colorClass: 'text-pink-400',
      bgClass: 'bg-pink-500/10 text-pink-500 border-pink-400/30',
    }
  } else if (streakDays >= 1) {
    return {
      level: 'Awal',
      stageName: 'Tunas Bunga Sakura',
      japaneseName: '桜の若芽',
      description: 'Langkah awal! Tunas muda baru bersemi segar mengawali ketekunan belajarmu.',
      nextGoal: 3,
      colorClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-400/30',
    }
  } else {
    return {
      level: 'Mulai',
      stageName: 'Benih Bunga Sakura',
      japaneseName: '桜の種',
      description: 'Selesaikan rencana harian hari ini untuk menumbuhkan tunas sakura pertama!',
      nextGoal: 1,
      colorClass: 'text-slate-400',
      bgClass: 'bg-slate-500/10 text-slate-500 border-slate-300 dark:border-slate-700',
    }
  }
}

/* ── Sakura Blossom Visual Component ──────────────────── */
function SakuraBlossomVisual({ streakDays, isFreeze }: { streakDays: number; isFreeze: boolean }) {
  if (isFreeze) {
    // Frost Sakura Flower
    return (
      <div className="relative size-16 sm:size-20 flex items-center justify-center">
        <div className="absolute inset-0 bg-sky-400/15 rounded-full blur-xl animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-md text-sky-400">
          {/* Frost Petals */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 18 C43 28, 41 38, 50 50 C59 38, 57 28, 50 18 Z"
              fill="url(#icePetalGrad)"
              stroke="#7DD3FC"
              strokeWidth="1.2"
            />
          ))}
          {/* Snowflake center */}
          <circle cx="50" cy="50" r="7" fill="#E0F2FE" />
          <path d="M50 43 L50 57 M43 50 L57 50 M45 45 L55 55 M45 55 L55 45" stroke="#0284C7" strokeWidth="1.5" />
          <defs>
            <linearGradient id="icePetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#BAE6FD" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (streakDays >= 100) {
    // Golden Legendary Sakura
    return (
      <div className="relative size-16 sm:size-20 flex items-center justify-center">
        <div className="absolute inset-0 bg-amber-400/25 rounded-full blur-xl animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-lg text-amber-400">
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 12 C40 25, 38 38, 50 50 C62 38, 60 25, 50 12 Z"
              fill="url(#goldPetalGrad)"
              stroke="#F59E0B"
              strokeWidth="1.5"
            />
          ))}
          <circle cx="50" cy="50" r="8" fill="#FEF3C7" />
          <circle cx="50" cy="50" r="4" fill="#D97706" />
          <defs>
            <linearGradient id="goldPetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (streakDays >= 30) {
    // Blooming Sakura Cluster with Floating Petals
    return (
      <div className="relative size-16 sm:size-20 flex items-center justify-center">
        <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-xl animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-md">
          {/* Main 5 Petals */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 14 C41 24, 38 36, 50 50 C62 36, 59 24, 50 14 Z"
              fill="url(#rosePetalGrad)"
              stroke="#F43F5E"
              strokeWidth="1.2"
            />
          ))}
          {/* Inner heart and stamen */}
          <circle cx="50" cy="50" r="7" fill="#FFF1F2" />
          <circle cx="50" cy="50" r="3.5" fill="#E11D48" />
          {/* Floating mini petal */}
          <path d="M82 32 C78 30, 76 34, 79 38 C83 37, 85 34, 82 32 Z" fill="#FB7185" className="animate-pulse" />
          <defs>
            <linearGradient id="rosePetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDA4AF" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (streakDays >= 7) {
    // Full 5-Petal Mankai Sakura
    return (
      <div className="relative size-16 sm:size-20 flex items-center justify-center">
        <div className="absolute inset-0 bg-pink-500/15 rounded-full blur-lg animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-md">
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 15 C42 26, 40 37, 50 50 C60 37, 58 26, 50 15 Z"
              fill="url(#pinkPetalGrad)"
              stroke="#EC4899"
              strokeWidth="1"
            />
          ))}
          <circle cx="50" cy="50" r="6" fill="#FDF2F8" />
          <circle cx="50" cy="50" r="3" fill="#DB2777" />
          <defs>
            <linearGradient id="pinkPetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FBCFE8" />
              <stop offset="100%" stopColor="#DB2777" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (streakDays >= 3) {
    // Sakura Bud (Half-Bloomed)
    return (
      <div className="relative size-16 sm:size-20 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-sm">
          {/* Branch and stem */}
          <path d="M50 78 C50 64, 48 54, 50 45" stroke="#78350F" strokeWidth="4" strokeLinecap="round" />
          {/* Calyx (leaves) */}
          <path d="M43 55 C48 52, 52 52, 57 55 C54 62, 46 62, 43 55 Z" fill="#15803D" />
          {/* Budding Pink Petals */}
          <path d="M50 25 C40 35, 42 48, 50 52 C58 48, 60 35, 50 25 Z" fill="#F472B6" stroke="#DB2777" strokeWidth="1" />
          <path d="M45 28 C42 37, 46 45, 50 50 C46 44, 45 35, 45 28 Z" fill="#FB7185" />
        </svg>
      </div>
    )
  }

  if (streakDays >= 1) {
    // Tender Green Sprout with Pink Tip
    return (
      <div className="relative size-16 sm:size-20 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="size-full">
          <path d="M50 80 C50 66, 49 55, 50 48" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M50 48 C42 42, 44 32, 50 28 C56 32, 58 42, 50 48 Z" fill="#22C55E" />
          <circle cx="50" cy="28" r="3.5" fill="#F472B6" />
        </svg>
      </div>
    )
  }

  // Seed / Starting
  return (
    <div className="relative size-16 sm:size-20 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="size-full opacity-60">
        <circle cx="50" cy="55" r="14" fill="#78350F" />
        <path d="M50 41 C47 47, 47 52, 50 55 C53 52, 53 47, 50 41 Z" fill="#22C55E" />
      </svg>
    </div>
  )
}

/* ── StreakCard Component (Sakura Blossom Dojo) ─────────── */
function StreakCard({
  streakDays,
  history,
  isFreezeToday,
}: {
  streakDays: number
  history: StreakDayHistory[]
  isFreezeToday?: boolean
}) {
  const navigate = useNavigate()
  const dayLabels = getLast7DayLabels()
  const todayItem = history[history.length - 1]
  const todayDone = todayItem?.done || false
  const isTodayFreeze = isFreezeToday || todayItem?.isFreeze || false

  const sakuraInfo = getSakuraStage(streakDays, isTodayFreeze)
  const nextMilestone = sakuraInfo.nextGoal
  const pct = Math.min(Math.round((streakDays / nextMilestone) * 100), 100)

  const [showSakuraModal, setShowSakuraModal] = useState(false)

  const milestones = [
    { days: 7,   label: '7 Hari',   stageName: 'Mekar' },
    { days: 30,  label: '30 Hari',  stageName: 'Rimbun' },
    { days: 100, label: '100 Hari', stageName: 'Emas' },
  ]

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 relative overflow-hidden">
      {/* Decorative ambient Sakura glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 border border-rose-500/20 flex items-center justify-center">
            <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight">
              {sakuraInfo.stageName}
            </h2>
            <span className="text-[0.68rem] text-slate-400 font-semibold block">
              {sakuraInfo.japaneseName} • {streakDays} Hari Konsisten
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSakuraModal(true)}
          className={`text-[0.68rem] font-extrabold px-3 py-1 rounded-full border cursor-pointer transition-all hover:scale-105 active:scale-95 ${sakuraInfo.bgClass}`}
        >
          {sakuraInfo.level}
        </button>
      </div>

      {/* Sakura Blossom Visualizer + Counter */}
      <div className="flex items-center gap-4 sm:gap-6 relative z-10">
        {/* Animated Sakura Visual */}
        <div
          onClick={() => setShowSakuraModal(true)}
          className="flex flex-col items-center shrink-0 cursor-pointer group"
          title="Klik untuk melihat tahapan mekar Sakura"
        >
          <div className="group-hover:scale-105 transition-transform">
            <SakuraBlossomVisual streakDays={streakDays} isFreeze={isTodayFreeze} />
          </div>
          <div className={`text-3xl sm:text-4xl font-black leading-none mt-1 tracking-tight ${sakuraInfo.colorClass}`}>
            {streakDays}
          </div>
          <div className="text-[0.68rem] sm:text-xs text-slate-400 font-bold mt-0.5 text-center whitespace-nowrap">
            Hari Sakura
          </div>
        </div>

        {/* 7-Day History & Progress */}
        <div className="flex-1 min-w-0">
          {/* 7-Day Dots with mini Sakura blossoms */}
          <div className="flex gap-1.5 mb-3">
            {history.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full aspect-square max-w-[34px] rounded-full flex items-center justify-center transition-all ${
                    item.done
                      ? item.isFreeze
                        ? 'bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-xs ring-2 ring-sky-200 dark:ring-sky-900'
                        : 'bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-xs ring-2 ring-rose-200 dark:ring-rose-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                  }`}
                  title={`${dayLabels[i]}: ${item.done ? (item.isFreeze ? 'Istirahat (Freeze)' : 'Misi Selesai') : 'Belum selesai'}`}
                >
                  {item.done ? (
                    item.isFreeze ? (
                      <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2v20m-10-10h20m-17-7l14 14m0-14L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 3c-1.5 2-2 4-1 6 2-1 4-1 5 1 1-2 3-2 5-1-1-2-2-4-4-5-2 1-4 1-5-1zm-4 6c-2 1-4 1-5-1 1 2 2 4 4 5 2-1 4-1 5 1-1-2-1-4-2-5-1 0-2 0-2 0zm10 7c2-1 4-1 5 1-1-2-2-4-4-5-2 1-4 1-5-1 1 2 1 4 2 5 1 0 2 0 2 0zm-8 4c1 2 2 4 4 5 2-1 4-1 5 1 1-2 2-4 1-6-2 1-4 1-5-1-1 0-2 0-2 1z" />
                      </svg>
                    )
                  ) : (
                    <span className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  )}
                </div>
                <span className="text-[0.65rem] sm:text-[0.7rem] text-slate-400 font-bold">{dayLabels[i]}</span>
              </div>
            ))}
          </div>

          {/* Progress Bar to Next Sakura Milestone */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-500 dark:text-slate-400">
                Target {nextMilestone} Hari
              </span>
              <span className={`font-black ${sakuraInfo.colorClass}`}>
                {streakDays}/{nextMilestone}
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isTodayFreeze
                    ? 'bg-gradient-to-r from-sky-400 to-cyan-500'
                    : 'bg-gradient-to-r from-rose-400 to-pink-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Milestone Badges without Emojis */}
          <div className="flex gap-1.5 mt-2.5">
            {milestones.map(m => (
              <div
                key={m.days}
                className={`flex-1 py-1 px-1.5 rounded-lg text-center text-[0.62rem] sm:text-[0.68rem] font-bold border ${
                  streakDays >= m.days
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400'
                }`}
              >
                <span>{m.label}</span>
                <span className="hidden sm:inline opacity-75"> ({m.stageName})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today Status Banner with Clean Separated Button */}
      <div
        className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          isTodayFreeze
            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
            : todayDone
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-current animate-pulse shrink-0" />
          <span>
            {isTodayFreeze
              ? 'Hari istirahat terencana (Cap Biru). Angka streak tetap aman bertambah.'
              : todayDone
              ? 'Misi hari ini telah selesai! Bunga sakura dojo kamu mekar indah.'
              : 'Selesaikan misi belajar hari ini untuk menjaga bunga sakura tetap mekar.'}
          </span>
        </div>

        {!todayDone && !isTodayFreeze && (
          <button
            onClick={() => navigate('/learning-plan')}
            className="group px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto touch-manipulation min-h-[36px]"
          >
            <span>Buka Rencana</span>
            <span className="size-4 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* Interactive Sakura Evolution Info Modal */}
      {showSakuraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rose-500" />
                <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
                  Tahapan Pertumbuhan Pohon Sakura
                </h3>
              </div>
              <button
                onClick={() => setShowSakuraModal(false)}
                className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center font-bold text-xs"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Di KaiwaDojo, konsistensi belajar diibaratkan pohon sakura yang bertumbuh semakin megah seiring bertambahnya streak Anda:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-800 dark:text-white">0 Hari</div>
                  <div className="text-[0.68rem] text-slate-400">Benih Bunga Sakura</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 font-bold text-[0.65rem]">Tahap 0</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-800 dark:text-white">1 - 2 Hari</div>
                  <div className="text-[0.68rem] text-slate-400">Tunas Bunga Sakura</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-[0.65rem]">Tahap 1</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-800 dark:text-white">3 - 6 Hari</div>
                  <div className="text-[0.68rem] text-slate-400">Pohon Muda Sakura</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-600 font-bold text-[0.65rem]">Tahap 2</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-800 dark:text-white">7 - 29 Hari</div>
                  <div className="text-[0.68rem] text-slate-400">Pohon Sakura Mekar (Kaika)</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 font-bold text-[0.65rem]">Tahap 3</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-800 dark:text-white">30 - 99 Hari</div>
                  <div className="text-[0.68rem] text-slate-400">Pohon Sakura Rimbun (Mankai)</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 font-bold text-[0.65rem]">Tahap 4</span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-amber-900 dark:text-amber-200">100+ Hari</div>
                  <div className="text-[0.68rem] text-amber-700 dark:text-amber-300">Pohon Sakura Abadi</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-bold text-[0.65rem]">Master</span>
              </div>
            </div>

            <button
              onClick={() => setShowSakuraModal(false)}
              className="w-full py-2.5 bg-primary text-white font-bold rounded-xl text-xs border-none cursor-pointer mt-1"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── EmbeddedUserScheduleCard Component ─────────────────────── */
function getRelativeDayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Hari Ini'
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [dy, dm, dd] = dateStr.split('-').map(Number)
  const tDate = new Date(ty, tm - 1, td)
  const dDate = new Date(dy, dm - 1, dd)
  const diffDays = Math.round((dDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return 'Besok'
  if (diffDays === 2) return 'Lusa'
  if (diffDays > 0) return `${diffDays} hari lagi`
  if (diffDays === -1) return 'Kemarin'
  return `${Math.abs(diffDays)} hari lalu`
}

function EmbeddedUserScheduleCard({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [userReservations, setUserReservations] = useState<any[]>([])
  const [userMissions, setUserMissions]         = useState<{ date: string; mission: DailyMissionData }[]>([])
  const [loading, setLoading]                   = useState(true)

  const todayStr = getTodayDateString()

  useEffect(() => {
    async function loadSchedulesAndMissions() {
      if (!userId) {
        setLoading(false)
        return
      }
      setLoading(true)

      try {
        const [missionsMap, allSchedules, allReservations] = await Promise.all([
          fetchAllUserMissions(userId),
          fetchSchedules(),
          fetchReservations(),
        ])

        // User reservations starting from today
        const myReservations = allReservations.filter(r => r.user_id === userId)
        const myReservedSchedules = myReservations
          .map(r => {
            const sch = allSchedules.find(s => matchScheduleId(s.id, r.schedule_id))
            return sch ? { ...sch, reservationId: r.id } : null
          })
          .filter((sch): sch is NonNullable<typeof sch> => Boolean(sch && (sch.date || sch.start_date || '') >= todayStr))
          .sort((a, b) => (a.date || a.start_date || '').localeCompare(b.date || b.start_date || ''))

        setUserReservations(myReservedSchedules)

        // User missions starting from today
        const missionsList: { date: string; mission: DailyMissionData }[] = Array.from(missionsMap.entries())
          .filter(([date]) => date >= todayStr)
          .map(([date, mission]) => ({ date, mission }))
          .sort((a, b) => a.date.localeCompare(b.date))

        setUserMissions(missionsList)
      } catch (err) {
        console.error('Error loading schedule widget:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSchedulesAndMissions()

    const handleUpdate = () => {
      loadSchedulesAndMissions()
    }

    window.addEventListener(DAILY_MISSION_UPDATE_EVENT, handleUpdate)
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleUpdate)
    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.removeEventListener(DAILY_MISSION_UPDATE_EVENT, handleUpdate)
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleUpdate)
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [userId, todayStr])

  // Combined plans starting from today
  const displayedTimeline = [
    ...userMissions.map(m => ({
      id: `mission-${m.date}`,
      type: 'mission' as const,
      date: m.date,
      mission: m.mission,
    })),
    ...userReservations.map(r => ({
      id: `class-${r.id}`,
      type: 'class' as const,
      date: r.date || r.start_date || '',
      schedule: r,
    })),
  ]
    .filter(item => item.date >= todayStr)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.type === 'class' ? -1 : 1
    })

  const [selectedScheduleItem, setSelectedScheduleItem] = useState<any | null>(null)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3 h-full min-h-0">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight">
                Jadwal & Agenda Saya
              </h2>
              <span className="text-[0.68rem] text-slate-400 font-medium">Rencana Belajar Mulai Hari Ini</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/learning-plan')}
            className="group px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>Kalender</span>
            <span className="size-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <svg className="size-2 text-slate-700 dark:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>

        {/* Subheader info: Today & Count */}
        <div className="flex items-center justify-between mb-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Hari ini:</span>
            <span className="font-extrabold text-slate-800 dark:text-white">
              {formatIndonesianFullDate(todayStr).split(',')[0]}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-black text-[0.68rem]">
            {displayedTimeline.length} Rencana Terjadwal
          </span>
        </div>

        {/* Scrollable Timeline List */}
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Memuat linimasa jadwalku...</div>
        ) : displayedTimeline.length === 0 ? (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400 text-center flex flex-col items-center gap-3 flex-1 justify-center">
            <span>Belum ada agenda belajar atau kelas terjadwal mulai hari ini.</span>
            <button
              onClick={() => navigate('/learning-plan')}
              className="group px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-extrabold border-none cursor-pointer transition-all text-xs shadow-xs flex items-center gap-1.5"
            >
              <span>Susun Rencana di Kalender</span>
              <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 max-h-[300px]">
            {displayedTimeline.map(item => {
              const isToday = item.date === todayStr
              const relLabel = getRelativeDayLabel(item.date, todayStr)

              if (item.type === 'mission') {
                const m = item.mission
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedScheduleItem(item)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all hover:border-amber-500 flex flex-col gap-1 group ${
                      isToday
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-800 ring-2 ring-amber-300/30 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold">
                      <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        <span>Misi Harian</span>
                        {isToday ? (
                          <span className="text-[0.62rem] bg-amber-500 text-white px-1.5 py-0.2 rounded-md font-black uppercase">
                            Hari Ini
                          </span>
                        ) : relLabel === 'Besok' ? (
                          <span className="text-[0.62rem] bg-sky-500 text-white px-1.5 py-0.2 rounded-md font-bold uppercase">
                            Besok
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-semibold group-hover:text-amber-600 transition-colors">
                        {formatIndonesianFullDate(item.date)}
                      </span>
                    </div>

                    <div className="font-bold text-slate-800 dark:text-white truncate">
                      {m.selectedVideos.length > 0
                        ? m.selectedVideos.map(v => `Bab ${v.bab} (Part ${v.videoNum})`).join(', ')
                        : 'Misi Mandiri Non-Video'}
                    </div>

                    <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
                      <span>Target: {m.targetReplayCount}x Replays</span>
                      <span>• {m.targetQuizCount} Kuis • {m.targetKotobaCount} Kotoba</span>
                    </div>
                  </div>
                )
              } else {
                const sch = item.schedule
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedScheduleItem(item)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all flex flex-col gap-1 group ${
                      isToday
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 dark:border-sky-700 ring-2 ring-sky-300/30 shadow-xs'
                        : sch.type === 'online'
                          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100 hover:border-sky-400'
                          : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold">
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-sky-500" />
                        <span>{sch.type === 'online' ? 'Kelas Online' : 'Kelas Offline'}</span>
                        {isToday ? (
                          <span className="text-[0.62rem] bg-sky-600 text-white px-1.5 py-0.2 rounded-md font-black uppercase">
                            Hari Ini
                          </span>
                        ) : relLabel === 'Besok' ? (
                          <span className="text-[0.62rem] bg-sky-500 text-white px-1.5 py-0.2 rounded-md font-bold uppercase">
                            Besok
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[0.68rem] font-semibold">
                        {formatIndonesianFullDate(sch.date)} ({sch.start_time} WIB)
                      </span>
                    </div>

                    <div className="font-bold truncate text-slate-800 dark:text-white">
                      {sch.title}
                    </div>

                    <div className="text-[0.68rem] opacity-80 flex items-center justify-between">
                      <span>Sensei: {sch.instructor_name || sch.instructor || 'Sensei Dojo'}</span>
                      <span className="font-black px-1.5 py-0.2 rounded bg-white/80 dark:bg-slate-900/60">
                        Terdaftar
                      </span>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>

      {/* Detail Pop-up Modal View */}
      {selectedScheduleItem && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div className="flex justify-between items-start pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                  {selectedScheduleItem.type === 'mission' ? 'Detail Misi Mandiri' : 'Detail Kelas Live'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-snug mt-0.5">
                  {selectedScheduleItem.type === 'mission'
                    ? `Misi Harian (${selectedScheduleItem.date})`
                    : selectedScheduleItem.schedule.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedScheduleItem(null)}
                className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 font-bold border-none cursor-pointer flex items-center justify-center text-xs"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedScheduleItem.type === 'mission' ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 flex flex-col gap-1">
                  <div className="font-extrabold text-amber-900 dark:text-amber-200 text-xs">
                    Tanggal Pelaksanaan: {formatIndonesianFullDate(selectedScheduleItem.date)}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[0.72rem]">
                    Rencana belajar mandiri harian yang telah kamu susun untuk menguji pemahaman dan menjaga streak belajarmu.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-extrabold text-slate-800 dark:text-white">Video Pembelajaran:</div>
                  {selectedScheduleItem.mission.selectedVideos.length > 0 ? (
                    selectedScheduleItem.mission.selectedVideos.map((v: any, idx: number) => (
                      <div key={v.id || idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-white truncate">
                            Jilid {v.jilid} · Bab {v.bab} (Part {v.videoNum})
                          </div>
                          <div className="text-[0.68rem] text-slate-400 truncate">{v.title}</div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedScheduleItem(null)
                            navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)
                          }}
                          className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-xs border-none cursor-pointer shrink-0 transition-all shadow-xs"
                        >
                          Tonton
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400">Tidak ada video khusus.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className={`p-3 rounded-2xl border flex flex-col gap-1.5 ${
                  selectedScheduleItem.schedule.type === 'online'
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                }`}>
                  <div className="font-black text-xs">
                    {selectedScheduleItem.schedule.type === 'online' ? 'Kelas Online (Live Zoom / Meet)' : 'Kelas Offline (Tatap Muka)'}
                  </div>
                  <div className="font-semibold text-xs">
                    {formatIndonesianFullDate(selectedScheduleItem.schedule.date)} ({selectedScheduleItem.schedule.start_time} - {selectedScheduleItem.schedule.end_time} WIB)
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-extrabold text-slate-800 dark:text-white">Pengajar (Sensei):</div>
                  <div className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                    {selectedScheduleItem.schedule.instructor_name || selectedScheduleItem.schedule.instructor || 'Sensei Dojo'}
                  </div>
                  {selectedScheduleItem.schedule.type === 'online' && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block mb-1 font-semibold text-[0.7rem]">Tautan Kelas:</span>
                      <a
                        href={selectedScheduleItem.schedule.meet_url || 'https://zoom.us/j/kaiwadojo-live-session'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 dark:text-sky-400 font-mono text-[0.72rem] font-bold select-all bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1.5 rounded-lg inline-block break-all hover:underline"
                      >
                        {selectedScheduleItem.schedule.meet_url || 'https://zoom.us/j/kaiwadojo-live-session'}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedScheduleItem(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Dashboard ────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    enrolledCoursesCount: 0,
    completedCoursesCount: 0,
    streakDays: 0,
  })
  const [streakHistory, setStreakHistory] = useState<StreakDayHistory[]>([])

  const [bookProgress, setBookProgress] = useState({
    jilid1Pct: 0,
    jilid1DoneItems: 0,
    jilid2Pct: 0,
    jilid2DoneItems: 0,
  })

  const [dailyMission, setDailyMission]         = useState<DailyMissionData | null>(null)
  const [missionProgress, setMissionProgress]   = useState<MissionProgress | null>(null)
  const [videoProgressMap, setVideoProgressMap] = useState<Map<string, number>>(new Map())

  const [announcements, setAnnouncements]             = useState<Announcement[]>([])
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Announcement[]>([])
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // Personalized Greeting based on Local Hour
  const localHour = new Date().getHours()
  const greetingJp = localHour < 11 ? 'Ohayou' : localHour < 18 ? 'Konnichiwa' : 'Konbanwa'
  const greetingKanji = localHour < 11 ? 'おはよう' : localHour < 18 ? 'こんにちは' : 'こんばんは'

  useEffect(() => {
    async function loadDashboardData() {
      localStorage.removeItem('kaiwa_lesson_progress_active_global')
      const effectiveUserId = user?.id || profile?.id || null
      if (!effectiveUserId) {
        setLoading(false)
        return
      }

      try {
        const annRes = await fetchActiveAnnouncementsForUser(profile)
        setAnnouncements(annRes.announcements)
        setUnreadAnnouncements(annRes.unreadAnnouncements)

        if (annRes.unreadAnnouncements.length > 0) {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          const loginFingerprint = currentSession?.access_token?.slice(0, 24) || `fallback_${effectiveUserId}`
          const loginSeenKey = `kaiwa_ann_popup_${effectiveUserId}_${loginFingerprint}`

          const alreadyShownThisLogin = sessionStorage.getItem(loginSeenKey)
          if (!alreadyShownThisLogin) {
            setShowAnnouncementModal(true)
            sessionStorage.setItem(loginSeenKey, 'true')
          }
        }
      } catch (err) {
        console.warn('Dashboard announcements load note:', err)
      }

      const todayDate = getTodayDateString()
      const mission = (await fetchDailyMission(effectiveUserId, todayDate)) || getDailyMission(effectiveUserId, todayDate)
      setDailyMission(mission)
      if (mission) {
        const prog = await calculateMissionProgress(effectiveUserId, mission)
        setMissionProgress(prog)

        if (prog.videoProgressMap) {
          const map = new Map<string, number>()
          Object.entries(prog.videoProgressMap).forEach(([k, val]) => map.set(k, val))
          setVideoProgressMap(map)
        }
      }

      backfillHistoricalStreakCaps(effectiveUserId).catch(() => {})

      let userLessonProgress: any[] = []
      const { data } = await supabase
        .from('lesson_progress')
        .select('lesson_id, is_completed')
        .eq('student_id', effectiveUserId)
        .eq('is_completed', true)
      userLessonProgress = data || []

      const completedSet = new Set<string>()
      if (userLessonProgress) {
        userLessonProgress.forEach((p: any) => {
          if (p.lesson_id) completedSet.add(p.lesson_id)
        })
      }

      const storageKey = `kaiwa_lesson_progress_${effectiveUserId}`
      const localProgressData = localStorage.getItem(storageKey)
      if (localProgressData) {
        try {
          const parsed = JSON.parse(localProgressData)
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (Array.isArray(item) && item.length >= 2) {
                const [lId, val] = item
                if (val?.is_completed && lId) completedSet.add(String(lId))
              }
            })
          }
        } catch (e) {
          console.warn('Dashboard progress local parse note:', e)
        }
      }

      let j1Count = 0
      let j2Count = 0
      completedSet.forEach(lId => {
        const match = lId.match(/bab_(\d+)_/)
        if (match) {
          const babNum = parseInt(match[1], 10)
          if (babNum >= 1 && babNum <= 25) j1Count++
          else if (babNum >= 26 && babNum <= 50) j2Count++
        }
      })

      const totalItemsPerJilid = 125
      setBookProgress({
        jilid1Pct: Math.min(100, Math.round((j1Count / totalItemsPerJilid) * 100)),
        jilid1DoneItems: j1Count,
        jilid2Pct: Math.min(100, Math.round((j2Count / totalItemsPerJilid) * 100)),
        jilid2DoneItems: j2Count,
      })

      let enrollData: any[] = []
      let streaksData: any[] = []

      if (user?.id || profile?.id) {
        const [eRes, sRes] = await Promise.all([
          supabase
            .from('enrollments')
            .select(`
              id, progress_pct, course_id,
              course:courses!enrollments_course_id_fkey(id, title, category, thumbnail_url, total_lessons)
            `)
            .eq('student_id', effectiveUserId),
          supabase
            .from('learning_streaks')
            .select('date')
            .eq('student_id', effectiveUserId),
        ])
        enrollData = eRes.data || []
        streaksData = sRes.data || []
      }

      const enrolled = enrollData
      const completed = enrolled.filter((e: any) => Number(e.progress_pct) === 100)
      const streakDates = new Set(streaksData.map((s: any) => s.date))

      if (mission) {
        const prog = await calculateMissionProgress(effectiveUserId, mission)
        if (prog.isFullyCompleted) {
          streakDates.add(todayDate)
        } else {
          streakDates.delete(todayDate)
        }
      }

      const liveStreakCount = calculateStreakFromDates(streakDates)
      const allMissionsMap = await fetchAllUserMissions(effectiveUserId)

      const today = new Date()
      const history: StreakDayHistory[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() - (6 - i))
        const dateStr = d.toISOString().split('T')[0]
        const done = streakDates.has(dateStr)
        const dayMission = allMissionsMap.get(dateStr) || (dateStr === todayDate ? mission : getDailyMission(effectiveUserId, dateStr))
        const isFreeze = isNoPlanMission(dayMission)
        return {
          date: dateStr,
          done,
          isFreeze,
        }
      })

      setStats(prev => ({
        ...prev,
        enrolledCoursesCount: enrolled.length,
        completedCoursesCount: completed.length,
        streakDays: liveStreakCount,
      }))

      setStreakHistory(history)
      setLoading(false)
    }

    loadDashboardData()

    const handleSync = () => {
      loadDashboardData()
    }

    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleSync)
    window.addEventListener(DAILY_MISSION_UPDATE_EVENT, handleSync)
    window.addEventListener('kaiwa_mission_progress_updated', handleSync)
    window.addEventListener('kaiwa_lesson_progress_updated', handleSync)
    window.addEventListener('kaiwa_profile_updated', handleSync)
    window.addEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)

    const unsubscribeScheduleRealtime = subscribeToScheduleRealtime(handleSync)
    const unsubscribeMissionRealtime = subscribeToDailyMissionRealtime(handleSync)
    const unsubscribeAnnouncementRealtime = subscribeToAnnouncementRealtime(handleSync)

    const lessonProgressChannel = supabase
      .channel('dashboard_lesson_progress_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, handleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_kotoba_submissions' }, handleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, handleSync)
      .subscribe()

    return () => {
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleSync)
      window.removeEventListener(DAILY_MISSION_UPDATE_EVENT, handleSync)
      window.removeEventListener('kaiwa_mission_progress_updated', handleSync)
      window.removeEventListener('kaiwa_lesson_progress_updated', handleSync)
      window.removeEventListener('kaiwa_profile_updated', handleSync)
      window.removeEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribeScheduleRealtime()
      unsubscribeMissionRealtime()
      unsubscribeAnnouncementRealtime()
      supabase.removeChannel(lessonProgressChannel)
    }
  }, [user, profile])

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">

      {/* Hero Header with Personalized Japanese Greeting & Badges */}
      <header
        className="relative overflow-hidden rounded-2xl lg:rounded-[28px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-lg animate-fade-in-up bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(185,28,28,0.94), rgba(127,29,29,0.88)), url('/japan-background(2).jpg')",
        }}
      >
        <div className="absolute -top-14 -right-14 size-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 right-20 size-48 bg-white/[0.04] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 w-full">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="size-16 sm:size-20 rounded-2xl border-2 border-white/30 object-cover shadow-md"
              />
            ) : (
              <div className="size-16 sm:size-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-white text-2xl sm:text-3xl shadow-md font-serif">
                {profile?.full_name?.[0] || '学'}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="bg-white/20 backdrop-blur-md text-white text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border border-white/30 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-rose-300 animate-pulse" />
                  <span>{t('dash_welcome_student', 'Pelajar KaiwaDoJo')}</span>
                </span>
                {profile?.group_name && (
                  <span className="bg-white/15 backdrop-blur-md text-white text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border border-white/20">
                    Grup: {profile.group_name}
                  </span>
                )}
                <span className="bg-amber-400/20 backdrop-blur-md text-amber-200 text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  {t('dash_jlpt_n5_target', 'Target JLPT N5')}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
                {greetingJp}, {profile?.full_name || 'Pelajar'}!
              </h1>
              <p className="text-xs sm:text-sm text-white/80 font-medium mt-1">
                {greetingKanji} • Lanjutkan latihan percakapan bahasa Jepangmu hari ini dengan percaya diri.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            {announcements.length > 0 && (
              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-extrabold text-xs border border-white/30 backdrop-blur-md cursor-pointer transition-all flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 touch-manipulation min-h-[42px]"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>Pengumuman</span>
                {unreadAnnouncements.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 text-[0.62rem] font-black animate-pulse">
                    {unreadAnnouncements.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => navigate('/my-courses')}
              className="group px-4 py-2.5 rounded-2xl bg-white text-slate-900 font-extrabold hover:bg-slate-100 text-xs sm:text-sm border-none cursor-pointer shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 touch-manipulation min-h-[42px]"
            >
              <svg className="size-3.5 fill-current text-primary" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <span>{t('dash_continue_learning', 'Lanjut Belajar')}</span>
              <span className="size-4.5 rounded-full bg-slate-200 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <svg className="size-2.5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Papan Pengumuman Banner (if active announcements exist) */}
      {announcements.length > 0 && (
        <div
          onClick={() => setShowAnnouncementModal(true)}
          className="bg-gradient-to-r from-red-600/10 via-rose-500/5 to-amber-500/10 dark:from-red-950/40 dark:via-rose-950/20 dark:to-amber-950/30 rounded-3xl p-4 sm:p-5 border border-red-500/20 dark:border-red-800/40 shadow-xs mb-6 flex items-center justify-between gap-4 cursor-pointer hover:border-red-500/40 transition-all hover:shadow-md group"
        >
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  Papan Pengumuman Dojo
                </span>
                {unreadAnnouncements.length > 0 ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-xs animate-pulse">
                    {unreadAnnouncements.length} Belum Dibaca
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Terkini
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">
                {announcements[0]?.title || 'Klik untuk melihat informasi dan pembaruan resmi terbaru.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary dark:text-red-400 shrink-0 group-hover:translate-x-1 transition-transform">
            <span>Buka</span>
            <span className="size-4.5 rounded-full bg-primary/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <svg className="size-2.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      )}

      {/* Daily Mission Dashboard Widget */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">Misi Harian Hari Ini</h2>
                {missionProgress?.isFullyCompleted ? (
                  <span className="text-[0.65rem] font-black bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    <span>100% Selesai</span>
                  </span>
                ) : (
                  <span className="text-[0.65rem] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                    {missionProgress ? `${missionProgress.overallPct}% Progress` : 'Belum Dibuat'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {dailyMission
                  ? `Target: ${dailyMission.selectedVideos.length > 0 ? dailyMission.selectedVideos.map(v => `Bab ${v.bab} Part ${v.videoNum}`).join(', ') : 'Tanpa Video'} (${missionProgress?.targetReplays}x Replays) ${dailyMission.targetQuizCount > 0 ? `• ${dailyMission.targetQuizCount} Kuis` : ''} ${dailyMission.targetKotobaCount > 0 ? `• ${dailyMission.targetKotobaCount} Kotoba` : ''}`
                  : 'Buat misi harian kamu untuk mulai menambah streak sakura hari ini!'}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/learning-plan')}
            className="group px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shrink-0 flex items-center gap-1.5 touch-manipulation min-h-[38px]"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{dailyMission ? 'Ubah Misi' : 'Buat Misi'}</span>
          </button>
        </div>

        {dailyMission && missionProgress ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dailyMission.selectedVideos.length > 0 ? (
              dailyMission.selectedVideos.map((v, idx) => {
                const count = videoProgressMap.get(v.id) || 0
                const isVidDone = count >= 3
                return (
                  <button
                    key={v.id || idx}
                    onClick={() => navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group flex flex-col justify-between ${
                      isVidDone
                        ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-primary'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-white mb-1">
                        <span className="truncate pr-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <svg className="size-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          <span>Jilid {v.jilid} · Bab {v.bab} (Part {v.videoNum})</span>
                        </span>
                        <span className={isVidDone ? 'text-emerald-700 dark:text-emerald-400 font-extrabold shrink-0' : 'text-primary dark:text-red-400 font-bold shrink-0'}>
                          {count}/3x
                        </span>
                      </div>
                      <p className="text-[0.68rem] text-slate-400 mb-2 truncate">
                        {v.title}
                      </p>
                    </div>

                    <div>
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (count / 3) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[0.68rem] font-extrabold text-primary dark:text-red-400 flex items-center justify-between">
                        <span>Tonton Video</span>
                        <span className="size-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                          <svg className="size-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs flex flex-col justify-center">
                <span className="font-bold">Rencana Video</span>
                <span className="text-[0.68rem]">Tidak ada video yang direncanakan</span>
              </div>
            )}

            {/* Target Kuis Card */}
            {dailyMission.targetQuizCount > 0 ? (
              <button
                onClick={() => {
                  const targetBab = dailyMission.selectedVideos[0]?.bab || 1
                  const targetJilid = dailyMission.selectedVideos[0]?.jilid || 1
                  navigate(`/my-courses?jilid=${targetJilid}&bab=${targetBab}&item=4`)
                }}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group flex flex-col justify-between ${
                  missionProgress.quizCompleted
                    ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-500'
                }`}
              >
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-white mb-1">
                    <span className="group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      <svg className="size-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span>Kuis Evaluasi Bab</span>
                    </span>
                    <span className={missionProgress.quizCompleted ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-indigo-600 dark:text-indigo-400 font-bold'}>
                      {missionProgress.actualQuizzes}/{missionProgress.targetQuizzes}
                    </span>
                  </div>
                  <p className="text-[0.68rem] text-slate-400 mb-2">
                    Target: {missionProgress.targetQuizzes} kuis selesai
                  </p>
                </div>

                <div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (missionProgress.actualQuizzes / missionProgress.targetQuizzes) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[0.68rem] font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                    <span>Mulai Kuis</span>
                    <span className="size-4 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <svg className="size-2 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>
            ) : (
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs flex flex-col justify-center min-h-[100px]">
                <div className="font-extrabold text-slate-700 dark:text-slate-200 text-xs mb-1">Kuis Evaluasi Bab</div>
                <p className="text-[0.68rem] text-slate-400">Tidak ada kuis yang direncanakan</p>
              </div>
            )}

            {/* Target Kotoba Card */}
            {dailyMission.targetKotobaCount > 0 ? (
              <button
                onClick={() => navigate('/kotoba')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group flex flex-col justify-between ${
                  missionProgress.kotobaCompleted
                    ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-amber-500'
                }`}
              >
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-white mb-1">
                    <span className="group-hover:text-amber-600 transition-colors flex items-center gap-1.5">
                      <svg className="size-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                      <span>Setoran Kotoba</span>
                    </span>
                    <span className={missionProgress.kotobaCompleted ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                      {missionProgress.actualKotoba}/{missionProgress.targetKotoba}
                    </span>
                  </div>
                  <p className="text-[0.68rem] text-slate-400 mb-2">
                    Target: {missionProgress.targetKotoba} setoran selesai
                  </p>
                </div>

                <div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (missionProgress.actualKotoba / missionProgress.targetKotoba) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[0.68rem] font-extrabold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                    <span>Buka Setoran</span>
                    <span className="size-4 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <svg className="size-2 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>
            ) : (
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs flex flex-col justify-center min-h-[100px]">
                <div className="font-extrabold text-slate-700 dark:text-slate-200 text-xs mb-1">Setoran Kotoba</div>
                <p className="text-[0.68rem] text-slate-400">Tidak ada kotoba yang direncanakan</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center gap-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Kamu belum menyusun Misi Harian untuk hari ini.
            </p>
            <button
              onClick={() => navigate('/learning-plan')}
              className="group px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-all shadow-xs flex items-center gap-1.5 touch-manipulation min-h-[38px]"
            >
              <span>Susun Misi Harian</span>
              <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Streak Sakura & Embedded Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5 mb-6 items-stretch">
        <div className="flex flex-col gap-5">
          <StreakCard
            streakDays={stats.streakDays}
            history={streakHistory}
            isFreezeToday={isNoPlanMission(dailyMission)}
          />

          <div className="grid grid-cols-2 gap-3">
            {/* Shortcut 1: Jurnal Kosakata */}
            <button
              onClick={() => navigate('/kotoba')}
              className="bg-amber-500 text-white rounded-3xl p-4 sm:p-5 flex items-center gap-3 shadow-md cursor-pointer border-none transition-all hover:-translate-y-0.5 hover:shadow-xl text-left group touch-manipulation min-h-[72px]"
            >
              <span className="size-10 sm:size-11 rounded-2xl bg-amber-600/30 border border-amber-300/40 text-amber-100 flex items-center justify-center font-black text-xl shrink-0 font-serif shadow-xs">
                語
              </span>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black leading-tight">Jurnal Kosakata</div>
                <div className="text-white/80 text-[0.68rem] mt-0.5">Catatan Kotoba</div>
              </div>
              <span className="ml-auto size-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>

            {/* Shortcut 2: Reservasi Kelas */}
            <button
              onClick={() => navigate('/reservasi-kelas')}
              className="bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 rounded-3xl p-4 sm:p-5 flex items-center gap-3 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-sky-500 text-left group touch-manipulation min-h-[72px]"
            >
              <span className="size-10 sm:size-11 rounded-2xl bg-sky-500/10 dark:bg-sky-400/20 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-slate-800 dark:text-white leading-tight">Reservasi Kelas</div>
                <div className="text-slate-400 text-[0.68rem] mt-0.5">Live & Offline</div>
              </div>
              <span className="ml-auto size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                <svg className="size-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* Embedded Schedule View Card */}
        <div className="h-full">
          <EmbeddedUserScheduleCard userId={user?.id || ''} />
        </div>
      </div>

      {/* Progress Preview for Minna no Nihongo Jilid 1 & 2 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <svg className="size-4.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>{t('dash_book_progress_title', 'Progress Belajar Buku')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('dash_book_progress_sub', 'Minna no Nihongo Jilid 1 & 2 (Bab 1 - 50)')}</p>
          </div>
          <button
            onClick={() => navigate('/my-courses')}
            className="group text-primary dark:text-red-400 text-xs sm:text-sm font-bold bg-transparent border-none cursor-pointer flex items-center gap-1.5 touch-manipulation"
          >
            <span>{t('dash_open_course_btn', 'Buka Kursus')}</span>
            <span className="size-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <svg className="size-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Jilid 1 */}
          <div
            onClick={() => navigate('/my-courses')}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/60 cursor-pointer transition-all hover:border-primary hover:shadow-md flex flex-col gap-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Minna no Nihongo {t('dash_jilid_1_title', 'Jilid 1 (Dasar I)')}</h3>
                  <span className="text-[0.72rem] font-medium text-slate-500 dark:text-slate-300">{t('dash_jilid_1_desc', 'Bab 1 s/d Bab 25 • 75 Video & 50 Kuis')}</span>
                </div>
              </div>
              <span className="text-xs font-black text-primary dark:text-red-400 bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-xl">
                {bookProgress.jilid1Pct}%
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[0.7rem] text-slate-500 dark:text-slate-300 font-semibold mb-1">
                <span>Pencapaian: {bookProgress.jilid1DoneItems}/125 Selesai</span>
                <span>{bookProgress.jilid1Pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${bookProgress.jilid1Pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Jilid 2 */}
          <div
            onClick={() => navigate('/my-courses')}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 cursor-pointer transition-all hover:border-emerald-500 hover:shadow-md flex flex-col gap-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Minna no Nihongo {t('dash_jilid_2_title', 'Jilid 2 (Dasar II)')}</h3>
                  <span className="text-[0.72rem] font-medium text-slate-500 dark:text-slate-300">{t('dash_jilid_2_desc', 'Bab 26 s/d Bab 50 • 75 Video & 50 Kuis')}</span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-xl">
                {bookProgress.jilid2Pct}%
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[0.7rem] text-slate-500 dark:text-slate-300 font-semibold mb-1">
                <span>Pencapaian: {bookProgress.jilid2DoneItems}/125 Selesai</span>
                <span>{bookProgress.jilid2Pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-700"
                  style={{ width: `${bookProgress.jilid2Pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Announcement Pop-up Modal */}
      <AnnouncementModal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        announcements={unreadAnnouncements.length > 0 ? unreadAnnouncements : announcements}
        onMarkRead={(id) => {
          setUnreadAnnouncements(prev => prev.filter(a => a.id !== id))
        }}
        onMarkAllRead={() => {
          setUnreadAnnouncements([])
        }}
      />
    </main>
  )
}
