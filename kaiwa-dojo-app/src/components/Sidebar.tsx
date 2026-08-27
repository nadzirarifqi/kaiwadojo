import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'

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
    navigate('/')
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
          ⛩️
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
            🛠️
          </span>
        ),
        label: 'Edit Kursus & Durasi',
        to: '/kelola-kursus',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-400/20 dark:text-rose-300 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-500/20 shadow-xs">
            👨‍🏫
          </span>
        ),
        label: 'Kelola Akun Pemateri',
        to: '/kelola-pemateri',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-400/20 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-500/20 shadow-xs">
            🧑‍🎓
          </span>
        ),
        label: 'Kelola Akun Pelajar',
        to: '/kelola-pelajar',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-500/20 shadow-xs">
            📆
          </span>
        ),
        label: 'Kelola Jadwal Kelas',
        to: '/kelola-jadwal',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20 shadow-xs">
            📚
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
          <span className="size-7 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-500/20 shadow-xs">
            📆
          </span>
        ),
        label: 'Kelola Jadwal Kelas',
        to: '/kelola-jadwal',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20 shadow-xs">
            📚
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
            🎯
          </span>
        ),
        label: t('nav_rencana', 'Rencana Belajar'),
        to: '/learning-plan',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0 border border-sky-500/20 shadow-xs">
            💻
          </span>
        ),
        label: t('nav_reservasi', 'Reservasi Kelas'),
        to: '/reservasi-kelas',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center font-black text-sm shrink-0 font-serif border border-amber-500/30 shadow-xs">
            語
          </span>
        ),
        label: t('nav_kotoba', 'Setoran Kotoba'),
        to: '/kotoba',
      },
      {
        icon: (
          <span className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20 shadow-xs">
            📚
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
              <span className="lg:hidden">×</span>
              <span className="hidden lg:block">◀</span>
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
            <span className="size-6 sm:size-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs sm:text-sm shrink-0">
              {isDark ? '🌙' : '☀️'}
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
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/profile')
                    onClose()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="size-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-500/20">
                    👤
                  </span>
                  <span>{t('nav_profil', 'Lihat Profil')}</span>
                </button>

                {/* 2. Pengaturan */}
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/settings')
                    onClose()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="size-6 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-500/20">
                    ⚙️
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
                    🚪
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
            <span className="text-slate-400 text-xs font-bold transition-transform">
              {userMenuOpen ? '▼' : '▲'}
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
        ▶
      </button>
    </>
  )
}
