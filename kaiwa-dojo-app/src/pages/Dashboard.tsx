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
  saveDailyMission,
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
import DailyMissionBuilderModal from '../components/DailyMissionBuilderModal'

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

/* ── Sakura Blossom Visual Component (Enlarged, Highlighted & Animated) ── */
function SakuraBlossomVisual({
  streakDays,
  isFreeze,
  isMissionCompleted,
  sizeClass = 'size-24 sm:size-28',
}: {
  streakDays: number
  isFreeze: boolean
  isMissionCompleted?: boolean
  sizeClass?: string
}) {
  const celebrationClass = isMissionCompleted ? ' animate-growth-pulse' : ''

  if (isFreeze) {
    // Frost Sakura Flower with crystalline icy shimmer
    return (
      <div className={`relative ${sizeClass} flex items-center justify-center shrink-0${celebrationClass}`}>
        <div className="absolute inset-0 bg-sky-400/25 rounded-full blur-2xl animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-lg text-sky-400 animate-sakura-frost">
          <defs>
            <linearGradient id="icePetalGradLg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F0F9FF" />
              <stop offset="40%" stopColor="#BAE6FD" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>
          {/* Frost Petals */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 14 C42 26, 40 38, 50 50 C60 38, 58 26, 50 14 Z"
              fill="url(#icePetalGradLg)"
              stroke="#38BDF8"
              strokeWidth="1.3"
            />
          ))}
          {/* Snowflake center */}
          <circle cx="50" cy="50" r="8" fill="#F0F9FF" />
          <path d="M50 42 L50 58 M42 50 L58 50 M44 44 L56 56 M44 56 L56 44" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    )
  }

  if (streakDays >= 100) {
    // Golden Legendary Sakura (Stage 5)
    return (
      <div className={`relative ${sizeClass} flex items-center justify-center shrink-0${celebrationClass}`}>
        <div className="absolute inset-0 bg-amber-400/35 rounded-full blur-2xl animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-xl text-amber-400 animate-sakura-gold">
          <defs>
            <linearGradient id="goldPetalGradLg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="45%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          {/* Back layer petals */}
          {[36, 108, 180, 252, 324].map((angle, i) => (
            <path
              key={`bg-${i}`}
              transform={`rotate(${angle} 50 50)`}
              d="M50 16 C42 27, 40 38, 50 50 C60 38, 58 27, 50 16 Z"
              fill="#FDE68A"
              opacity="0.85"
            />
          ))}
          {/* Main 5 Golden Petals */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 8 C38 23, 36 38, 50 50 C64 38, 62 23, 50 8 Z"
              fill="url(#goldPetalGradLg)"
              stroke="#B45309"
              strokeWidth="1.5"
            />
          ))}
          <circle cx="50" cy="50" r="9.5" fill="#FFFBEB" />
          <circle cx="50" cy="50" r="5" fill="#B45309" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <circle
              key={i}
              cx={50 + 7.5 * Math.cos((angle * Math.PI) / 180)}
              cy={50 + 7.5 * Math.sin((angle * Math.PI) / 180)}
              r="1.5"
              fill="#FEF08A"
            />
          ))}
        </svg>
      </div>
    )
  }

  if (streakDays >= 30) {
    // Blooming Lush Mankai Sakura Cluster (Stage 4)
    return (
      <div className={`relative ${sizeClass} flex items-center justify-center shrink-0${celebrationClass}`}>
        <div className="absolute inset-0 bg-rose-500/25 rounded-full blur-2xl animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-lg animate-sakura-petal-drift">
          <defs>
            <linearGradient id="rosePetalGradLg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF1F2" />
              <stop offset="45%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>
          {/* Secondary Layer Petals (Behind) */}
          {[36, 108, 180, 252, 324].map((angle, i) => (
            <path
              key={`bg-${i}`}
              transform={`rotate(${angle} 50 50)`}
              d="M50 16 C42 27, 40 38, 50 50 C60 38, 58 27, 50 16 Z"
              fill="#FDA4AF"
              opacity="0.8"
            />
          ))}
          {/* Main 5 Petals */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 10 C38 24, 36 38, 50 50 C64 38, 62 24, 50 10 Z"
              fill="url(#rosePetalGradLg)"
              stroke="#BE123C"
              strokeWidth="1.2"
            />
          ))}
          <circle cx="50" cy="50" r="9" fill="#FFF1F2" />
          <circle cx="50" cy="50" r="4.5" fill="#9F1239" />
          {/* Golden Stamens */}
          {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((angle, i) => (
            <circle
              key={i}
              cx={50 + 7.5 * Math.cos((angle * Math.PI) / 180)}
              cy={50 + 7.5 * Math.sin((angle * Math.PI) / 180)}
              r="1.4"
              fill="#FDE047"
            />
          ))}
          {/* Floating Loose Petal */}
          <path
            d="M84 28 C80 26, 77 31, 80 36 C85 35, 87 31, 84 28 Z"
            fill="#FB7185"
            className="animate-sakura"
          />
        </svg>
      </div>
    )
  }

  if (streakDays >= 7) {
    // Full 5-Petal Kaika Sakura (Stage 3)
    return (
      <div className={`relative ${sizeClass} flex items-center justify-center shrink-0${celebrationClass}`}>
        <div className="absolute inset-0 bg-pink-500/20 rounded-full blur-xl animate-pulse" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-md animate-sakura-bloom-float">
          <defs>
            <linearGradient id="pinkPetalGradLg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDF2F8" />
              <stop offset="40%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#DB2777" />
            </linearGradient>
          </defs>
          {/* 5 Petals */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path
              key={i}
              transform={`rotate(${angle} 50 50)`}
              d="M50 12 C40 25, 38 38, 50 50 C62 38, 60 25, 50 12 Z"
              fill="url(#pinkPetalGradLg)"
              stroke="#DB2777"
              strokeWidth="1.2"
            />
          ))}
          <circle cx="50" cy="50" r="8" fill="#FFF1F2" />
          <circle cx="50" cy="50" r="4.5" fill="#BE185D" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <circle
              key={i}
              cx={50 + 6.5 * Math.cos((angle * Math.PI) / 180)}
              cy={50 + 6.5 * Math.sin((angle * Math.PI) / 180)}
              r="1.2"
              fill="#FDE047"
            />
          ))}
        </svg>
      </div>
    )
  }

  if (streakDays >= 3) {
    // Sakura Bud on Young Branch (Stage 2)
    return (
      <div className={`relative ${sizeClass} flex items-center justify-center shrink-0${celebrationClass}`}>
        <div className="absolute inset-0 bg-pink-400/20 rounded-full blur-xl" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-md animate-sakura-pulse-soft">
          <defs>
            <linearGradient id="branchGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#5B290B" />
              <stop offset="100%" stopColor="#854D0E" />
            </linearGradient>
            <linearGradient id="budGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#DB2777" />
              <stop offset="60%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#FCE7F3" />
            </linearGradient>
          </defs>
          {/* Strong Branch */}
          <path d="M50 85 C50 68, 47 55, 50 46" stroke="url(#branchGrad)" strokeWidth="5" strokeLinecap="round" />
          <path d="M50 64 C56 58, 64 54, 68 50" stroke="url(#branchGrad)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="68" cy="50" r="3" fill="#22C55E" />
          {/* Calyx Leaves */}
          <path d="M42 52 C46 47, 54 47, 58 52 C55 60, 45 60, 42 52 Z" fill="#15803D" stroke="#14532D" strokeWidth="1" />
          <path d="M36 50 C42 46, 48 50, 45 56 Z" fill="#16A34A" />
          <path d="M64 50 C58 46, 52 50, 55 56 Z" fill="#16A34A" />
          {/* Swelling Pink Petal Bud */}
          <path d="M50 20 C38 32, 38 46, 50 50 C62 46, 62 32, 50 20 Z" fill="url(#budGrad)" stroke="#DB2777" strokeWidth="1.2" />
          <path d="M45 24 C40 34, 44 44, 50 48 C45 42, 44 32, 45 24 Z" fill="#FB7185" opacity="0.8" />
          <path d="M55 24 C60 34, 56 44, 50 48 C55 42, 56 32, 55 24 Z" fill="#F472B6" opacity="0.6" />
        </svg>
      </div>
    )
  }

  if (streakDays >= 1) {
    // Tender Green Sprout with Pink Tip (Stage 1)
    return (
      <div className={`relative ${sizeClass} flex items-center justify-center shrink-0${celebrationClass}`}>
        <div className="absolute inset-0 bg-emerald-500/15 rounded-full blur-xl" />
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-md animate-sakura-sway">
          <defs>
            <linearGradient id="stemGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#78350F" />
              <stop offset="70%" stopColor="#15803D" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
            <linearGradient id="leafGradLeft" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#16A34A" />
              <stop offset="100%" stopColor="#86EFAC" />
            </linearGradient>
            <linearGradient id="leafGradRight" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#16A34A" />
              <stop offset="100%" stopColor="#4ADE80" />
            </linearGradient>
          </defs>
          {/* Soil Base */}
          <ellipse cx="50" cy="84" rx="26" ry="8" fill="#78350F" opacity="0.25" />
          {/* Young Stem */}
          <path d="M50 82 C50 68, 49 52, 50 40" stroke="url(#stemGrad)" strokeWidth="4.5" strokeLinecap="round" />
          {/* Left Leaf */}
          <path d="M50 56 C38 52, 30 42, 34 32 C42 34, 48 46, 50 56 Z" fill="url(#leafGradLeft)" stroke="#15803D" strokeWidth="1" />
          {/* Right Leaf */}
          <path d="M50 50 C62 46, 70 36, 66 26 C58 28, 52 40, 50 50 Z" fill="url(#leafGradRight)" stroke="#15803D" strokeWidth="1" />
          {/* Tender Sakura Bud Tip */}
          <path d="M50 40 C46 32, 46 22, 50 18 C54 22, 54 32, 50 40 Z" fill="#F472B6" stroke="#DB2777" strokeWidth="1" />
          <circle cx="50" cy="18" r="2.5" fill="#FDA4AF" />
        </svg>
      </div>
    )
  }

  // Seed / Starting (Stage 0)
  return (
    <div className={`relative ${sizeClass} flex items-center justify-center shrink-0${celebrationClass}`}>
      <div className="absolute inset-0 bg-amber-600/10 dark:bg-amber-500/15 rounded-full blur-xl" />
      <svg viewBox="0 0 100 100" className="size-full drop-shadow-md animate-sakura-breathe">
        <defs>
          <radialGradient id="seedGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#A16207" />
            <stop offset="60%" stopColor="#78350F" />
            <stop offset="100%" stopColor="#451A03" />
          </radialGradient>
          <linearGradient id="seedSproutGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
        </defs>
        {/* Rich Soil mound */}
        <ellipse cx="50" cy="74" rx="32" ry="12" fill="#713F12" opacity="0.3" />
        <path d="M24 74 Q50 66 76 74 Q50 80 24 74 Z" fill="#92400E" opacity="0.45" />
        {/* Seed Body */}
        <path
          d="M50 32 C34 44, 32 64, 50 72 C68 64, 66 44, 50 32 Z"
          fill="url(#seedGrad)"
          stroke="#451A03"
          strokeWidth="1.5"
        />
        <path d="M48 40 Q44 54 48 66" stroke="#B45309" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        {/* Emerging Tiny Tender Sprout from Seed Tip */}
        <path
          d="M50 34 C47 24, 42 20, 48 14 C52 20, 52 26, 50 34 Z"
          fill="url(#seedSproutGrad)"
          stroke="#15803D"
          strokeWidth="1"
        />
        <circle cx="48" cy="14" r="2" fill="#F472B6" />
      </svg>
    </div>
  )
}

