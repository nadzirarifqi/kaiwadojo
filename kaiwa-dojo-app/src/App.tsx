import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LanguageProvider } from './contexts/LanguageContext'
import Sidebar from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import PageTransition from './components/PageTransition'
import WhatsAppWidget from './components/WhatsAppWidget'
import ErrorBoundary from './components/ErrorBoundary'
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


/* ── Universal App Navbar (YouTube-Style Layout) ───
   Tampil di Desktop & Mobile:
   • Pojok kiri atas: Tombol Garis Tiga (Hamburger) + Logo & Wordmark KaiwaDojo
   • Klik logo / wordmark → kembali ke Dashboard (/dashboard)
   • Pojok kanan: Badge Role + Switch Dark/Light Mode + Foto/Avatar Profil
   ─────────────────────────────────────────────── */
function AppNavbar({
  onToggleSidebar,
  sidebarOpen,
}: {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
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

  function toggleTheme() {
    const root = document.documentElement
    const nextDark = !root.classList.contains('dark')
    if (nextDark) {
      root.classList.add('dark')
      localStorage.setItem('kaiwa_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('kaiwa_theme', 'light')
    }
    setIsDark(nextDark)
  }

  const roleLabel =
    profile?.role === 'admin'
      ? 'Admin'
      : profile?.role === 'pemateri'
      ? 'Admin Pengajar'
      : 'Pelajar'

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'KD'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-13 sm:h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-3 sm:px-5 lg:px-6 shadow-xs safe-left safe-right transition-colors">
      {/* Pojok kiri atas: Tombol Garis Tiga (Hamburger) + Logo & Tulisan KaiwaDojo */}
      <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
        {/* Tombol Menu Garis Tiga (Desktop & Mobile) */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          title={sidebarOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          className="size-8 sm:size-9 flex items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all border-none bg-transparent cursor-pointer shrink-0"
        >
          <svg className="size-4.5 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo & Tulisan KaiwaDojo - Klik untuk balik ke dashboard */}
        <button
          type="button"
          onClick={() => {
            navigate('/dashboard')
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              onToggleSidebar()
            }
          }}
          aria-label="Kembali ke Dashboard KaiwaDojo"
          title="Kembali ke Dashboard"
          className="flex items-center gap-1.5 sm:gap-2 px-1 sm:px-2 py-0.5 sm:py-1 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/70 active:scale-[0.98] transition-all cursor-pointer border-none bg-transparent group text-left shrink-0"
        >
          <div className="size-7 sm:size-7.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-xs group-hover:scale-105 transition-transform">
            <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-5 sm:size-5.5 object-contain" />
          </div>
          <div className="flex items-center gap-1">
            <span className="font-extrabold text-primary dark:text-red-400 text-xs sm:text-sm tracking-tight leading-none group-hover:text-primary-dark dark:group-hover:text-red-300 transition-colors">
              KaiwaDojo
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded-full bg-primary/10 text-primary dark:text-red-400 font-jp font-bold">
              会話
            </span>
          </div>
        </button>
      </div>

      {/* Pojok kanan atas: Role Badge + Theme Switch + Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pr-1 sm:pr-2">
        {/* Role badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span>{roleLabel}</span>
        </div>

        {/* Toggle Dark/Light Mode */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label="Ganti tema tampilan"
          className="size-8 sm:size-8.5 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all border-none bg-transparent cursor-pointer"
        >
          {isDark ? (
            <svg className="size-4 text-amber-400 fill-current" viewBox="0 0 24 24">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="size-4 text-slate-600 hover:text-amber-500 fill-none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {/* Profile Avatar button */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          title={profile?.full_name ? `Profil: ${profile.full_name}` : 'Lihat Profil'}
          aria-label="Lihat Profil"
          className="size-7.5 sm:size-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/40 active:scale-95 transition-all cursor-pointer p-0 shrink-0 mr-1 sm:mr-1.5"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || 'Avatar'}
              className="size-full object-cover rounded-full"
            />
          ) : (
            <div className="size-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-[10px] sm:text-xs font-bold text-white">
              {initials}
            </div>
          )}
        </button>
      </div>
    </header>
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
          lg:ml-[260px]     → bergeser saat sidebar desktop buka/tutup seperti YouTube
          ────────────────────────────────────── */}
      <div
        className={`
          flex-1 flex flex-col min-h-screen min-w-0 overflow-x-clip
          pt-14
          transition-[margin-left] duration-300 ease-in-out
          ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-0'}
        `}
      >
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
      ? 'Akun Anda telah dinonaktifkan / ditolak oleh Admin KaiwaDojo.'
      : 'Akun Anda masih dalam proses verifikasi Admin.'
    signOut(reasonMsg)
    return null  // signOut() performs window.location.replace('/') — no need to render Navigate
  }

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
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}

export default AppRoutes
