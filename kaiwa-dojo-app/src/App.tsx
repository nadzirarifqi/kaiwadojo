import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LanguageProvider } from './contexts/LanguageContext'
import { ToastProvider } from './contexts/ToastContext'
import { ConfirmProvider, useConfirmedSignOut } from './contexts/ConfirmContext'
import Sidebar, { Avatar, BrandMark } from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import PageTransition from './components/PageTransition'
import WhatsAppWidget from './components/WhatsAppWidget'
import ErrorBoundary from './components/ErrorBoundary'
import { getSubscriptionAccess } from './lib/subscriptionAccess'
import { prefetchCommonRoutes } from './utils/routePrefetch'

/* ── Lazy Load with Auto-Recovery ──────────────────
   Jika chunk gagal load (network error / stale hash setelah deploy baru di server),
   otomatis reload halaman untuk mengambil index.html terbaru.
   ─────────────────────────────────────────────── */
function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  importFn: () => Promise<T>
) {
  return lazy(async () => {
    try {
      return await importFn()
    } catch (err: any) {
      console.warn('Chunk load error (possible new version deployed), reloading...', err)
      const lastReload = sessionStorage.getItem('kaiwa_last_chunk_reload')
      const now = Date.now()
      // Cegah infinite reload loop: reload hanya jika reload terakhir > 8 detik lalu
      if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
        sessionStorage.setItem('kaiwa_last_chunk_reload', now.toString())
        window.location.reload()
        return new Promise<T>(() => {}) // tahan promise karena halaman sedang reload
      }
      throw err
    }
  })
}

// Lazy-loaded pages for ultra-fast initial loads and lightweight bundle chunks
const StudentDashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const InstructorDashboard = lazyWithRetry(() => import('./pages/InstructorDashboard'))
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'))
const InstructorManagerPage = lazyWithRetry(() => import('./pages/InstructorManager'))
const StudentManagerPage = lazyWithRetry(() => import('./pages/StudentManager'))
const GroupManagerPage = lazyWithRetry(() => import('./pages/GroupManager'))
const FeedbackManagerPage = lazyWithRetry(() => import('./pages/FeedbackManager'))
const MyCourses = lazyWithRetry(() => import('./pages/MyCourses'))
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazyWithRetry(() => import('./pages/auth/RegisterPage'))
const AdminLoginPage = lazyWithRetry(() => import('./pages/auth/AdminLoginPage'))
const LearningPlanPage = lazyWithRetry(() => import('./pages/LearningPlan'))
const ProfilePage = lazyWithRetry(() => import('./pages/Profile'))
const SettingsPage = lazyWithRetry(() => import('./pages/Settings'))
const ClassReservationPage = lazyWithRetry(() => import('./pages/ClassReservation'))
const InstructorScheduleManagerPage = lazyWithRetry(() => import('./pages/InstructorScheduleManager'))
const CourseEditorPage = lazyWithRetry(() => import('./pages/CourseEditor'))
const SetoranKotobaPage = lazyWithRetry(() => import('./pages/SetoranKotoba'))
const KotobaTrackerPage = lazyWithRetry(() => import('./pages/KotobaTracker'))
const AnnouncementManagerPage = lazyWithRetry(() => import('./pages/AnnouncementManager'))
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'))

/* ── Role-Aware Dashboard Router ─────────────────── */
function DashboardRoute() {
  const { profile } = useAuth()
  const role = profile?.role || 'pelajar'

  if (role === 'admin') {
    return <AdminDashboard />
  }
  if (role === 'pemateri') {
    return <InstructorDashboard />
  }

  return <StudentDashboard />
}


/* ── Navbar aplikasi ───────────────────────────────
   Kiri : tombol menu (buka/tutup sidebar) + logo → Beranda
   Kanan: ganti tema + menu akun (profil, pengaturan, keluar)
   ─────────────────────────────────────────────── */