/* ── Sakura Ring Progress Bar (Circular Bar Chart around Flower) ── */
function SakuraRingProgressBar({
  streakDays,
  isFreeze,
  dailyMission,
  missionProgress,
  onClick,
}: {
  streakDays: number
  isFreeze: boolean
  dailyMission?: DailyMissionData | null
  missionProgress?: MissionProgress | null
  onClick?: () => void
}) {
  const [lastNonZeroPct, setLastNonZeroPct] = useState(0)

  useEffect(() => {
    if (missionProgress && typeof missionProgress.overallPct === 'number' && missionProgress.overallPct > 0) {
      setLastNonZeroPct(missionProgress.overallPct)
    }
  }, [missionProgress])

  const pct = dailyMission && missionProgress
    ? Math.min(100, Math.max(0, missionProgress.overallPct))
    : (dailyMission && lastNonZeroPct > 0 ? lastNonZeroPct : 0)
  const isCompleted = pct >= 100 || (missionProgress?.isFullyCompleted ?? false)

  // Circular progress calculations (Radius = 68, circumference = 2 * PI * 68 ≈ 427.26)
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (pct / 100) * circumference

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center justify-center cursor-pointer select-none group"
      title="Klik untuk melihat tahapan mekar Sakura"
    >
      {/* Outer wrapper sizing */}
      <div className="relative size-36 sm:size-42 flex items-center justify-center">
        {/* If completed: Expanding Aura Halo Ring */}
        {isCompleted && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/20 via-teal-400/25 to-emerald-500/10 blur-xl animate-ring-aura pointer-events-none" />
        )}

        {/* Circular Progress SVG */}
        <svg
          viewBox="0 0 160 160"
          className="size-full -rotate-90 drop-shadow-sm"
        >
          <defs>
            {/* Sakura Pink Gradient */}
            <linearGradient id="ringSakuraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="50%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>

            {/* 100% Growth Emerald Gradient */}
            <linearGradient id="ringGrowthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Ice Frost Gradient */}
            <linearGradient id="ringIceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="7"
            className="text-slate-100 dark:text-slate-800"
          />

          {/* Active Circular Progress Arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke={
              isFreeze
                ? 'url(#ringIceGrad)'
                : isCompleted
                ? 'url(#ringGrowthGrad)'
                : 'url(#ringSakuraGrad)'
            }
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Centered Sakura Flower Visual */}
        <div className={`absolute inset-0 flex items-center justify-center transition-transform group-hover:scale-105 active:scale-95 ${
          isCompleted ? 'animate-growth-pulse' : ''
        }`}>
          <SakuraBlossomVisual
            streakDays={streakDays}
            isFreeze={isFreeze}
            isMissionCompleted={isCompleted}
            sizeClass="size-24 sm:size-28"
          />
        </div>

        {/* 100% Mission Sparkles celebration around the ring */}
        {isCompleted && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Sparkle 1 Top-Left */}
            <span className="absolute top-2 left-4 text-emerald-500 font-bold text-xs sm:text-sm animate-sparkle-1 select-none">
              ✦
            </span>
            {/* Sparkle 2 Top-Right */}
            <span className="absolute top-1.5 right-4 text-amber-400 font-bold text-xs sm:text-sm animate-sparkle-2 select-none">
              ✧
            </span>
            {/* Sparkle 3 Bottom-Right */}
            <span className="absolute bottom-5 right-2 text-teal-400 font-bold text-xs sm:text-sm animate-sparkle-3 select-none">
              ✦
            </span>
            {/* Sparkle 4 Bottom-Left */}
            <span className="absolute bottom-5 left-2 text-emerald-400 font-bold text-xs sm:text-sm animate-sparkle-1 select-none">
              ✧
            </span>
            {/* Sparkle 5 Center-Top */}
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-xs sm:text-sm animate-sparkle-2 select-none">
              ✦
            </span>
          </div>
        )}

        {/* Circular Progress Percentage Pill at Bottom of Ring */}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 shrink-0 z-20">
          {isCompleted ? (
            <div className="bg-emerald-500 text-white font-extrabold text-xs sm:text-sm px-3 py-1 rounded-full shadow-md flex items-center gap-1 border border-emerald-300 animate-pulse whitespace-nowrap">
              <span>✦</span>
              <span>100% Selesai</span>
            </div>
          ) : pct > 0 ? (
            <div className="bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-extrabold text-xs sm:text-sm px-2.5 py-0.5 rounded-full shadow-xs border border-rose-200 dark:border-rose-900/60 whitespace-nowrap">
              {pct}% Misi
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm px-2.5 py-0.5 rounded-full shadow-xs border border-slate-200 dark:border-slate-700 whitespace-nowrap">
              0% Misi
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── StreakCard Component (Sakura Blossom Dojo) ─────────── */
function StreakCard({
  streakDays,
  history,
  isFreezeToday,
  dailyMission,
  missionProgress,
  onOpenMissionModal,
}: {
  streakDays: number
  history: StreakDayHistory[]
  isFreezeToday?: boolean
  dailyMission?: DailyMissionData | null
  missionProgress?: MissionProgress | null
  onOpenMissionModal?: () => void
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
    <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 sm:p-4.5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3 sm:gap-3.5 h-full relative overflow-hidden">
      {/* Decorative ambient Sakura glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6.5 sm:size-7.5 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
            <svg className="size-3.5 sm:size-4" viewBox="0 0 24 24" fill="currentColor">
              {[0, 72, 144, 216, 288].map(deg => (
                <path
                  key={deg}
                  transform={`rotate(${deg} 12 12)`}
                  d="M12 2.8 C10 6.2, 9.6 9.5, 12 12 C14.4 9.5, 14 6.2, 12 2.8 Z"
                />
              ))}
              <circle cx="12" cy="12" r="2.2" className="fill-white dark:fill-slate-900" />
              <circle cx="12" cy="12" r="1.1" className="fill-rose-500" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight truncate">
              {sakuraInfo.stageName}
            </h2>
            <span className="text-xs sm:text-sm text-slate-400 font-medium block truncate">
              {sakuraInfo.japaneseName} • {streakDays} Hari Konsisten
            </span>
          </div>
        </div>

        {/* Level pill badge removed per user request */}
      </div>

      {/* Sakura Blossom Visualizer + Circular Progress Ring + 7-Day History */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 relative z-10">
        {/* Animated Sakura Visual + Ring Progress */}
        <div className="flex flex-col items-center shrink-0">
          <SakuraRingProgressBar
            streakDays={streakDays}
            isFreeze={isTodayFreeze}
            dailyMission={dailyMission}
            missionProgress={missionProgress}
            onClick={() => setShowSakuraModal(true)}
          />
          <div className={`text-sm sm:text-base font-black leading-none mt-1 tracking-tight ${sakuraInfo.colorClass}`}>
            {streakDays}
          </div>
          <div className="text-xs sm:text-sm text-slate-400 font-bold mt-0.5 text-center whitespace-nowrap">
            Hari Konsisten
          </div>
        </div>

        {/* 7-Day History & Progress */}
        <div className="flex-1 min-w-0 w-full">
          {/* 7-Day Dots with mini Sakura blossoms */}
          <div className="flex gap-1 sm:gap-1.5 mb-2 sm:mb-2.5">
            {history.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                <div
                  className={`w-full aspect-square max-w-[22px] sm:max-w-[28px] rounded-full flex items-center justify-center transition-all ${
                    item.done
                      ? item.isFreeze
                        ? 'bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-xs ring-1 ring-sky-200 dark:ring-sky-900'
                        : 'bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-xs ring-1 ring-rose-200 dark:ring-rose-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                  }`}
                  title={`${dayLabels[i]}: ${item.done ? (item.isFreeze ? 'Istirahat (Freeze)' : 'Misi Selesai') : 'Belum selesai'}`}
                >
                  {item.done ? (
                    item.isFreeze ? (
                      <svg className="size-2.5 sm:size-3 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2v20m-10-10h20m-17-7l14 14m0-14L5 19" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg className="size-2.5 sm:size-3 fill-current" viewBox="0 0 24 24">
                        <path d="M12 3c-1.5 2-2 4-1 6 2-1 4-1 5 1 1-2 3-2 5-1-1-2-2-4-4-5-2 1-4 1-5-1zm-4 6c-2 1-4 1-5-1 1 2 2 4 4 5 2-1 4-1 5 1-1-2-1-4-2-5-1 0-2 0-2 0zm10 7c2-1 4-1 5 1-1-2-2-4-4-5-2 1-4 1-5-1 1 2 1 4 2 5 1 0 2 0 2 0zm-8 4c1 2 2 4 4 5 2-1 4-1 5 1 1-2 2-4 1-6-2 1-4 1-5-1-1 0-2 0-2 1z" />
                      </svg>
                    )
                  ) : (
                    <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  )}
                </div>
                <span className="text-xs sm:text-sm text-slate-400 font-bold mt-1">{dayLabels[i]}</span>
              </div>
            ))}
          </div>

          {/* Progress Bar to Next Sakura Milestone */}
          <div>
            <div className="flex justify-between text-xs sm:text-sm font-semibold mb-1">
              <span className="text-slate-500 dark:text-slate-400 truncate">
                Target {nextMilestone} Hari
              </span>
              <span className={`font-black shrink-0 ${sakuraInfo.colorClass}`}>
                {streakDays}/{nextMilestone}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
          <div className="flex gap-1.5 mt-2">
            {milestones.map(m => (
              <div
                key={m.days}
                className={`flex-1 py-1 px-1.5 rounded-lg text-center text-xs sm:text-sm font-bold border transition-all ${
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
        className={`p-3 rounded-xl text-xs sm:text-sm font-medium border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          isTodayFreeze
            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
            : todayDone
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-current animate-pulse shrink-0" />
          <span className="leading-snug">
            {isTodayFreeze
              ? 'Hari istirahat terencana (Cap Biru). Streak aman bertambah.'
              : todayDone
              ? 'Misi hari ini telah selesai! Sakura mekar indah.'
              : 'Selesaikan misi hari ini agar sakura tetap mekar.'}
          </span>
        </div>

        {!todayDone && !isTodayFreeze && (
          <button
            onClick={() => onOpenMissionModal ? onOpenMissionModal() : navigate('/learning-plan')}
            className="group px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm rounded-xl border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 self-stretch sm:self-auto touch-manipulation min-h-[30px]"
          >
            <span>Susun Misi Hari Ini</span>
            <span className="size-3.5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <svg className="size-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* Interactive Sakura Evolution Info Modal */}
      <SakuraEvolutionModal isOpen={showSakuraModal} onClose={() => setShowSakuraModal(false)} />
    </div>
  )
}

/* ── Sakura Evolution Info Modal ────────────────────────────── */
function SakuraEvolutionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[999] animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl flex flex-col gap-3.5 sm:gap-4 animate-scale-up">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-rose-500" />
            <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
              Tahapan Pertumbuhan Pohon Sakura
            </h3>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center font-bold text-xs sm:text-sm"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Di kaiwadojo, konsistensi belajar diibaratkan pohon sakura yang bertumbuh semakin megah seiring bertambahnya streak Anda:
        </p>

        <div className="space-y-2 text-xs sm:text-sm">
          <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-extrabold text-slate-800 dark:text-white">0 Hari</div>
              <div className="text-xs sm:text-sm text-slate-400">Benih Bunga Sakura</div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 font-bold text-xs sm:text-sm">Tahap 0</span>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-extrabold text-slate-800 dark:text-white">1 - 2 Hari</div>
              <div className="text-xs sm:text-sm text-slate-400">Tunas Bunga Sakura</div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-xs sm:text-sm">Tahap 1</span>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-extrabold text-slate-800 dark:text-white">3 - 6 Hari</div>
              <div className="text-xs sm:text-sm text-slate-400">Pohon Muda Sakura</div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-600 font-bold text-xs sm:text-sm">Tahap 2</span>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-extrabold text-slate-800 dark:text-white">7 - 29 Hari</div>
              <div className="text-xs sm:text-sm text-slate-400">Pohon Sakura Mekar (Kaika)</div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 font-bold text-xs sm:text-sm">Tahap 3</span>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-extrabold text-slate-800 dark:text-white">30 - 99 Hari</div>
              <div className="text-xs sm:text-sm text-slate-400">Pohon Sakura Rimbun (Mankai)</div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 font-bold text-xs sm:text-sm">Tahap 4</span>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <div>
              <div className="font-extrabold text-amber-900 dark:text-amber-200">100+ Hari</div>
              <div className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">Pohon Sakura Abadi</div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-bold text-xs sm:text-sm">Master</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 sm:py-2.5 bg-primary text-white font-bold rounded-xl text-xs sm:text-sm border-none cursor-pointer mt-1"
        >
          Mengerti
        </button>
      </div>
    </div>
  )
}

/* ── Unified Mobile Card: Sakura Blossom + Daily Mission (per contoh mockup) ── */
interface UnifiedMobileSakuraMissionCardProps {
  streakDays: number
  history: StreakDayHistory[]
  isFreezeToday?: boolean
  dailyMission: DailyMissionData | null
  missionProgress: MissionProgress | null
  videoProgressMap: Map<string, number>
  onOpenMissionModal?: () => void
}

function UnifiedMobileSakuraMissionCard({
  streakDays,
  history,
  isFreezeToday,
  dailyMission,
  missionProgress,
  videoProgressMap,
  onOpenMissionModal,
}: UnifiedMobileSakuraMissionCardProps) {
  const navigate = useNavigate()
  const dayLabels = getLast7DayLabels()
  const todayItem = history[history.length - 1]
  const todayDone = todayItem?.done || false
  const isTodayFreeze = isFreezeToday || todayItem?.isFreeze || false

  const sakuraInfo = getSakuraStage(streakDays, isTodayFreeze)
  const [showSakuraModal, setShowSakuraModal] = useState(false)
  const isMissionDone = missionProgress?.isFullyCompleted ?? false

  const hasVideos = (dailyMission?.selectedVideos?.length ?? 0) > 0
  const hasQuizzes = (dailyMission?.targetQuizCount ?? 0) > 0
  const hasKotoba = (dailyMission?.targetKotobaCount ?? 0) > 0
  const hasAnyMission = Boolean(dailyMission && (hasVideos || hasQuizzes || hasKotoba))

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3.5 sm:gap-4 relative overflow-hidden">
      {/* Ambient pink aura glow */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-64 h-64 bg-rose-500/8 dark:bg-rose-500/12 rounded-full blur-3xl pointer-events-none" />

      {/* ── TOP HEADER: Stage Title ── */}
      <div className="flex items-center justify-between relative z-10 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              {[0, 72, 144, 216, 288].map(deg => (
                <path
                  key={deg}
                  transform={`rotate(${deg} 12 12)`}
                  d="M12 2.8 C10 6.2, 9.6 9.5, 12 12 C14.4 9.5, 14 6.2, 12 2.8 Z"
                />
              ))}
              <circle cx="12" cy="12" r="2.2" className="fill-white dark:fill-slate-900" />
              <circle cx="12" cy="12" r="1.1" className="fill-rose-500" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight truncate">
              {sakuraInfo.stageName}
            </h2>
            <span className="text-xs sm:text-sm text-slate-400 font-medium block truncate">
              {sakuraInfo.japaneseName} • {streakDays} Hari Konsisten
            </span>
          </div>
        </div>
      </div>

      {/* ── CENTER: Sakura Flower Illustration + Circular Mission Progress Ring ── */}
      <div className="flex flex-col items-center justify-center py-2 relative z-10">
        <SakuraRingProgressBar
          streakDays={streakDays}
          isFreeze={isTodayFreeze}
          dailyMission={dailyMission}
          missionProgress={missionProgress}
          onClick={() => setShowSakuraModal(true)}
        />
        
        {/* Streak & Status Message */}
        <div className="mt-2.5 flex flex-col items-center text-center">
          <div className={`text-sm sm:text-base font-black leading-none tracking-tight ${sakuraInfo.colorClass}`}>
            {streakDays} <span className="text-xs sm:text-sm font-bold text-slate-400">Hari Berturut-turut</span>
          </div>

          {isMissionDone ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span>✦</span>
              <span>Pohon makin tumbuh hari ini!</span>
              <span>✦</span>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1.5 max-w-xs leading-relaxed">
              {isTodayFreeze
                ? 'Hari istirahat terencana (Freeze). Streak kamu tetap aman.'
                : todayDone
                ? 'Misi hari ini telah selesai! Sakura mekar indah.'
                : 'Selesaikan misi harian agar sakura tetap mekar.'}
            </p>
          )}
        </div>
      </div>

      {/* ── MIDDLE: 7-Day History Dots in Rounded Bar ── */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 px-3 flex items-center justify-between gap-1 border border-slate-100 dark:border-slate-800 relative z-10">
        {history.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className={`size-7 rounded-full flex items-center justify-center transition-all ${
                item.done
                  ? item.isFreeze
                    ? 'bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-xs'
                    : 'bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-xs'
                  : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-400'
              }`}
              title={`${dayLabels[i]}: ${item.done ? (item.isFreeze ? 'Istirahat (Freeze)' : 'Misi Selesai') : 'Belum selesai'}`}
            >
              {item.done ? (
                item.isFreeze ? (
                  <svg className="size-3 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2v20m-10-10h20m-17-7l14 14m0-14L5 19" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="size-3 fill-current" viewBox="0 0 24 24">
                    <path d="M12 3c-1.5 2-2 4-1 6 2-1 4-1 5 1 1-2 3-2 5-1-1-2-2-4-4-5-2 1-4 1-5-1zm-4 6c-2 1-4 1-5-1 1 2 2 4 4 5 2-1 4-1 5 1-1-2-1-4-2-5-1 0-2 0-2 0zm10 7c2-1 4-1 5 1-1-2-2-4-4-5-2 1-4 1-5-1 1 2 1 4 2 5 1 0 2 0 2 0zm-8 4c1 2 2 4 4 5 2-1 4-1 5 1 1-2 2-4 1-6-2 1-4 1-5-1-1 0-2 0-2 1z" />
                  </svg>
                )
              ) : (
                <span className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              )}
            </div>
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold">{dayLabels[i]}</span>
          </div>
        ))}
      </div>

      {/* ── BOTTOM: Daily Mission Task Bars ── */}
      <div className="flex flex-col gap-2.5 relative z-10 pt-1">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight truncate">
            Misi Harian Hari Ini
          </h2>

          {hasAnyMission && onOpenMissionModal && (
            <button
              type="button"
              onClick={onOpenMissionModal}
              className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all flex items-center justify-center shrink-0 hover:text-primary dark:hover:text-primary-light"
              title="Edit Misi Harian"
              aria-label="Edit Misi Harian"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {hasAnyMission && missionProgress ? (
          <div className="flex flex-col gap-2.5">
            {/* Task Bar 1: Video Tata Bahasa / Materi */}
            {dailyMission!.selectedVideos.map((v, idx) => {
              const count = videoProgressMap.get(v.id) || 0
              const isVidDone = count >= 3
              return (
                <div
                  key={v.id || idx}
                  onClick={() => navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] flex flex-col gap-2 ${
                    isVidDone
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isVidDone ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary'
                      }`}>
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">
                          Bab {v.bab} (Part {v.videoNum})
                        </h4>
                        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium block truncate">
                          {v.title || 'Materi Video Minna no Nihongo'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs sm:text-sm font-extrabold shrink-0 px-2.5 py-1 rounded-lg ${
                      isVidDone
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {count}/3 Replays
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (count / 3) * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}

            {/* Task Bar 2: Kuis Evaluasi Bab */}
            {dailyMission!.targetQuizCount > 0 && (
              <div
                onClick={() => navigate('/my-courses')}
                className={`p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] flex flex-col gap-2 ${
                  missionProgress.quizCompleted
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                      missionProgress.quizCompleted ? 'bg-emerald-500 text-white' : 'bg-indigo-500/10 text-indigo-500'
                    }`}>
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">
                        Kuis Evaluasi Bab
                      </h4>
                      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium block truncate">
                        Target: {missionProgress.targetQuizzes} Kuis Selesai
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs sm:text-sm font-extrabold shrink-0 px-2.5 py-1 rounded-lg ${
                    missionProgress.quizCompleted
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {missionProgress.actualQuizzes}/{missionProgress.targetQuizzes}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (missionProgress.actualQuizzes / missionProgress.targetQuizzes) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Task Bar 3: Setoran Kotoba */}
            {dailyMission!.targetKotobaCount > 0 && (
              <div
                onClick={() => navigate('/kotoba')}
                className={`p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] flex flex-col gap-2 ${
                  missionProgress.kotobaCompleted
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`size-8 rounded-lg flex items-center justify-center font-serif font-bold text-xs sm:text-sm shrink-0 ${
                      missionProgress.kotobaCompleted ? 'bg-emerald-500 text-white' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      語
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">
                        Setoran Kosakata (Kotoba)
                      </h4>
                      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium block truncate">
                        Target: {missionProgress.targetKotoba} Kosakata Disetor
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs sm:text-sm font-extrabold shrink-0 px-2.5 py-1 rounded-lg ${
                    missionProgress.kotobaCompleted
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {missionProgress.actualKotoba}/{missionProgress.targetKotoba}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (missionProgress.actualKotoba / missionProgress.targetKotoba) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center gap-2.5">
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Kamu belum menyusun Misi Harian untuk hari ini.
            </p>
            <button
              type="button"
              onClick={() => onOpenMissionModal ? onOpenMissionModal() : navigate('/learning-plan')}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs flex items-center gap-2 active:scale-95 touch-manipulation"
            >
              <svg className="size-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Susun Misi Hari Ini</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Sakura Evolution Info Modal */}
      <SakuraEvolutionModal isOpen={showSakuraModal} onClose={() => setShowSakuraModal(false)} />
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

function EmbeddedUserScheduleCard({
  userId,
  onOpenMissionModal,
}: {
  userId: string
  onOpenMissionModal?: () => void
}) {
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

    let updateTimer: any = null
    const handleUpdate = () => {
      if (updateTimer) clearTimeout(updateTimer)
      updateTimer = setTimeout(() => {
        loadSchedulesAndMissions()
      }, 300)
    }

    window.addEventListener(DAILY_MISSION_UPDATE_EVENT, handleUpdate)
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleUpdate)
    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      if (updateTimer) clearTimeout(updateTimer)
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
    <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-2.5 sm:gap-3 h-full min-h-0">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <svg className="size-3.5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight truncate">
                Jadwal & Agenda Saya
              </h2>
            </div>
          </div>

          <button
            onClick={() => navigate('/learning-plan')}
            title="Lihat Kalender"
            aria-label="Lihat Kalender"
            className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shrink-0 hover:text-primary dark:hover:text-primary-light"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Scrollable Timeline List */}
        {loading ? (
          <div className="py-6 text-center text-xs sm:text-sm text-slate-400">Memuat linimasa jadwalku...</div>
        ) : displayedTimeline.length === 0 ? (
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-400 text-center flex flex-col items-center gap-2.5 flex-1 justify-center">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Belum ada agenda belajar atau kelas terjadwal mulai hari ini.</span>
            <button
              onClick={onOpenMissionModal || (() => navigate('/learning-plan'))}
              className="group px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold border-none cursor-pointer transition-all text-xs sm:text-sm shadow-xs flex items-center gap-1.5 min-h-[30px]"
            >
              <span>Susun Misi Hari Ini</span>
              <span className="size-3.5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <svg className="size-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 max-h-[260px] sm:max-h-[300px]">
            {displayedTimeline.map(item => {
              const isToday = item.date === todayStr
              const relLabel = getRelativeDayLabel(item.date, todayStr)

              if (item.type === 'mission') {
                const m = item.mission
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedScheduleItem(item)}
                    className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all hover:border-amber-500 flex flex-col gap-1 group ${
                      isToday
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-800 ring-1 ring-amber-300/30 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        <span className="text-xs sm:text-sm">Misi Harian</span>
                        {isToday ? (
                          <span className="text-xs sm:text-sm bg-amber-500 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                            Hari Ini
                          </span>
                        ) : relLabel === 'Besok' ? (
                          <span className="text-xs sm:text-sm bg-sky-500 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                            Besok
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold group-hover:text-amber-600 transition-colors">
                        {formatIndonesianFullDate(item.date)}
                      </span>
                    </div>

                    <div className="font-bold text-slate-800 dark:text-white truncate text-xs sm:text-sm">
                      {m.selectedVideos.length > 0
                        ? m.selectedVideos.map(v => `Bab ${v.bab} (Part ${v.videoNum})`).join(', ')
                        : 'Misi Mandiri Non-Video'}
                    </div>

                    <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
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
                    className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 group ${
                      isToday
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 dark:border-sky-700 ring-1 ring-sky-300/30 shadow-xs'
                        : sch.type === 'online'
                          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100 hover:border-sky-400'
                          : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-sky-500" />
                        <span className="text-xs sm:text-sm">{sch.type === 'online' ? 'Kelas Online' : 'Kelas Offline'}</span>
                        {isToday ? (
                          <span className="text-xs sm:text-sm bg-sky-600 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                            Hari Ini
                          </span>
                        ) : relLabel === 'Besok' ? (
                          <span className="text-xs sm:text-sm bg-sky-500 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                            Besok
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold">
                        {formatIndonesianFullDate(sch.date)} ({sch.start_time} WIB)
                      </span>
                    </div>

                    <div className="font-bold truncate text-slate-800 dark:text-white text-xs sm:text-sm">
                      {sch.title}
                    </div>

                    <div className="text-xs sm:text-sm opacity-80 flex items-center justify-between">
                      <span>Sensei: {sch.instructor_name || sch.instructor || 'Sensei Dojo'}</span>
                      <span className="font-bold px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/60">
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[999] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-sm sm:max-w-md w-full p-4 sm:p-6 shadow-2xl flex flex-col gap-3.5 sm:gap-4 animate-scale-up">
            <div className="flex justify-between items-start pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400">
                  {selectedScheduleItem.type === 'mission' ? 'Detail Misi Mandiri' : 'Detail Kelas Live'}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-snug mt-0.5">
                  {selectedScheduleItem.type === 'mission'
                    ? `Misi Harian (${selectedScheduleItem.date})`
                    : selectedScheduleItem.schedule.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedScheduleItem(null)}
                className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 font-bold border-none cursor-pointer flex items-center justify-center text-xs sm:text-sm"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedScheduleItem.type === 'mission' ? (
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl sm:rounded-2xl border border-amber-200 dark:border-amber-900 flex flex-col gap-1">
                  <div className="font-extrabold text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                    Tanggal Pelaksanaan: {formatIndonesianFullDate(selectedScheduleItem.date)}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs sm:text-sm">
                    Rencana belajar mandiri harian yang telah kamu susun untuk menguji pemahaman dan menjaga streak belajarmu.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-extrabold text-slate-800 dark:text-white text-xs sm:text-sm">Video Pembelajaran:</div>
                  {selectedScheduleItem.mission.selectedVideos.length > 0 ? (
                    selectedScheduleItem.mission.selectedVideos.map((v: any, idx: number) => (
                      <div key={v.id || idx} className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-white truncate text-xs sm:text-sm">
                            Jilid {v.jilid} · Bab {v.bab} (Part {v.videoNum})
                          </div>
                          <div className="text-xs sm:text-sm text-slate-400 truncate">{v.title}</div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedScheduleItem(null)
                            navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)
                          }}
                          className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg sm:rounded-xl text-xs sm:text-sm border-none cursor-pointer shrink-0 transition-all shadow-xs"
                        >
                          Tonton
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 text-xs sm:text-sm">Tidak ada video khusus.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm">
                <div className={`p-3 rounded-xl sm:rounded-2xl border flex flex-col gap-1.5 ${
                  selectedScheduleItem.schedule.type === 'online'
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                }`}>
                  <div className="font-black text-xs sm:text-sm">
                    {selectedScheduleItem.schedule.type === 'online' ? 'Kelas Online (Live Zoom / Meet)' : 'Kelas Offline (Tatap Muka)'}
                  </div>
                  <div className="font-semibold text-xs sm:text-sm">
                    {formatIndonesianFullDate(selectedScheduleItem.schedule.date)} ({selectedScheduleItem.schedule.start_time} - {selectedScheduleItem.schedule.end_time} WIB)
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-extrabold text-slate-800 dark:text-white text-xs sm:text-sm">Pengajar (Sensei):</div>
                  <div className="font-bold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                    {selectedScheduleItem.schedule.instructor_name || selectedScheduleItem.schedule.instructor || 'Sensei Dojo'}
                  </div>
                  {selectedScheduleItem.schedule.type === 'online' && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block mb-1 font-semibold text-xs sm:text-sm">Tautan Kelas:</span>
                      <a
                        href={selectedScheduleItem.schedule.meet_url || 'https://zoom.us/j/kaiwadojo-live-session'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 dark:text-sky-400 font-mono text-xs sm:text-sm font-bold select-all bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1.5 rounded-lg inline-block break-all hover:underline"
                      >
                        {selectedScheduleItem.schedule.meet_url || 'https://zoom.us/j/kaiwadojo-live-session'}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
              {selectedScheduleItem.type === 'mission' && onOpenMissionModal && (
                <button
                  onClick={() => {
                    setSelectedScheduleItem(null)
                    onOpenMissionModal()
                  }}
                  className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-bold rounded-xl border-none cursor-pointer"
                >
                  Ubah Misi Hari Ini
                </button>
              )}
              <button
                onClick={() => setSelectedScheduleItem(null)}
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold rounded-xl border-none cursor-pointer"
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
  const [showMissionModal, setShowMissionModal]           = useState(false)
  const [loading, setLoading] = useState(true)

  async function handleSaveMissionFromDashboard(data: Omit<DailyMissionData, 'date'>, dateStr: string) {
    const effectiveUserId = user?.id || profile?.id || null
    if (!effectiveUserId) return
    await saveDailyMission(effectiveUserId, data, dateStr)
    const updated = (await fetchDailyMission(effectiveUserId, dateStr)) || getDailyMission(effectiveUserId, dateStr)
    setDailyMission(updated)
    if (updated) {
      const prog = await calculateMissionProgress(effectiveUserId, updated)
      setMissionProgress(prog)
      if (prog.videoProgressMap) {
        const map = new Map<string, number>()
        Object.entries(prog.videoProgressMap).forEach(([k, val]) => map.set(k, val))
        setVideoProgressMap(map)
      }
    }
    setShowMissionModal(false)
  }

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
      
      let prog: MissionProgress | null = null
      let newVideoMap = new Map<string, number>()
      if (mission) {
        prog = await calculateMissionProgress(effectiveUserId, mission)
        if (prog?.videoProgressMap) {
          const map = new Map<string, number>()
          Object.entries(prog.videoProgressMap).forEach(([k, val]) => map.set(k, val))
          newVideoMap = map
        }
      }

      setDailyMission(mission)
      setMissionProgress(prog)
      setVideoProgressMap(newVideoMap)

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

    let syncTimer: any = null
    const debouncedSync = () => {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => {
        loadDashboardData()
      }, 350)
    }

    window.addEventListener(SCHEDULE_UPDATE_EVENT, debouncedSync)
    window.addEventListener(RESERVATION_UPDATE_EVENT, debouncedSync)
    window.addEventListener(DAILY_MISSION_UPDATE_EVENT, debouncedSync)
    window.addEventListener('kaiwa_mission_progress_updated', debouncedSync)
    window.addEventListener('kaiwa_lesson_progress_updated', debouncedSync)
    window.addEventListener('kaiwa_profile_updated', debouncedSync)
    window.addEventListener(ANNOUNCEMENT_UPDATE_EVENT, debouncedSync)
    window.addEventListener('storage', debouncedSync)

    const unsubscribeScheduleRealtime = subscribeToScheduleRealtime(debouncedSync)
    const unsubscribeMissionRealtime = subscribeToDailyMissionRealtime(debouncedSync)
    const unsubscribeAnnouncementRealtime = subscribeToAnnouncementRealtime(debouncedSync)

    const lessonProgressChannel = supabase
      .channel('dashboard_lesson_progress_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_kotoba_submissions' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, debouncedSync)
      .subscribe()

    return () => {
      if (syncTimer) clearTimeout(syncTimer)
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, debouncedSync)
      window.removeEventListener(RESERVATION_UPDATE_EVENT, debouncedSync)
      window.removeEventListener(DAILY_MISSION_UPDATE_EVENT, debouncedSync)
      window.removeEventListener('kaiwa_mission_progress_updated', debouncedSync)
      window.removeEventListener('kaiwa_lesson_progress_updated', debouncedSync)
      window.removeEventListener('kaiwa_profile_updated', debouncedSync)
      window.removeEventListener(ANNOUNCEMENT_UPDATE_EVENT, debouncedSync)
      window.removeEventListener('storage', debouncedSync)
      unsubscribeScheduleRealtime()
      unsubscribeMissionRealtime()
      unsubscribeAnnouncementRealtime()
      supabase.removeChannel(lessonProgressChannel)
    }
  }, [user?.id, profile?.id])

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <main className="flex-1 px-3.5 py-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">

      {/* Hero Header with Personalized Japanese Greeting & Badges */}
      <header
        className="relative overflow-hidden rounded-xl sm:rounded-2xl px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7 mb-3.5 sm:mb-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5 sm:gap-5 shadow-md animate-fade-in-up bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(185,28,28,0.94), rgba(127,29,29,0.88)), url('/japan-background(2).jpg')",
        }}
      >
        <div className="absolute -top-14 -right-14 size-48 sm:size-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 right-20 size-36 sm:size-48 bg-white/[0.04] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4.5 w-full">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="size-10 sm:size-14 lg:size-16 rounded-xl sm:rounded-2xl border-2 border-white/30 object-cover shadow-md shrink-0"
              />
            ) : (
              <div className="size-10 sm:size-14 lg:size-16 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-white text-sm sm:text-base shadow-md font-serif shrink-0">
                {profile?.full_name?.[0] || '学'}
              </div>
            )}

            <div className="min-w-0 flex-1">
              {profile?.group_name && (
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="bg-white/15 backdrop-blur-md text-white text-xs sm:text-sm font-bold px-2 py-0.2 rounded-full border border-white/20 truncate max-w-[150px]">
                    Grup: {profile.group_name}
                  </span>
                </div>
              )}

              <h1 className="text-sm sm:text-base font-extrabold text-white leading-tight truncate">
                {greetingJp}, {profile?.full_name || 'Pelajar'}!
              </h1>
              <p className="text-xs sm:text-sm text-white/90 font-normal mt-0.5 leading-snug sm:leading-relaxed">
                {greetingKanji} • Latihan percakapan bahasa Jepang harianmu.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Papan Pengumuman Banner (if active announcements exist) */}
      {announcements.length > 0 && (
        <div
          onClick={() => setShowAnnouncementModal(true)}
          className="bg-gradient-to-r from-red-600/10 via-rose-500/5 to-amber-500/10 dark:from-red-950/40 dark:via-rose-950/20 dark:to-amber-950/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-red-500/20 dark:border-red-800/40 shadow-xs mb-3.5 sm:mb-5 flex items-center justify-between gap-2.5 cursor-pointer hover:border-red-500/40 transition-all hover:shadow-xs group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 sm:size-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <svg className="size-4 sm:size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Papan Pengumuman Dojo
                </span>
                {unreadAnnouncements.length > 0 ? (
                  <span className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-xs animate-pulse shrink-0">
                    {unreadAnnouncements.length} Baru
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    Terkini
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {unreadAnnouncements.length > 0 ? unreadAnnouncements[0]?.title : announcements[0]?.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary dark:text-red-400 shrink-0 group-hover:translate-x-0.5 transition-transform">
            <span className="hidden sm:inline">Buka</span>
            <span className="size-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="size-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      )}

      {/* ── MOBILE: Combined Sakura Blossom & Daily Mission Card (lg:hidden) ── */}
      <div className="block lg:hidden mb-3.5">
        <UnifiedMobileSakuraMissionCard
          streakDays={stats.streakDays}
          history={streakHistory}
          isFreezeToday={isNoPlanMission(dailyMission)}
          dailyMission={dailyMission}
          missionProgress={missionProgress}
          videoProgressMap={videoProgressMap}
          onOpenMissionModal={() => setShowMissionModal(true)}
        />
      </div>

      {/* ── DESKTOP: Separate Daily Mission Dashboard Widget (hidden lg:flex) ── */}
      <div className="hidden lg:flex flex-col bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm mb-5 gap-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="size-8 sm:size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
              <svg className="size-4.5 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight truncate">
                  Misi Harian Hari Ini
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {dailyMission
                  ? `Target: ${dailyMission.selectedVideos.length > 0 ? dailyMission.selectedVideos.map(v => `Bab ${v.bab} Part ${v.videoNum}`).join(', ') : 'Tanpa Video'} (${missionProgress?.targetReplays}x Replays) ${dailyMission.targetQuizCount > 0 ? `• ${dailyMission.targetQuizCount} Kuis` : ''} ${dailyMission.targetKotobaCount > 0 ? `• ${dailyMission.targetKotobaCount} Kotoba` : ''}`
                  : 'Buat misi harian kamu untuk mulai menambah streak sakura hari ini!'}
              </p>
            </div>
          </div>

          {dailyMission && (
            <button
              type="button"
              onClick={() => setShowMissionModal(true)}
              className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all flex items-center justify-center shrink-0 hover:text-primary dark:hover:text-primary-light"
              title="Edit Misi Harian"
              aria-label="Edit Misi Harian"
            >
              <svg className="size-3.5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {dailyMission && missionProgress ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {dailyMission.selectedVideos.length > 0 ? (
              dailyMission.selectedVideos.map((v, idx) => {
                const count = videoProgressMap.get(v.id) || 0
                const isVidDone = count >= 3
                return (
                  <button
                    key={v.id || idx}
                    onClick={() => navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)}
                    className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group flex flex-col justify-between gap-2.5 ${
                      isVidDone
                        ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-primary'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-800 dark:text-white mb-1">
                        <span className="truncate pr-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <svg className="size-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          <span className="truncate">Jilid {v.jilid} · Bab {v.bab} (Part {v.videoNum})</span>
                        </span>
                        <span className={isVidDone ? 'text-emerald-700 dark:text-emerald-400 font-extrabold shrink-0 text-xs sm:text-sm' : 'text-primary dark:text-red-400 font-bold shrink-0 text-xs sm:text-sm'}>
                          {count}/3x
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-400 mb-1.5 truncate">
                        {v.title}
                      </p>
                    </div>

                    <div>
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (count / 3) * 100)}%` }}
                        />
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold text-primary dark:text-red-400 flex items-center justify-between">
                        <span>Tonton Video</span>
                        <span className="size-3.5 sm:size-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
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
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs sm:text-sm flex flex-col justify-center min-h-[75px] sm:min-h-[100px]">
                <span className="font-bold">Rencana Video</span>
                <span className="text-xs sm:text-sm">Tidak ada video yang direncanakan</span>
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
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group flex flex-col justify-between gap-2.5 ${
                  missionProgress.quizCompleted
                    ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-500'
                }`}
              >
                <div>
                  <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-800 dark:text-white mb-1">
                    <span className="group-hover:text-indigo-600 transition-colors flex items-center gap-1.5 truncate pr-1">
                      <svg className="size-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span className="truncate">Kuis Evaluasi Bab</span>
                    </span>
                    <span className={missionProgress.quizCompleted ? 'text-emerald-700 dark:text-emerald-400 font-extrabold shrink-0 text-xs sm:text-sm' : 'text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-xs sm:text-sm'}>
                      {missionProgress.actualQuizzes}/{missionProgress.targetQuizzes}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mb-1.5">
                    Target: {missionProgress.targetQuizzes} kuis selesai
                  </p>
                </div>

                <div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (missionProgress.actualQuizzes / missionProgress.targetQuizzes) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                    <span>Mulai Kuis</span>
                    <span className="size-3.5 sm:size-4 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <svg className="size-2 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs sm:text-sm flex flex-col justify-center min-h-[75px] sm:min-h-[100px]">
                <div className="font-extrabold text-slate-700 dark:text-slate-200 text-xs sm:text-sm mb-1">Kuis Evaluasi Bab</div>
                <p className="text-xs sm:text-sm text-slate-400">Tidak ada kuis yang direncanakan</p>
              </div>
            )}

            {/* Target Kotoba Card */}
            {dailyMission.targetKotobaCount > 0 ? (
              <button
                onClick={() => navigate('/kotoba')}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group flex flex-col justify-between gap-2.5 ${
                  missionProgress.kotobaCompleted
                    ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-amber-500'
                }`}
              >
                <div>
                  <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-800 dark:text-white mb-1">
                    <span className="group-hover:text-amber-600 transition-colors flex items-center gap-1.5 truncate pr-1">
                      <svg className="size-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                      <span className="truncate">Setoran Kotoba</span>
                    </span>
                    <span className={missionProgress.kotobaCompleted ? 'text-emerald-700 dark:text-emerald-400 font-extrabold shrink-0 text-xs sm:text-sm' : 'text-amber-600 dark:text-amber-400 font-bold shrink-0 text-xs sm:text-sm'}>
                      {missionProgress.actualKotoba}/{missionProgress.targetKotoba}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mb-1.5">
                    Target: {missionProgress.targetKotoba} setoran selesai
                  </p>
                </div>

                <div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (missionProgress.actualKotoba / missionProgress.targetKotoba) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                    <span>Buka Setoran</span>
                    <span className="size-3.5 sm:size-4 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <svg className="size-2 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs sm:text-sm flex flex-col justify-center min-h-[75px] sm:min-h-[100px]">
                <div className="font-extrabold text-slate-700 dark:text-slate-200 text-xs sm:text-sm mb-1">Setoran Kotoba</div>
                <p className="text-xs sm:text-sm text-slate-400">Tidak ada kotoba yang direncanakan</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center gap-2.5">
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Kamu belum menyusun Misi Harian untuk hari ini.
            </p>
            <button
              onClick={() => setShowMissionModal(true)}
              className="group px-3 sm:px-3.5 py-1 sm:py-1.5 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-extrabold rounded-lg sm:rounded-xl border-none cursor-pointer transition-all shadow-xs flex items-center gap-1.5 touch-manipulation min-h-[30px] sm:min-h-[34px]"
            >
              <span>Susun Misi Hari Ini</span>
              <span className="size-3.5 sm:size-4 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <svg className="size-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Streak Sakura & Embedded Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-3.5 sm:gap-5 mb-4 sm:mb-6 items-stretch">
        <div className="flex flex-col gap-3.5 sm:gap-5">
          {/* Desktop StreakCard (hidden on mobile, because merged into Unified Card) */}
          <div className="hidden lg:block h-full">
            <StreakCard
              streakDays={stats.streakDays}
              history={streakHistory}
              isFreezeToday={isNoPlanMission(dailyMission)}
              dailyMission={dailyMission}
              missionProgress={missionProgress}
              onOpenMissionModal={() => setShowMissionModal(true)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* Shortcut 1: Jurnal Kosakata */}
            <button
              onClick={() => navigate('/kotoba')}
              className="bg-amber-500 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2 sm:gap-3 shadow-xs cursor-pointer border-none transition-all hover:-translate-y-0.5 hover:shadow-md text-left group touch-manipulation min-h-[50px] sm:min-h-[58px]"
            >
              <span className="size-7.5 sm:size-9 rounded-lg sm:rounded-xl bg-amber-600/30 border border-amber-300/40 text-amber-100 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 font-serif shadow-xs">
                語
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-bold leading-snug truncate">Jurnal Kosakata</div>
                <div className="text-white/80 text-xs sm:text-sm mt-0.5 truncate block">Catatan Kotoba</div>
              </div>
              <span className="hidden sm:flex ml-auto size-4.5 sm:size-5 rounded-full bg-white/20 items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                <svg className="size-2 sm:size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>

            {/* Shortcut 2: Reservasi Kelas */}
            <button
              onClick={() => navigate('/reservasi-kelas')}
              className="bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2 sm:gap-3 shadow-xs border border-slate-200 dark:border-slate-800 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-sky-500 text-left group touch-manipulation min-h-[50px] sm:min-h-[58px]"
            >
              <span className="size-7.5 sm:size-9 rounded-lg sm:rounded-xl bg-sky-500/10 dark:bg-sky-400/20 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="size-3.5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-snug truncate">Reservasi Kelas</div>
                <div className="text-slate-400 text-xs sm:text-sm mt-0.5 truncate block">Live & Offline</div>
              </div>
              <span className="hidden sm:flex ml-auto size-4.5 sm:size-5 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                <svg className="size-2 sm:size-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* Embedded Schedule View Card */}
        <div className="h-full">
          <EmbeddedUserScheduleCard
            userId={user?.id || ''}
            onOpenMissionModal={() => setShowMissionModal(true)}
          />
        </div>
      </div>

      {/* Progress Preview for Minna no Nihongo Jilid 1 & 2 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-2.5 sm:mb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 leading-tight">
              <svg className="size-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>{t('dash_book_progress_title', 'Progress Belajar Buku')}</span>
            </h2>
          </div>
          <button
            onClick={() => navigate('/my-courses')}
            title={t('dash_open_course_btn', 'Buka Kursus')}
            aria-label={t('dash_open_course_btn', 'Buka Kursus')}
            className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shrink-0 hover:text-primary dark:hover:text-primary-light"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
          {/* Card 1: Jilid 1 */}
          <div
            onClick={() => navigate('/my-courses')}
            className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50/80 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/60 cursor-pointer transition-all hover:border-primary hover:shadow-md flex flex-col gap-2 sm:gap-2.5 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="size-7.5 sm:size-9 rounded-lg sm:rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <svg className="size-3.5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white truncate">Minna no Nihongo {t('dash_jilid_1_title', 'Jilid 1 (Dasar I)')}</h3>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-semibold mb-1">
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
            className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50/80 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 cursor-pointer transition-all hover:border-emerald-500 hover:shadow-md flex flex-col gap-2.5 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 sm:size-9 rounded-lg sm:rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white truncate">Minna no Nihongo {t('dash_jilid_2_title', 'Jilid 2 (Dasar II)')}</h3>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-semibold mb-1">
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

      {/* Daily Mission Builder Modal (Direct on Dashboard) */}
      {showMissionModal && (
        <DailyMissionBuilderModal
          targetDate={getTodayDateString()}
          currentMission={dailyMission}
          onSave={handleSaveMissionFromDashboard}
          onClose={() => setShowMissionModal(false)}
        />
      )}
    </main>
  )
}
