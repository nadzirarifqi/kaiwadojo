import { useState, useEffect, type ReactNode } from 'react'
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
import { useToast } from '../contexts/ToastContext'
import { DashboardSkeleton } from '../components/Skeleton'
import {
  type Announcement,
  fetchActiveAnnouncementsForUser,
  ANNOUNCEMENT_UPDATE_EVENT,
  subscribeToAnnouncementRealtime,
} from '../lib/announcementService'
import AnnouncementModal from '../components/AnnouncementModal'
import DailyMissionBuilderModal from '../components/DailyMissionBuilderModal'
import JapanFactCard from '../components/JapanFactCard'
import ModalPortal from '../components/ModalPortal'
import { getSubscriptionAccess } from '../lib/subscriptionAccess'
import { SubscriptionStatusCard, LockIcon } from '../components/SubscriptionLock'

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

/* ── Komponen kecil yang dipakai bersama ─────────────────────── */
const CARD = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm'

function SakuraIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {[0, 72, 144, 216, 288].map(deg => (
        <path key={deg} transform={`rotate(${deg} 12 12)`} d="M12 2.8 C10 6.2, 9.6 9.5, 12 12 C14.4 9.5, 14 6.2, 12 2.8 Z" />
      ))}
      <circle cx="12" cy="12" r="2.2" className="fill-white dark:fill-slate-900" />
    </svg>
  )
}

