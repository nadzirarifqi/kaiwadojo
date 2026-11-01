import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { prefetchRoute } from '../utils/routePrefetch'
import KaiwaLogo from './KaiwaLogo'
import { useConfirmedSignOut } from '../contexts/ConfirmContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onToggle?: () => void
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

interface NavSection {
  title: string
  items: NavItem[]
}

/* ── Ikon (outline, satu gaya) ── */
function Icon({ d }: { d: string }) {
  return (
    <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}
const KanjiIcon = ({ char }: { char: string }) => (
  <span className="size-5 shrink-0 flex items-center justify-center font-serif font-bold text-[15px] leading-none" aria-hidden="true">{char}</span>
)

const ICON = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  plan: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  megaphone: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  teacher: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  student: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5',
  group: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  feedback: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
}

/** true bila lebar layar ≥ 1024px (desktop) */
function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const handleSignOut = useConfirmedSignOut(() => signOut())
  const { t } = useLanguage()
  const isDesktop = useIsDesktop()
  // Desktop saat ditutup → "rail" ikon saja (72px); mobile saat ditutup → tersembunyi
  const isRail = isDesktop && !isOpen

  const currentRole = profile?.role || 'pelajar'
  const roleLabel = currentRole === 'pemateri' ? 'Pengajar' : currentRole === 'admin' ? 'Admin' : 'Pelajar'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  // Tutup drawer mobile dengan Escape
  useEffect(() => {
    if (isDesktop || !isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDesktop, isOpen, onClose])

  const home: NavItem = { to: '/dashboard', label: t('nav_beranda', 'Beranda'), icon: <Icon d={ICON.home} /> }
  const courses: NavItem = { to: '/my-courses', label: t('nav_kursus', 'Kursus Saya'), icon: <Icon d={ICON.book} /> }
  const tracker: NavItem = { to: '/tracker-kotoba', label: 'Tracker Kotoba', icon: <KanjiIcon char="語" /> }
  const schedule: NavItem = { to: '/kelola-jadwal', label: 'Jadwal Kelas', icon: <Icon d={ICON.calendar} /> }

  const sections: NavSection[] =
    currentRole === 'admin'
      ? [
          { title: 'Utama', items: [home, courses] },
          {
            title: 'Konten',
            items: [
              { to: '/kelola-kursus', label: 'Edit Kursus', icon: <Icon d={ICON.edit} /> },
              { to: '/kelola-pengumuman', label: 'Pengumuman', icon: <Icon d={ICON.megaphone} /> },
            ],
          },
          {
            title: 'Pengguna',
            items: [
              { to: '/kelola-pelajar', label: 'Pelajar', icon: <Icon d={ICON.student} /> },
              { to: '/kelola-pemateri', label: 'Pengajar', icon: <Icon d={ICON.teacher} /> },
              { to: '/kelola-grup', label: 'Grup & Label', icon: <Icon d={ICON.group} /> },
            ],
          },
          {
            title: 'Aktivitas',
            items: [schedule, tracker, { to: '/kelola-masukan', label: 'Masukan & Saran', icon: <Icon d={ICON.feedback} /> }],
          },
        ]
      : currentRole === 'pemateri'
        ? [
            { title: 'Utama', items: [home, courses] },
            { title: 'Mengajar', items: [schedule, tracker] },
          ]
        : [
            {
              title: 'Belajar',
              items: [
                home,
                courses,
                { to: '/kotoba', label: t('nav_kotoba', 'Setoran Kotoba'), icon: <KanjiIcon char="語" /> },
                { to: '/learning-plan', label: t('nav_rencana', 'Rencana Belajar'), icon: <Icon d={ICON.plan} /> },
              ],
            },
            {
              title: 'Kelas',
              items: [{ to: '/reservasi-kelas', label: t('nav_reservasi', 'Reservasi Kelas'), icon: <Icon d={ICON.calendar} /> }],
            },
          ]

  function closeOnMobile() {
    if (!isDesktop) onClose()
  }

  function go(path: string) {
    navigate(path)
    closeOnMobile()
  }

  return (
    <>
      {/* Overlay drawer (mobile) */}
      <div
        className={`lg:hidden fixed inset-0 top-14 z-40 bg-slate-900/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="Navigasi utama"
        className={`fixed top-14 left-0 z-40 h-[calc(100dvh-3.5rem)] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-[transform,width] duration-300 ease-in-out
          w-[280px] ${isOpen ? 'translate-x-0 shadow-xl lg:shadow-none' : '-translate-x-full'}
          lg:translate-x-0 ${isOpen ? 'lg:w-[260px]' : 'lg:w-[72px]'}`}
      >
        {/* Navigasi */}
        <nav className={`flex-1 min-h-0 overflow-y-auto overscroll-contain py-3 ${isRail ? 'px-3' : 'px-3'}`}>
          {sections.map((section, sIdx) => (
            <div key={section.title} className={sIdx > 0 ? 'mt-4' : ''}>
              {isRail ? (
                sIdx > 0 && <div className="mx-2 mb-3 h-px bg-slate-200 dark:bg-slate-800" />
              ) : (
                <p className="px-3 mb-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">{section.title}</p>
              )}
              <ul className="flex flex-col gap-0.5">
                {section.items.map(item => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/dashboard'}
                      onClick={closeOnMobile}
                      onMouseEnter={() => prefetchRoute(item.to)}
                      onTouchStart={() => prefetchRoute(item.to)}
                      title={isRail ? item.label : undefined}
                      aria-label={isRail ? item.label : undefined}
                      className={({ isActive }) =>
                        `relative flex items-center gap-3 h-11 rounded-xl text-sm no-underline transition-colors ${
                          isRail ? 'justify-center' : 'px-3'
                        } ${
                          isActive
                            ? 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && !isRail && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-primary" aria-hidden="true" />}
                          {item.icon}
                          {!isRail && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Akun */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {isRail ? (
            <button
              type="button"
              onClick={() => go('/profile')}
              title={`${profile?.full_name || 'Profil'} · ${roleLabel}`}
              aria-label="Lihat profil"
              className="mx-auto size-11 rounded-xl flex items-center justify-center bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Avatar url={profile?.avatar_url} name={profile?.full_name} initials={initials} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => go('/profile')}
                onMouseEnter={() => prefetchRoute('/profile')}
                className="min-w-0 flex-1 flex items-center gap-3 p-1.5 rounded-xl text-left bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Avatar url={profile?.avatar_url} name={profile?.full_name} initials={initials} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{profile?.full_name ?? 'Memuat…'}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{roleLabel}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => go('/settings')}
                onMouseEnter={() => prefetchRoute('/settings')}
                title={t('nav_pengaturan', 'Pengaturan')}
                aria-label={t('nav_pengaturan', 'Pengaturan')}
                className="size-10 shrink-0 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Icon d={ICON.settings} />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                title={t('nav_keluar', 'Keluar')}
                aria-label={t('nav_keluar', 'Keluar')}
                className="size-10 shrink-0 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 bg-transparent border-none cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <Icon d={ICON.logout} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export function Avatar({ url, name, initials, size = 'size-9' }: { url?: string | null; name?: string | null; initials: string; size?: string }) {
  return url ? (
    <img src={url} alt={name || 'Avatar'} className={`${size} shrink-0 rounded-full object-cover border border-slate-200 dark:border-slate-700`} />
  ) : (
    <span className={`${size} shrink-0 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold`}>{initials}</span>
  )
}

/** Logo + wordmark (dipakai navbar) */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2">
      <span className="size-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
        <KaiwaLogo className="size-6 object-contain" />
      </span>
      <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white leading-none">
        kaiwa<span className="text-primary dark:text-red-400">dojo</span>
      </span>
    </span>
  )
}