function AppNavbar({
  onToggleSidebar,
  sidebarOpen,
}: {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const handleSignOut = useConfirmedSignOut(() => signOut())
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateTheme = () => setIsDark(document.documentElement.classList.contains('dark'))
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Menu akun: tutup saat pindah halaman, klik di luar, atau Escape
  useEffect(() => { setMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function toggleTheme() {
    const root = document.documentElement
    const nextDark = !root.classList.contains('dark')
    root.classList.toggle('dark', nextDark)
    localStorage.setItem('kaiwa_theme', nextDark ? 'dark' : 'light')
    setIsDark(nextDark)
  }

  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role === 'pemateri' ? 'Pengajar' : 'Pelajar'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'KD'
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Akun'

  const iconBtn =
    'size-10 shrink-0 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer transition-colors'
  const menuItem =
    'w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium text-left bg-transparent border-none cursor-pointer transition-colors'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 px-2 sm:px-4 safe-left safe-right">
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? 'Ciutkan menu' : 'Buka menu'}
          className={iconBtn}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          aria-label="Ke Beranda kaiwadojo"
          className="h-10 px-2 rounded-xl flex items-center bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <BrandMark />
        </button>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Mode terang' : 'Mode gelap'}
          aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
          className={iconBtn}
        >
          {isDark ? (
            <svg className="size-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Menu akun */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Menu akun"
            className={`h-10 pl-1 pr-1 sm:pr-2.5 rounded-xl flex items-center gap-2 border-none cursor-pointer transition-colors ${
              menuOpen ? 'bg-slate-100 dark:bg-slate-800' : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Avatar url={profile?.avatar_url} name={profile?.full_name} initials={initials} size="size-8" />
            <span className="hidden sm:block text-left leading-tight max-w-[9rem]">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{firstName}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">{roleLabel}</span>
            </span>
            <svg className={`hidden sm:block size-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-2 animate-fade-in-up"
            >
              <div className="flex items-center gap-3 px-2 py-2.5">
                <Avatar url={profile?.avatar_url} name={profile?.full_name} initials={initials} size="size-10" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile?.full_name || 'Pengguna'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile?.email || roleLabel}</p>
                </div>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              <button type="button" role="menuitem" onClick={() => navigate('/profile')} className={`${menuItem} text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`}>
                <svg className="size-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Profil saya
              </button>
              <button type="button" role="menuitem" onClick={() => navigate('/settings')} className={`${menuItem} text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`}>
                <svg className="size-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Pengaturan
              </button>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); handleSignOut() }} className={`${menuItem} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40`}>
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}


/* ── Banner langganan: pengingat untuk pelajar yang belum bayar / langganan habis ── */
function SubscriptionBanner() {
  const { profile } = useAuth()
  const { isLocked, isExpired } = getSubscriptionAccess(profile)
  if (!isLocked) return null
  return (
    <div className="mx-3 sm:mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
      <span>
        {isExpired ? 'Masa langganan kamu sudah berakhir.' : 'Akun kamu belum berlangganan.'}{' '}
        Video materi dan setoran kotoba terkunci sampai pembayaran dikonfirmasi.
      </span>
      <a
        href="https://bangunnegeri.inaconnext.it.com"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold no-underline transition-colors"
      >
        Langganan Sekarang
      </a>
    </div>
  )
}

/* ── App Shell ─────────────────────────────────────
   sidebarOpen mengendalikan:
   • Mobile  → drawer slide-in/out
   • Desktop → shift konten + sidebar buka/tutup (default terbuka seperti YouTube)
   ─────────────────────────────────────────────── */
function AppShell({ children }: { children?: React.ReactNode }) {
  // Desktop: default open (atau simpan preferensi user), Mobile: default closed
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 1024
      if (isDesktop) {
        const saved = localStorage.getItem('kaiwa_sidebar_desktop_open')
        return saved !== null ? saved === 'true' : true
      }
    }
    return false
  })
  const location = useLocation()

  // Di mobile (<1024px), tutup drawer navigasi saat berpindah rute
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [location.pathname])

  const handleToggle = () => {
    setSidebarOpen(prev => {
      const next = !prev
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        localStorage.setItem('kaiwa_sidebar_desktop_open', String(next))
      }
      return next
    })
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-clip transition-colors">
      {/* Universal YouTube-style topbar */}
      <AppNavbar onToggleSidebar={handleToggle} sidebarOpen={sidebarOpen} />

      {/* Sidebar — drawer di mobile, fixed panel di desktop di bawah navbar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={handleToggle}
      />

      {/* ── Main content ──────────────────────────
          pt-14             → pas di bawah topbar 56px (baik mobile maupun desktop)
          min-w-0           → mencegah flex child melar melebihi wrapper
          overflow-x-clip   → menghentikan scroll horizontal tanpa merusak position: sticky
          lg:ml-[260px]     → sidebar penuh; lg:ml-[72px] saat diciutkan jadi rail ikon
          ────────────────────────────────────── */}
      <div
        className={`
          flex-1 flex flex-col min-h-screen min-w-0 overflow-x-clip
          pt-14
          transition-[margin-left] duration-300 ease-in-out
          ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-[72px]'}
        `}
      >
        <SubscriptionBanner />
        <Suspense fallback={<LoadingScreen fullScreen={false} message="Memuat halaman..." />}>
          {children || <Outlet />}
        </Suspense>
      </div>
    </div>
  )
}

