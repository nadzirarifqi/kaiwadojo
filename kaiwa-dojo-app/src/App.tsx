import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LanguageProvider } from './contexts/LanguageContext'
import Sidebar from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import PageTransition from './components/PageTransition'
import WhatsAppWidget from './components/WhatsAppWidget'

// Lazy-loaded pages for ultra-fast initial loads and lightweight bundle chunks
const StudentDashboard = lazy(() => import('./pages/Dashboard'))
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const InstructorManagerPage = lazy(() => import('./pages/InstructorManager'))
const StudentManagerPage = lazy(() => import('./pages/StudentManager'))
const GroupManagerPage = lazy(() => import('./pages/GroupManager'))
const MyCourses = lazy(() => import('./pages/MyCourses'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const AdminLoginPage = lazy(() => import('./pages/auth/AdminLoginPage'))
const LearningPlanPage = lazy(() => import('./pages/LearningPlan'))
const ProfilePage = lazy(() => import('./pages/Profile'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const ClassReservationPage = lazy(() => import('./pages/ClassReservation'))
const InstructorScheduleManagerPage = lazy(() => import('./pages/InstructorScheduleManager'))
const CourseEditorPage = lazy(() => import('./pages/CourseEditor'))
const SetoranKotobaPage = lazy(() => import('./pages/SetoranKotoba'))
const LandingPage = lazy(() => import('./pages/LandingPage'))

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


/* ── Mobile Topbar ─────────────────────────────────
   Hanya tampil di bawah breakpoint lg (< 1024px).
   Di desktop, hamburger tidak ada — sidebar punya
   tombol toggle sendiri di dalam headernya.
   ─────────────────────────────────────────────── */
function MobileTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 h-14 flex items-center justify-between px-4 shadow-xs safe-left safe-right transition-all">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
          className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-base font-bold transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 border-none cursor-pointer shrink-0"
        >
          ☰
        </button>
        <div className="flex items-center gap-2">
          <div className="size-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
            <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-5 object-contain" />
          </div>
          <span className="font-black text-primary dark:text-red-400 text-sm tracking-tight flex items-center gap-1">
            <span>KaiwaDojo</span>
            <span className="text-[0.6rem] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary dark:text-red-400 font-jp font-bold">会話</span>
          </span>
        </div>
      </div>
    </header>
  )
}


/* ── App Shell ─────────────────────────────────────
   sidebarOpen mengendalikan:
   • Mobile  → drawer slide-in/out
   • Desktop → shift konten + lebar sidebar (buka/tutup)
   ─────────────────────────────────────────────── */
function AppShell({ children }: { children: React.ReactNode }) {
  // Default false = sidebar disembunyikan (hidden) secara default
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Reset sidebar ke hidden setiap kali user berpindah halaman/rute
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-clip">

      {/* Mobile topbar */}
      <MobileTopbar onMenuClick={() => setSidebarOpen(prev => !prev)} />

      {/* Sidebar — drawer on mobile, fixed panel on desktop */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen(prev => !prev)}
      />

      {/* ── Main content ──────────────────────────
          min-w-0   → mencegah flex child melar melebihi wrapper
          overflow-x-clip → menghentikan scroll horizontal tanpa merusak position: sticky
          lg:ml-[260px] transition → bergeser saat sidebar buka/tutup
          ────────────────────────────────────── */}
      <div
        className={`
          flex-1 flex flex-col min-h-screen min-w-0 overflow-x-clip
          pt-14 lg:pt-0
          transition-[margin-left] duration-300 ease-in-out
          ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-0'}
        `}
      >
        {children}
      </div>
    </div>
  )

}

/* ── Protected Route ────────────────────────────── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/* ── Router ─────────────────────────────────────── */
export function AppRoutes() {
  return (
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

                {/* Protected routes */}
                <Route path="/dashboard"       element={<ProtectedRoute><AppShell><DashboardRoute /></AppShell></ProtectedRoute>} />
                <Route path="/my-courses"      element={<ProtectedRoute><AppShell><MyCourses /></AppShell></ProtectedRoute>} />
                <Route path="/learning-plan"   element={<ProtectedRoute><AppShell><LearningPlanPage /></AppShell></ProtectedRoute>} />
                <Route path="/kotoba"          element={<ProtectedRoute><AppShell><SetoranKotobaPage /></AppShell></ProtectedRoute>} />
                <Route path="/reservasi-kelas" element={<ProtectedRoute><AppShell><ClassReservationPage /></AppShell></ProtectedRoute>} />
                <Route path="/kelola-jadwal"   element={<ProtectedRoute><AppShell><InstructorScheduleManagerPage /></AppShell></ProtectedRoute>} />
                <Route path="/kelola-kursus"   element={<ProtectedRoute><AppShell><CourseEditorPage /></AppShell></ProtectedRoute>} />
                <Route path="/kelola-pemateri" element={<ProtectedRoute><AppShell><InstructorManagerPage /></AppShell></ProtectedRoute>} />
                <Route path="/kelola-pelajar"  element={<ProtectedRoute><AppShell><StudentManagerPage /></AppShell></ProtectedRoute>} />
                <Route path="/kelola-grup"     element={<ProtectedRoute><AppShell><GroupManagerPage /></AppShell></ProtectedRoute>} />
                <Route path="/profile"         element={<ProtectedRoute><AppShell><ProfilePage /></AppShell></ProtectedRoute>} />
                <Route path="/settings"        element={<ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />
                <Route path="*"                element={<Navigate to="/" replace />} />

              </Routes>
            </Suspense>
          </PageTransition>
          <WhatsAppWidget />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default AppRoutes
