import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AdaptiveIcon from './AdaptiveIcon'

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
    navigate('/login')
  }

  const currentRole = profile?.role || 'pelajar'

  const navItems = [
    { iconImg: '/home.png', label: 'Beranda', to: '/dashboard' },
  ]

  if (currentRole === 'admin') {
    navItems.push(
      { iconImg: '/book.png', label: 'Edit Kursus & Durasi', to: '/kelola-kursus' },
      { iconImg: '/home.png', label: 'Kelola Akun Pemateri', to: '/kelola-pemateri' },
      { iconImg: '/calendar.png', label: 'Kelola Jadwal Kelas', to: '/kelola-jadwal' },
      { iconImg: '/book.png', label: 'Preview Kursus', to: '/my-courses' },
      { iconImg: '/task.png', label: 'Rencana Belajar', to: '/learning-plan' }
    )
  } else if (currentRole === 'pemateri') {
    navItems.push(
      { iconImg: '/calendar.png', label: 'Kelola Jadwal Kelas', to: '/kelola-jadwal' },
      { iconImg: '/calendar.png', label: 'Reservasi Kelas Live', to: '/reservasi-kelas' },
      { iconImg: '/book.png', label: 'Preview Kursus', to: '/my-courses' },
      { iconImg: '/task.png', label: 'Rencana Belajar', to: '/learning-plan' }
    )
  } else {
    // Pelajar
    navItems.push(
      { iconImg: '/task.png', label: 'Rencana Belajar', to: '/learning-plan' },
      { iconImg: '/calendar.png', label: 'Reservasi Kelas', to: '/reservasi-kelas' },
      { iconImg: '/book.png', label: 'Kursus Saya', to: '/my-courses' }
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
        className={`w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed top-0 left-0 h-screen z-50 shadow-sm transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + Theme Switch + Toggle */}
        <div className="px-5 pt-6 pb-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
              <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-8 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-[1.05rem] font-extrabold text-primary dark:text-red-400 tracking-tight leading-tight truncate">KaiwaDoJo</div>
              <div className="text-[0.6rem] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Learning Platform</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Single Compact Theme Switch Button */}
            <button
              type="button"
              onClick={() => handleThemeChange(isDark ? 'light' : 'dark')}
              title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              aria-label="Toggle Theme"
              className="size-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer transition-all shrink-0"
            >
              {isDark ? (
                <AdaptiveIcon src="/moon.png" alt="Mode Gelap" className="size-4.5 object-contain shrink-0" />
              ) : (
                <AdaptiveIcon src="/day.png" alt="Mode Terang" className="size-4.5 object-contain shrink-0" />
              )}
            </button>

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
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1.5">Menu</p>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `${navBase} ${isActive ? navActive : navInactive}`}
            >
              <AdaptiveIcon src={item.iconImg} alt={item.label} className="size-5 object-contain shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User card & Popup Menu */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 relative">
          {/* User Menu Popover */}
          {userMenuOpen && (
            <>
              {/* Click outside backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 z-50 animate-scale-up space-y-1">
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
                  <AdaptiveIcon src="/profile.png" alt="Lihat Profil" className="size-4.5 object-contain shrink-0" />
                  <span>Lihat Profil</span>
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
                  <AdaptiveIcon src="/setting.png" alt="Pengaturan" className="size-4.5 object-contain shrink-0" />
                  <span>Pengaturan</span>
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
                  <AdaptiveIcon src="/logout.png" alt="Keluar" className="size-4.5 object-contain shrink-0" />
                  <span>Keluar</span>
                </button>
              </div>
            </>
          )}

          {/* User Card Trigger */}
          <div
            onClick={() => setUserMenuOpen(prev => !prev)}
            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
              userMenuOpen
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
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
              <div className="text-[0.82rem] font-bold text-slate-800 dark:text-slate-100 truncate">{profile?.full_name ?? 'Memuat...'}</div>
              <div className="text-[0.7rem] text-slate-400 capitalize flex items-center gap-1">
                <span className="font-semibold text-primary dark:text-red-400">
                  {currentRole === 'pemateri' ? 'Admin Pengajar' : currentRole === 'admin' ? 'Superadmin' : 'Pelajar'}
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