function ChevronRight({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function CardHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ── Tugas misi harian (dipakai kartu misi & tombol aksi utama di hero) ── */
interface MissionTask {
  key: string
  kind: 'video' | 'quiz' | 'kotoba'
  title: string
  subtitle: string
  current: number
  target: number
  done: boolean
  path: string
}

function buildMissionTasks(
  mission: DailyMissionData | null,
  progress: MissionProgress | null,
  videoProgressMap: Map<string, number>,
): MissionTask[] {
  if (!mission || !progress) return []
  const tasks: MissionTask[] = mission.selectedVideos.map((v, idx) => {
    const count = videoProgressMap.get(v.id) || 0
    return {
      key: v.id || `video-${idx}`,
      kind: 'video',
      title: `Bab ${v.bab} · Video ${v.videoNum}`,
      subtitle: v.title || 'Materi video Minna no Nihongo',
      current: Math.min(count, 3),
      target: 3,
      done: count >= 3,
      path: `/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`,
    }
  })
  if (mission.targetQuizCount > 0) {
    const first = mission.selectedVideos[0]
    tasks.push({
      key: 'quiz',
      kind: 'quiz',
      title: 'Kuis Evaluasi Bab',
      subtitle: `Selesaikan ${progress.targetQuizzes} kuis`,
      current: Math.min(progress.actualQuizzes, progress.targetQuizzes),
      target: progress.targetQuizzes,
      done: progress.quizCompleted,
      path: `/my-courses?jilid=${first?.jilid || 1}&bab=${first?.bab || 1}&item=4`,
    })
  }
  if (mission.targetKotobaCount > 0) {
    tasks.push({
      key: 'kotoba',
      kind: 'kotoba',
      title: 'Setoran Kotoba',
      subtitle: `Setor ${progress.targetKotoba} kosakata baru`,
      current: Math.min(progress.actualKotoba, progress.targetKotoba),
      target: progress.targetKotoba,
      done: progress.kotobaCompleted,
      path: '/kotoba',
    })
  }
  return tasks
}

const TASK_STYLE: Record<MissionTask['kind'], { tile: string; bar: string; unit: string }> = {
  video: { tile: 'bg-primary/10 text-primary dark:text-primary-lighter', bar: 'bg-primary', unit: 'tonton' },
  quiz: { tile: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300', bar: 'bg-indigo-500', unit: 'kuis' },
  kotoba: { tile: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400', bar: 'bg-amber-500', unit: 'kata' },
}

/* ── Kartu Misi Hari Ini (satu desain untuk mobile & desktop) ── */
function TodayMissionCard({
  dailyMission,
  missionProgress,
  videoProgressMap,
  onOpenMissionModal,
}: {
  dailyMission: DailyMissionData | null
  missionProgress: MissionProgress | null
  videoProgressMap: Map<string, number>
  onOpenMissionModal: () => void
}) {
  const navigate = useNavigate()
  const isRest = isNoPlanMission(dailyMission)
  const tasks = buildMissionTasks(dailyMission, missionProgress, videoProgressMap)
  const doneCount = tasks.filter(t => t.done).length
  const pct = Math.min(100, Math.max(0, Math.round(missionProgress?.overallPct ?? 0)))
  const isDone = tasks.length > 0 && (missionProgress?.isFullyCompleted ?? false)

  const editButton = dailyMission ? (
    <button
      type="button"
      onClick={onOpenMissionModal}
      aria-label="Ubah misi hari ini"
      title="Ubah misi hari ini"
      className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer transition-colors"
    >
      <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  ) : null

  return (
    <section aria-label="Misi hari ini" className={`${CARD} p-4 sm:p-5`}>
      <CardHeader
        icon={
          <span className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${isDone ? 'bg-emerald-500 text-white' : 'bg-primary text-white'}`}>
            {isDone ? (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            )}
          </span>
        }
        title="Misi Hari Ini"
        subtitle={
          !dailyMission ? 'Belum disusun'
          : isRest ? 'Hari istirahat terencana'
          : isDone ? 'Semua tugas selesai'
          : `${doneCount} dari ${tasks.length} tugas selesai`
        }
        action={editButton}
      />

      {/* Belum ada misi */}
      {!dailyMission && (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 sm:p-6 text-center flex flex-col items-center">
          <span className="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
            <SakuraIcon className="size-6" />
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3">Mulai hari ini dengan target kecil</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1 max-w-sm">
            Pilih video, kuis, atau kotoba yang ingin kamu selesaikan. Tuntaskan misinya agar sakura-mu terus tumbuh.
          </p>
          <button
            type="button"
            onClick={onOpenMissionModal}
            className="mt-4 h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors flex items-center gap-2"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Susun misi hari ini
          </button>
        </div>
      )}

      {/* Hari istirahat */}
      {dailyMission && isRest && (
        <div className="mt-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-4 flex items-start gap-3">
          <span className="size-10 shrink-0 rounded-xl bg-sky-500 text-white flex items-center justify-center">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-sky-900 dark:text-sky-100">Istirahat juga bagian dari belajar</p>
            <p className="text-sm text-sky-800/80 dark:text-sky-200/80 leading-relaxed mt-0.5">Streak-mu tetap aman hari ini. Berubah pikiran? Kamu bisa menambah target kapan saja.</p>
            <button
              type="button"
              onClick={onOpenMissionModal}
              className="mt-2.5 h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-sm font-semibold cursor-pointer hover:bg-sky-100/60 dark:hover:bg-sky-950/60 transition-colors"
            >
              Tambah target belajar
            </button>
          </div>
        </div>
      )}

      {/* Ada tugas */}
      {tasks.length > 0 && (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Progres misi</span>
              <span className={`font-bold tabular-nums ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {isDone && (
            <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-fade-in">
              <SakuraIcon className="size-4 shrink-0 text-emerald-500" />
              <span><strong>Misi tuntas!</strong> Sakura-mu tumbuh hari ini. お疲れさま!</span>
            </div>
          )}

          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {tasks.map(task => {
              const style = TASK_STYLE[task.kind]
              const taskPct = task.target > 0 ? Math.min(100, (task.current / task.target) * 100) : 0
              return (
                <li key={task.key}>
                  <button
                    type="button"
                    onClick={() => navigate(task.path)}
                    className={`w-full h-full text-left p-3 rounded-xl border cursor-pointer transition-colors flex items-center gap-3 group ${
                      task.done
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/60'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${task.done ? 'bg-emerald-500 text-white' : style.tile}`}>
                      {task.done ? (
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : task.kind === 'video' ? (
                        <svg className="size-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 001.52.85l11-6.86a1 1 0 000-1.7l-11-6.86A1 1 0 008 5.14z" /></svg>
                      ) : task.kind === 'quiz' ? (
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      ) : (
                        <span className="font-serif font-bold text-base leading-none">語</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold truncate ${task.done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{task.title}</span>
                        <span className={`text-xs font-bold tabular-nums shrink-0 ${task.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {task.current}/{task.target} {style.unit}
                        </span>
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{task.subtitle}</span>
                      <span className="block h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
                        <span className={`block h-full rounded-full transition-all duration-500 ${task.done ? 'bg-emerald-500' : style.bar}`} style={{ width: `${taskPct}%` }} />
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

/* ── Kartu Streak Sakura ─────────────────────────────────────── */
const NEXT_STAGE_NAME: Record<number, string> = {
  1: 'Tunas Sakura',
  3: 'Pohon Muda',
  7: 'Sakura Mekar',
  30: 'Sakura Rimbun',
  100: 'Sakura Abadi',
  365: 'satu tahun penuh',
}

function SakuraStreakCard({
  streakDays,
  history,
  isFreezeToday,
  dailyMission,
  missionProgress,
}: {
  streakDays: number
  history: StreakDayHistory[]
  isFreezeToday?: boolean
  dailyMission?: DailyMissionData | null
  missionProgress?: MissionProgress | null
}) {
  const dayLabels = getLast7DayLabels()
  const todayItem = history[history.length - 1]
  const isTodayFreeze = isFreezeToday || todayItem?.isFreeze || false
  const sakuraInfo = getSakuraStage(streakDays, isTodayFreeze)
  const nextGoal = sakuraInfo.nextGoal
  const daysLeft = Math.max(0, nextGoal - streakDays)
  const goalPct = Math.min(100, Math.round((streakDays / nextGoal) * 100))
  const [showSakuraModal, setShowSakuraModal] = useState(false)

  return (
    <section aria-label="Streak Sakura" className={`${CARD} p-4 sm:p-5 relative overflow-hidden`}>
      <div className="absolute -top-20 -right-16 size-56 rounded-full bg-rose-500/[0.06] dark:bg-rose-500/10 blur-2xl pointer-events-none" />

      <div className="relative">
        <CardHeader
          icon={
            <span className="size-10 shrink-0 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center">
              <SakuraIcon className="size-5" />
            </span>
          }
          title={sakuraInfo.stageName}
          subtitle={<span><span className="font-serif">{sakuraInfo.japaneseName}</span> · Streak Sakura</span>}
          action={
            <button
              type="button"
              onClick={() => setShowSakuraModal(true)}
              aria-label="Lihat tahapan pertumbuhan sakura"
              title="Tahapan pertumbuhan sakura"
              className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer transition-colors"
            >
              <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          }
        />

        <div className="flex items-center gap-4 sm:gap-5 mt-4">
          <SakuraRingProgressBar
            streakDays={streakDays}
            isFreeze={isTodayFreeze}
            dailyMission={dailyMission}
            missionProgress={missionProgress}
            onClick={() => setShowSakuraModal(true)}
          />
          <div className="min-w-0 flex-1">
            <p className="leading-none">
              <span className={`text-4xl font-black tabular-nums tracking-tight ${sakuraInfo.colorClass}`}>{streakDays}</span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 ml-1.5">hari beruntun</span>
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug mt-2">
              {daysLeft > 0
                ? <>{daysLeft} hari lagi menuju <strong className="font-semibold">{NEXT_STAGE_NAME[nextGoal] || `${nextGoal} hari`}</strong></>
                : 'Target tahap ini tercapai!'}
            </p>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isTodayFreeze ? 'bg-sky-500' : 'bg-gradient-to-r from-rose-400 to-pink-500'}`}
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Riwayat 7 hari */}
        <ol className="mt-5 grid grid-cols-7 gap-1" aria-label="Riwayat 7 hari terakhir">
          {history.map((item, i) => {
            const isToday = i === history.length - 1
            const status = item.done ? (item.isFreeze ? 'Istirahat' : 'Misi selesai') : 'Belum selesai'
            return (
              <li key={item.date || i} className="flex flex-col items-center gap-1" title={`${dayLabels[i]}: ${status}`}>
                <span className={`size-8 rounded-full flex items-center justify-center ${
                  item.done
                    ? item.isFreeze ? 'bg-sky-500 text-white' : 'bg-gradient-to-br from-rose-400 to-pink-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                } ${isToday ? 'ring-2 ring-offset-2 ring-rose-300 dark:ring-rose-800 ring-offset-white dark:ring-offset-slate-900' : ''}`}>
                  {item.done ? (
                    item.isFreeze
                      ? <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" /></svg>
                      : <SakuraIcon className="size-3.5" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                  <span className="sr-only">{status}</span>
                </span>
                <span className={`text-xs ${isToday ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-400'}`}>
                  {isToday ? 'Ini' : dayLabels[i]}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <SakuraEvolutionModal isOpen={showSakuraModal} onClose={() => setShowSakuraModal(false)} currentStreak={streakDays} />
    </section>
  )
}

/* ── Modal tahapan pertumbuhan sakura ──────────────────────────── */
const SAKURA_STAGES = [
  { range: '0 hari', name: 'Benih Bunga Sakura', jp: '桜の種', min: 0 },
  { range: '1–2 hari', name: 'Tunas Bunga Sakura', jp: '桜の若芽', min: 1 },
  { range: '3–6 hari', name: 'Pohon Muda Sakura', jp: '若木の桜', min: 3 },
  { range: '7–29 hari', name: 'Pohon Sakura Mekar', jp: '開花の桜', min: 7 },
  { range: '30–99 hari', name: 'Pohon Sakura Rimbun', jp: '満開の桜', min: 30 },
  { range: '100+ hari', name: 'Pohon Sakura Abadi', jp: '悠久の桜', min: 100 },
]

function SakuraEvolutionModal({ isOpen, onClose, currentStreak = 0 }: { isOpen: boolean; onClose: () => void; currentStreak?: number }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null
  const currentIdx = SAKURA_STAGES.reduce((acc, s, i) => (currentStreak >= s.min ? i : acc), 0)

  return (
    <ModalPortal>
    <div
      className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 z-[999] animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sakura-stage-title"
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 px-5 pt-3 sm:pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto animate-fade-in-up"
      >
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="sakura-stage-title" className="text-lg font-bold text-slate-900 dark:text-white">Tahapan Pohon Sakura</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
              Setiap hari kamu menuntaskan misi, pohon sakura-mu tumbuh satu langkah. Hari istirahat terencana tidak memutus streak.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="size-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer flex items-center justify-center"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <ol className="mt-4 flex flex-col gap-1.5">
          {SAKURA_STAGES.map((s, i) => {
            const reached = i <= currentIdx
            const isCurrent = i === currentIdx
            return (
              <li
                key={s.name}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  isCurrent
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <span className={`size-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                  reached ? 'bg-gradient-to-br from-rose-400 to-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  {reached ? <SakuraIcon className="size-4" /> : i}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400"><span className="font-serif">{s.jp}</span> · {s.range}</p>
                </div>
                {isCurrent && <span className="text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0">Kamu di sini</span>}
              </li>
            )
          })}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 mt-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm border-none cursor-pointer transition-colors"
        >
          Mengerti
        </button>
      </div>
    </div>
    </ModalPortal>
  )
}

/* ── Akses Cepat ──────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  {
    to: '/my-courses', label: 'Kursus Saya', hint: 'Video & kuis',
    tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    icon: <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  },
  {
    to: '/kotoba', label: 'Setoran Kotoba', hint: 'Kosakata', paid: true,
    tile: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    icon: <span className="font-serif font-bold text-lg leading-none">語</span>,
  },
  {
    to: '/reservasi-kelas', label: 'Reservasi Kelas', hint: 'Live & offline', paid: true,
    tile: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
    icon: <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  },
  {
    to: '/learning-plan', label: 'Rencana Belajar', hint: 'Kalender',
    tile: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400',
    icon: <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
]

function QuickActions({
  announcement,
  unreadCount,
  onOpenAnnouncements,
}: {
  announcement?: { title: string } | null
  unreadCount: number
  onOpenAnnouncements: () => void
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Pelajar belum berlangganan: fitur berbayar tetap bisa dibuka, tapi ditandai gembok
  const subscriptionLocked = getSubscriptionAccess(profile).isLocked
  return (
    <nav aria-label="Akses cepat" className="grid grid-cols-4 lg:grid-cols-2 gap-2 sm:gap-3">
      {QUICK_ACTIONS.map(a => {
        const locked = subscriptionLocked && a.paid
        return (
          <button
            key={a.to}
            type="button"
            onClick={() => navigate(a.to)}
            aria-label={locked ? `${a.label} (perlu langganan)` : undefined}
            className={`${CARD} shadow-none hover:shadow-sm p-2.5 sm:p-3 flex flex-col lg:flex-row items-center lg:items-center gap-1.5 lg:gap-3 text-center lg:text-left cursor-pointer transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5 min-h-[76px] lg:min-h-0`}
          >
            <span className={`relative size-10 shrink-0 rounded-xl flex items-center justify-center ${a.tile}`}>
              {a.icon}
              {locked && (
                <span className="absolute -top-1 -right-1 size-[18px] rounded-full bg-slate-700 dark:bg-slate-600 text-white ring-2 ring-white dark:ring-slate-900 flex items-center justify-center">
                  <LockIcon className="size-2.5" />
                </span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{a.label}</span>
              <span className="hidden lg:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{locked ? 'Perlu langganan' : a.hint}</span>
            </span>
          </button>
        )
      })}

      {/* Pengumuman — ringkas, satu baris */}
      {announcement && (
        <button
          type="button"
          onClick={onOpenAnnouncements}
          className={`col-span-4 lg:col-span-2 h-11 px-3 rounded-xl border flex items-center gap-2.5 text-left cursor-pointer transition-colors group ${
            unreadCount > 0
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 hover:border-rose-300 dark:hover:border-rose-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <svg className={`size-[18px] shrink-0 ${unreadCount > 0 ? 'text-primary dark:text-primary-lighter' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          {unreadCount > 0 && (
            <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white leading-none">{unreadCount} baru</span>
          )}
          <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
            <span className="font-semibold">Pengumuman:</span> {announcement.title}
          </span>
          <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover:text-primary transition-colors" />
        </button>
      )}
    </nav>
  )
}

/* ── Agenda Mendatang ─────────────────────────────────────────── */
function getRelativeDayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Hari ini'
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

const SHORT_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function parseLocalDate(dateStr: string): Date | null {
  const [y, m, d] = (dateStr || '').split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const AGENDA_LIMIT = 4

function AgendaCard({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Pelajar belum berlangganan: kelas/reservasi tidak ditampilkan di agenda
  const classesLocked = getSubscriptionAccess(profile).isLocked
  const [userReservations, setUserReservations] = useState<any[]>([])
  const [userMissions, setUserMissions]         = useState<{ date: string; mission: DailyMissionData }[]>([])
  const [loading, setLoading]                   = useState(true)
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<any | null>(null)

  const todayStr = getTodayDateString()

  useEffect(() => {
    async function loadSchedulesAndMissions() {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        const [missionsMap, allSchedules, allReservations] = await Promise.all([
          fetchAllUserMissions(userId),
          fetchSchedules(),
          fetchReservations(),
        ])

        // Kelas yang dipesan user mulai hari ini
        const myReservations = allReservations.filter(r => r.user_id === userId)
        const myReservedSchedules = myReservations
          .map(r => {
            const sch = allSchedules.find(s => matchScheduleId(s.id, r.schedule_id))
            return sch ? { ...sch, reservationId: r.id } : null
          })
          .filter((sch): sch is NonNullable<typeof sch> => Boolean(sch && (sch.date || sch.start_date || '') >= todayStr))
          .sort((a, b) => (a.date || a.start_date || '').localeCompare(b.date || b.start_date || ''))

        setUserReservations(myReservedSchedules)

        // Misi mulai besok (misi hari ini sudah tampil di kartu Misi Hari Ini)
        const missionsList: { date: string; mission: DailyMissionData }[] = Array.from(missionsMap.entries())
          .filter(([date, mission]) => date > todayStr && !isNoPlanMission(mission))
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

  const timeline = [
    ...userMissions.map(m => ({ id: `mission-${m.date}`, type: 'mission' as const, date: m.date, mission: m.mission })),
    ...(classesLocked ? [] : userReservations).map(r => ({ id: `class-${r.id}`, type: 'class' as const, date: r.date || r.start_date || '', schedule: r })),
  ]
    .filter(item => item.date >= todayStr)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.type === 'class' ? -1 : 1
    })

  const visible = timeline.slice(0, AGENDA_LIMIT)
  const hiddenCount = timeline.length - visible.length

  return (
    <section aria-label="Agenda mendatang" className={`${CARD} p-4 sm:p-5`}>
      <CardHeader
        icon={
          <span className="size-10 shrink-0 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </span>
        }
        title="Agenda Mendatang"
        subtitle="Kelas & rencana belajarmu"
        action={
          <button
            type="button"
            onClick={() => navigate('/learning-plan')}
            className="h-10 px-3 shrink-0 rounded-xl text-sm font-semibold text-primary dark:text-primary-lighter hover:bg-primary/5 dark:hover:bg-primary/10 bg-transparent border-none cursor-pointer transition-colors"
          >
            Kalender
          </button>
        }
      />

      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Belum ada agenda mendatang</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Ikut kelas live atau rencanakan misi untuk hari-hari berikutnya.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/reservasi-kelas')}
              className="h-10 px-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold border-none cursor-pointer transition-colors"
            >
              Pesan kelas
            </button>
            <button
              type="button"
              onClick={() => navigate('/learning-plan')}
              className="h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Susun rencana
            </button>
          </div>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col">
          {visible.map(item => {
            const d = parseLocalDate(item.date)
            const rel = getRelativeDayLabel(item.date, todayStr)
            const isToday = item.date === todayStr
            const isClass = item.type === 'class'
            const sch = isClass ? item.schedule : null
            const m = !isClass ? item.mission : null
            const title = isClass
              ? sch.title
              : m!.selectedVideos.length > 0
                ? m!.selectedVideos.map(v => `Bab ${v.bab} · Video ${v.videoNum}`).join(', ')
                : 'Misi tanpa video'
            const meta = isClass
              ? `${sch.start_time || ''}${sch.start_time ? ' WIB · ' : ''}${sch.type === 'online' ? 'Online' : 'Offline'}`
              : [m!.selectedVideos.length > 0 && `${m!.selectedVideos.length} video`, m!.targetQuizCount > 0 && `${m!.targetQuizCount} kuis`, m!.targetKotobaCount > 0 && `${m!.targetKotobaCount} kotoba`].filter(Boolean).join(' · ')
            return (
              <li key={item.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedScheduleItem(item)}
                  className="w-full py-2.5 px-1 -mx-1 rounded-xl flex items-center gap-3 text-left bg-transparent border-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className={`w-12 shrink-0 rounded-xl py-1.5 flex flex-col items-center leading-none ${
                    isToday ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}>
                    <span className={`text-[11px] font-semibold ${isToday ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>{d ? SHORT_DAYS[d.getDay()] : ''}</span>
                    <span className="text-lg font-bold tabular-nums mt-0.5">{d ? d.getDate() : '–'}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold ${isClass ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isClass ? 'Kelas' : 'Misi'}
                      </span>
                      <span className="text-xs text-slate-400">· {rel}</span>
                    </span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{meta || (d ? `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}` : '')}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => navigate('/learning-plan')}
          className="mt-2 w-full h-10 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer transition-colors"
        >
          Lihat {hiddenCount} agenda lainnya
        </button>
      )}

      {/* Detail agenda (bottom sheet di HP) */}
      {selectedScheduleItem && (
        <ModalPortal>
        <div
          className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 z-[999] animate-fade-in"
          onClick={() => setSelectedScheduleItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 px-5 pt-3 sm:pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto animate-fade-in-up flex flex-col gap-4"
          >
            <div className="sm:hidden mx-auto h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${selectedScheduleItem.type === 'class' ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {selectedScheduleItem.type === 'mission'
                    ? 'Misi belajar mandiri'
                    : selectedScheduleItem.schedule.type === 'online' ? 'Kelas online' : 'Kelas offline'}
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mt-0.5">
                  {selectedScheduleItem.type === 'mission' ? 'Rencana misi harian' : selectedScheduleItem.schedule.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatIndonesianFullDate(selectedScheduleItem.date)}
                  {selectedScheduleItem.type === 'class' && selectedScheduleItem.schedule.start_time && (
                    <> · {selectedScheduleItem.schedule.start_time}{selectedScheduleItem.schedule.end_time ? `–${selectedScheduleItem.schedule.end_time}` : ''} WIB</>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScheduleItem(null)}
                aria-label="Tutup"
                className="size-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer flex items-center justify-center"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {selectedScheduleItem.type === 'mission' ? (
              <div className="flex flex-col gap-2">
                {selectedScheduleItem.mission.selectedVideos.length > 0 ? (
                  selectedScheduleItem.mission.selectedVideos.map((v: any, idx: number) => (
                    <div key={v.id || idx} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">Jilid {v.jilid} · Bab {v.bab} · Video {v.videoNum}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{v.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedScheduleItem(null)
                          navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)
                        }}
                        className="h-10 px-3.5 shrink-0 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold border-none cursor-pointer transition-colors"
                      >
                        Tonton
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada video di misi ini.</p>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Target: {selectedScheduleItem.mission.targetQuizCount} kuis · {selectedScheduleItem.mission.targetKotobaCount} kotoba
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Pengajar</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">{selectedScheduleItem.schedule.instructor_name || selectedScheduleItem.schedule.instructor || 'Sensei Dojo'}</span>
                </div>
                {selectedScheduleItem.schedule.type === 'online' && selectedScheduleItem.schedule.meet_url && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1">Tautan kelas</span>
                    <a
                      href={selectedScheduleItem.schedule.meet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 dark:text-sky-400 font-semibold break-all hover:underline"
                    >
                      {selectedScheduleItem.schedule.meet_url}
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {selectedScheduleItem.type === 'class' && (
                <button
                  type="button"
                  onClick={() => { setSelectedScheduleItem(null); navigate('/reservasi-kelas') }}
                  className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors"
                >
                  Buka reservasi
                </button>
              )}
              {selectedScheduleItem.type === 'mission' && (
                <button
                  type="button"
                  onClick={() => { setSelectedScheduleItem(null); navigate('/learning-plan') }}
                  className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors"
                >
                  Ubah di Rencana Belajar
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedScheduleItem(null)}
                className="h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold border-none cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </section>
  )
}

/* ── Main Dashboard ────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const { toast } = useToast()
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
    if (!effectiveUserId) {
      toast.error('Sesi login tidak ditemukan. Silakan login kembali.', 'Gagal')
      return
    }

    try {
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

      const isRest = data.selectedVideos.length === 0 && data.targetKotobaCount === 0 && data.targetQuizCount === 0
      if (isRest) {
        toast.info('Hari istirahat terencana berhasil diatur! 🛌', 'Target Hari Ini')
      } else {
        toast.success('Target misi hari ini berhasil disimpan! Semangat belajarnya! 🎯', 'Misi Aktif')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan target misi. Silakan coba lagi.', 'Gagal Menyimpan')
    }
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

  /* ── Data personal untuk hero ── */
  const todayStr = getTodayDateString()
  const firstName = (profile?.full_name || '').trim().split(/\s+/)[0] || 'Pelajar'
  const isRestDay = isNoPlanMission(dailyMission)
  const missionTasks = buildMissionTasks(dailyMission, missionProgress, videoProgressMap)
  const remainingTasks = missionTasks.filter(task => !task.done)
  const missionDone = missionTasks.length > 0 && (missionProgress?.isFullyCompleted ?? false)
  const missionPct = Math.min(100, Math.max(0, Math.round(missionProgress?.overallPct ?? 0)))

  const heroMessage = !dailyMission
    ? stats.streakDays > 0
      ? `Streak ${stats.streakDays} harimu menunggu. Susun misi kecil hari ini agar sakura-mu tetap mekar.`
      : 'Yuk mulai dengan target kecil hari ini. Satu video saja sudah langkah yang berarti.'
    : isRestDay
      ? 'Hari ini jadwal istirahatmu. Streak tetap aman, nikmati harimu!'
      : missionDone
        ? `Misi hari ini tuntas! ${stats.streakDays > 0 ? `${stats.streakDays} hari beruntun, ` : ''}素晴らしい!`
        : remainingTasks.length === missionTasks.length
          ? `Ada ${missionTasks.length} tugas menantimu hari ini. Mulai dari yang paling ringan, ya!`
          : `Tinggal ${remainingTasks.length} tugas lagi untuk menuntaskan misi hari ini. Semangat!`

  const heroAction: { label: string; onClick: () => void } =
    !dailyMission
      ? { label: 'Susun misi hari ini', onClick: () => setShowMissionModal(true) }
      : remainingTasks.length > 0
        ? { label: remainingTasks.length === missionTasks.length ? 'Mulai misi' : 'Lanjutkan misi', onClick: () => navigate(remainingTasks[0].path) }
        : { label: missionDone ? 'Rencanakan besok' : 'Buka rencana belajar', onClick: () => navigate('/learning-plan') }

  const heroStats = [
    { label: 'Hari beruntun', value: String(stats.streakDays) },
    { label: 'Misi hari ini', value: !dailyMission ? '–' : isRestDay ? 'Libur' : `${missionPct}%` },
    { label: 'Jilid 1', value: `${bookProgress.jilid1Pct}%` },
  ]

  const bannerAnnouncement = unreadAnnouncements[0] ?? announcements[0] ?? null

  return (
    <main className="flex-1 px-4 py-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">

      {/* ── Hero: sapaan personal, status hari ini, aksi utama ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark rounded-2xl p-4 sm:p-6 lg:p-7 mb-4 sm:mb-6 text-white shadow-md animate-fade-in">
        <div className="absolute -top-16 -right-16 size-60 bg-white/10 rounded-full pointer-events-none" />
        <span aria-hidden="true" className="absolute -bottom-12 right-6 sm:right-1/3 font-serif font-black text-[10rem] sm:text-[12rem] leading-none text-white/[0.06] select-none pointer-events-none">道</span>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 lg:gap-10 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="size-12 sm:size-14 rounded-2xl border-2 border-white/30 object-cover shrink-0"
                />
              ) : (
                <div className="size-12 sm:size-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center font-bold text-xl shrink-0">
                  {firstName[0]?.toUpperCase() || '学'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-white/80 truncate">
                  {formatIndonesianFullDate(todayStr)}
                  {profile?.group_name && <span className="hidden sm:inline"> · Grup {profile.group_name}</span>}
                </p>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight truncate">
                  {greetingJp}, {firstName}!
                </h1>
                <p className="font-serif text-sm text-white/70 leading-tight">{greetingKanji}</p>
              </div>
            </div>

            <p className="text-sm sm:text-[15px] text-white/90 leading-relaxed mt-3.5 max-w-xl">{heroMessage}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={heroAction.onClick}
                className="h-11 px-5 rounded-xl bg-white text-primary hover:bg-white/90 text-sm font-bold border-none cursor-pointer transition-colors flex items-center gap-2 shadow-sm"
              >
                {heroAction.label}
                <ChevronRight className="size-4" />
              </button>
              {profile?.group_name && (
                <span className="sm:hidden text-xs font-semibold bg-white/15 border border-white/20 px-2.5 py-1 rounded-full truncate max-w-[45vw]">
                  Grup {profile.group_name}
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[22rem]">
            {heroStats.map(s => (
              <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 sm:py-3">
                <dt className="text-[11px] sm:text-xs text-white/75 leading-tight">{s.label}</dt>
                <dd className="text-xl sm:text-2xl font-black tabular-nums leading-tight mt-0.5">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ── Status langganan (hanya pelajar yang belum bayar / langganan habis) ── */}
      {getSubscriptionAccess(profile).isLocked && (
        <SubscriptionStatusCard className="mb-4 sm:mb-6 animate-fade-in" />
      )}

      {/* ── Konten utama ──
          HP: satu kolom, urutan diatur dengan `order` sesuai prioritas (misi → akses cepat & pengumuman → streak → fakta → agenda → progres).
          Desktop: dua kolom (utama | samping). */}
      <div className="flex flex-col gap-4 sm:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-6 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:min-w-0">
          <div className="order-1">
            <TodayMissionCard
              dailyMission={dailyMission}
              missionProgress={missionProgress}
              videoProgressMap={videoProgressMap}
              onOpenMissionModal={() => setShowMissionModal(true)}
            />
          </div>

          <div className="order-5">
            <AgendaCard userId={user?.id || ''} />
          </div>

          {/* Progres buku */}
          <section aria-label="Progres buku" className={`order-6 ${CARD} p-4 sm:p-5`}>
            <CardHeader
              icon={
                <span className="size-10 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </span>
              }
              title={t('dash_book_progress_title', 'Progres Belajar Buku')}
              subtitle="Minna no Nihongo"
              action={
                <button
                  type="button"
                  onClick={() => navigate('/my-courses')}
                  className="h-10 px-3 shrink-0 rounded-xl text-sm font-semibold text-primary dark:text-primary-lighter hover:bg-primary/5 dark:hover:bg-primary/10 bg-transparent border-none cursor-pointer transition-colors"
                >
                  {t('dash_open_course_btn', 'Buka Kursus')}
                </button>
              }
            />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: t('dash_jilid_1_title', 'Jilid 1 (Dasar I)'), pct: bookProgress.jilid1Pct, done: bookProgress.jilid1DoneItems, bar: 'bg-primary' },
                { label: t('dash_jilid_2_title', 'Jilid 2 (Dasar II)'), pct: bookProgress.jilid2Pct, done: bookProgress.jilid2DoneItems, bar: 'bg-emerald-500' },
              ].map(book => (
                <button
                  key={book.label}
                  type="button"
                  onClick={() => navigate('/my-courses')}
                  className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{book.label}</span>
                    <span className="text-lg font-black tabular-nums text-slate-900 dark:text-white">{book.pct}%</span>
                  </span>
                  <span className="block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
                    <span className={`block h-full rounded-full transition-all duration-700 ${book.bar}`} style={{ width: `${book.pct}%` }} />
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1.5">{book.done} dari 125 materi selesai</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:min-w-0">
          <div className="order-2">
            <QuickActions
              announcement={bannerAnnouncement}
              unreadCount={unreadAnnouncements.length}
              onOpenAnnouncements={() => setShowAnnouncementModal(true)}
            />
          </div>

          <div className="order-3">
            <SakuraStreakCard
              streakDays={stats.streakDays}
              history={streakHistory}
              isFreezeToday={isRestDay}
              dailyMission={dailyMission}
              missionProgress={missionProgress}
            />
          </div>

          <div className="order-4">
            <JapanFactCard userId={profile?.id || user?.id} />
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