/* ── Protected Route ────────────────────────────── */
function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return <LoadingScreen message="Memeriksa Keamanan Sesi..." fullScreen={true} />
  }

  const isBrowserActive = sessionStorage.getItem('kaiwa_session_active') === 'true'
  const hasValidSession = Boolean(session?.user || profile)

  if (!isBrowserActive || !hasValidSession || !profile) {
    return <Navigate to="/" replace />
  }

  // Gating status akun: Akun nonaktif/rejected atau pending dilarang masuk ke Dashboard
  if (profile.role === 'pelajar' && (profile.status === 'rejected' || profile.status === 'pending')) {
    const reasonMsg = profile.status === 'rejected'
      ? 'Akun Anda telah dinonaktifkan / ditolak oleh Admin kaiwadojo.'
      : 'Akun Anda masih dalam proses verifikasi Admin.'
    signOut(reasonMsg)
    return null  // signOut() performs window.location.replace('/') — no need to render Navigate
  }

  // Pembayaran TIDAK lagi memblokir dashboard: pelajar yang belum bayar tetap bisa masuk,
  // tetapi fitur berbayar (video materi & tambah kotoba) dikunci di halamannya masing-masing
  // (lihat lib/subscriptionAccess.ts & components/SubscriptionLock.tsx).
  return <>{children || <Outlet />}</>
}

/* ── Floating Widgets (hidden for Admin) ────────── */
function FloatingWidgets() {
  const { profile } = useAuth()
  if (profile?.role === 'admin') return null
  return <WhatsAppWidget />
}

/* ── Router ─────────────────────────────────────── */
export function AppRoutes() {
  useEffect(() => {
    prefetchCommonRoutes()
  }, [])

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
            <PageTransition>
              <Suspense fallback={<LoadingScreen fullScreen={true} />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/"         element={<LandingPage />} />
                  <Route path="/login"    element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/admin"    element={<AdminLoginPage />} />

                  {/* Protected routes wrapped in persistent AppShell layout */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard"       element={<DashboardRoute />} />
                    <Route path="/my-courses"      element={<MyCourses />} />
                    <Route path="/learning-plan"   element={<LearningPlanPage />} />
                    <Route path="/kotoba"          element={<SetoranKotobaPage />} />
                    <Route path="/reservasi-kelas" element={<ClassReservationPage />} />
                    <Route path="/kelola-jadwal"   element={<InstructorScheduleManagerPage />} />
                    <Route path="/kelola-kursus"   element={<CourseEditorPage />} />
                    <Route path="/kelola-pemateri" element={<InstructorManagerPage />} />
                    <Route path="/kelola-pelajar"  element={<StudentManagerPage />} />
                    <Route path="/kelola-grup"       element={<GroupManagerPage />} />
                    <Route path="/kelola-pengumuman" element={<AnnouncementManagerPage />} />
                    <Route path="/kelola-masukan"  element={<FeedbackManagerPage />} />
                    <Route path="/tracker-kotoba"  element={<KotobaTrackerPage />} />
                    <Route path="/profile"         element={<ProfilePage />} />
                    <Route path="/settings"        element={<SettingsPage />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </PageTransition>
            <FloatingWidgets />
          </BrowserRouter>
          </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}

export default AppRoutes
