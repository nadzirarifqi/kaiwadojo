import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { prefetchRoute } from '../utils/routePrefetch'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
}

const navBase =
  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold ' +
  'transition-all duration-200 w-full text-left no-underline cursor-pointer'
const navActive   = 'bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-red-400 font-bold'
const navInactive = 'text-slate-500 hover:bg-slate-100 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'

export default function Sidebar({ isOpen, onClose, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { t } = useLanguage()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Theme Sync State
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  )

  useEffect(() => {
    if (typeof document === 'undefined') return
    const updateTheme = () => setIsDark(document.documentElement.classList.contains('dark'))
    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  function handleThemeChange(targetTheme: 'light' | 'dark') {
    const root = document.documentElement
    if (targetTheme === 'dark') {
      root.classList.add('dark')
      localStorage.setItem('kaiwa_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('kaiwa_theme', 'light')
    }
    setIsDark(targetTheme === 'dark')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  async function handleSignOut() {
    await signOut()
    // Note: signOut() performs window.location.replace('/') — no need to navigate here
  }

  const currentRole = profile?.role || 'pelajar'

  interface NavItem {
    icon: React.ReactNode
    label: string
    to: string
  }

  const navItems: NavItem[] = [
    {
      icon: (
        <span className="size-7 rounded-xl bg-red-500/10 text-red-600 dark:bg-red-400/20 dark:text-red-300 flex items-center justify-center font-bold text-sm shrink-0 border border-red-500/20 shadow-xs">
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </span>
      ),
      label: t('nav_beranda', 'Beranda Dojo'),
      to: '/dashboard',
    },
  ]

  if (currentRole === 'admin') {
    navItems.push(
      {
        icon: (
          <span className="size-7 rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-400/20 dark:text-orange-300 flex items-center justify-center font-bold text-xs shrink-0 border border-orange-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </span>
        ),
        label: 'Edit Kursus & Durasi',
        to: '/kelola-kursus',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-400/20 dark:text-rose-300 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
        ),
        label: 'Kelola Akun Pemateri',
        to: '/kelola-pemateri',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-400/20 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
            </svg>
          </span>
        ),
        label: 'Kelola Akun Pelajar',
        to: '/kelola-pelajar',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
        ),
        label: 'Kelola Grup & Label',
        to: '/kelola-grup',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
        ),
        label: 'Kelola Jadwal Kelas',
        to: '/kelola-jadwal',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-red-500/10 text-red-600 dark:bg-red-400/20 dark:text-red-300 flex items-center justify-center font-bold text-xs shrink-0 border border-red-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </span>
        ),
        label: 'Kelola Pengumuman',
        to: '/kelola-pengumuman',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center font-black text-xs shrink-0 font-serif border border-amber-500/30 shadow-xs">
            語
          </span>
        ),
        label: 'Tracker Setoran Kotoba',
        to: '/tracker-kotoba',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </span>
        ),
        label: 'Masukan & Saran',
        to: '/kelola-masukan',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </span>
        ),
        label: t('nav_kursus', 'Kursus Saya'),
        to: '/my-courses',
      }
    )
  } else if (currentRole === 'pemateri') {
    navItems.push(
      {
        icon: (
          <span className="size-7 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center font-black text-xs shrink-0 font-serif border border-amber-500/30 shadow-xs">
            語
          </span>
        ),
        label: 'Tracker Setoran Kotoba',
        to: '/tracker-kotoba',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
        ),
        label: 'Kelola Jadwal Kelas',
        to: '/kelola-jadwal',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </span>
        ),
        label: t('nav_kursus', 'Kursus Saya'),
        to: '/my-courses',
      }
    )
  } else {
    // Pelajar
    navItems.push(
      {
        icon: (
          <span className="size-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </span>
        ),
        label: t('nav_rencana', 'Rencana Belajar'),
        to: '/learning-plan',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0 border border-sky-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
        ),
        label: t('nav_reservasi', 'Reservasi Kelas'),
        to: '/reservasi-kelas',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center font-black text-xs shrink-0 font-serif border border-amber-500/30 shadow-xs">
            語
          </span>
        ),
        label: t('nav_kotoba', 'Setoran Kotoba'),
        to: '/kotoba',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20 shadow-xs">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </span>
        ),
        label: t('nav_kursus', 'Kursus Saya'),
        to: '/my-courses',
      }
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside
        className={`w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed top-0 left-0 h-[100dvh] max-h-[100dvh] h-screen z-50 shadow-sm transition-transform duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + Theme Switch + Toggle */}
        <div className="px-4 py-3.5 sm:px-5 sm:pt-6 sm:pb-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 sm:size-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
              <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-7 sm:size-8 object-contain" />
            </div>
            <div className="min-h-0">
              <div className="text-[0.95rem] sm:text-[1.05rem] font-extrabold text-primary dark:text-red-400 tracking-tight leading-tight truncate flex items-center gap-1">
                <span>KaiwaDoJo</span>
                <span className="text-[0.55rem] sm:text-[0.6rem] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary dark:text-red-400 font-jp font-bold">会話</span>
              </div>
              <div className="text-[0.58rem] sm:text-[0.62rem] text-slate-400 font-semibold tracking-wider mt-0.5 font-jp">会話道場 ・ Bahasa Jepang</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggle}
              aria-label="Toggle sidebar"
              className="size-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary dark:hover:text-red-400 border-none cursor-pointer transition-all text-base shrink-0"
            >
              <svg className="lg:hidden size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg className="hidden lg:block size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 p-2.5 sm:p-3 flex flex-col gap-1 overflow-y-auto overscroll-contain">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 pt-2 pb-1">Menu</p>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              onMouseEnter={() => prefetchRoute(item.to)}
              onTouchStart={() => prefetchRoute(item.to)}
              className={({ isActive }) => `${navBase} ${isActive ? navActive : navInactive}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User card & Popup Menu */}
        <div className="p-2.5 sm:p-3 pb-6 sm:pb-3 border-t border-slate-100 dark:border-slate-800 relative shrink-0">
          {/* Theme Switch */}
          <button
            type="button"
            onClick={() => handleThemeChange(isDark ? 'light' : 'dark')}
            title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            aria-label="Toggle Theme"
            className="w-full flex items-center gap-3 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer transition-all mb-1"
          >
            <span className="size-6 sm:size-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs shrink-0">
              {isDark ? (
                <svg className="size-3.5 text-amber-400 fill-current" viewBox="0 0 24 24">
                  <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="size-3.5 text-amber-500 fill-none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </span>
            <span>{isDark ? 'Mode Gelap' : 'Mode Terang'}</span>
            <span className="ml-auto text-slate-400 text-[0.6rem]">Ganti</span>
          </button>
          {/* User Menu Popover */}
          {userMenuOpen && (
            <>
              {/* Click outside backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              
              <div className="absolute bottom-full left-2 right-2 sm:left-3 sm:right-3 mb-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 z-50 animate-scale-up space-y-1 max-h-[60dvh] overflow-y-auto">
                {/* 1. Lihat Profil */}
                <button
                  type="button"
                  onMouseEnter={() => prefetchRoute('/profile')}
                  onTouchStart={() => prefetchRoute('/profile')}
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/profile')
                    onClose()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="size-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-500/20">
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <span>{t('nav_profil', 'Lihat Profil')}</span>
                </button>

                {/* 2. Pengaturan */}
                <button
                  type="button"
                  onMouseEnter={() => prefetchRoute('/settings')}
                  onTouchStart={() => prefetchRoute('/settings')}
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/settings')
                    onClose()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="size-6 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-500/20">
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                  <span>{t('nav_pengaturan', 'Pengaturan')}</span>
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

                {/* 3. Keluar */}
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    handleSignOut()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="size-6 rounded-lg bg-rose-500/10 text-rose-600 dark:bg-rose-400/20 dark:text-rose-300 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-500/20">
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </span>
                  <span>{t('nav_keluar', 'Keluar')}</span>
                </button>
              </div>
            </>
          )}

          {/* User Card Trigger */}
          <div
            onClick={() => setUserMenuOpen(prev => !prev)}
            className={`flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl cursor-pointer transition-all border ${
              userMenuOpen
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="size-8 sm:size-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User Avatar'}
                  className="size-full object-cover rounded-full"
                />
              ) : (
                <div className="size-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[0.78rem] sm:text-[0.82rem] font-bold text-slate-800 dark:text-slate-100 truncate">{profile?.full_name ?? 'Memuat...'}</div>
              <div className="text-[0.65rem] sm:text-[0.7rem] text-slate-400 capitalize flex items-center gap-1">
                <span className="font-semibold text-primary dark:text-red-400">
                  {currentRole === 'pemateri' ? 'Admin Pengajar' : currentRole === 'admin' ? 'Admin' : 'Pelajar'}
                </span>
              </div>
            </div>
            <span className={`text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
        </div>
      </aside>

      {/* Floating reopen (desktop) */}
      <button
        onClick={onToggle}
        aria-label="Buka sidebar"
        className={`hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-[60] w-7 h-16 bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-xl items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 border-none cursor-pointer transition-all shadow-md text-xs font-bold ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  )
}
