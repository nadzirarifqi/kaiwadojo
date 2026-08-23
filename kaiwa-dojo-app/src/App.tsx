import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LanguageProvider } from './contexts/LanguageContext'
import Sidebar from './components/Sidebar'
import StudentDashboard from './pages/Dashboard'
import InstructorDashboard from './pages/InstructorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import InstructorManagerPage from './pages/InstructorManager'
import StudentManagerPage from './pages/StudentManager'
import MyCourses from './pages/MyCourses'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import AdminLoginPage from './pages/auth/AdminLoginPage'
import LearningPlanPage from './pages/LearningPlan'
import ProfilePage from './pages/Profile'
import SettingsPage from './pages/Settings'
import ClassReservationPage from './pages/ClassReservation'
import InstructorScheduleManagerPage from './pages/InstructorScheduleManager'
import CourseEditorPage from './pages/CourseEditor'
import SetoranKotobaPage from './pages/SetoranKotoba'
import LandingPage from './pages/LandingPage'

import LoadingScreen from './components/LoadingScreen'
import PageTransition from './components/PageTransition'

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
  // Default true = sidebar terbuka di desktop
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-clip">

      {/* Mobile topbar */}
      <MobileTopbar onMenuClick={() => setSidebarOpen(true)} />

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
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <LoadingScreen message="Memeriksa Keamanan Sesi..." fullScreen={true} />
  }

  const isBrowserActive = sessionStorage.getItem('kaiwa_session_active') === 'true'
  const hasValidSession = Boolean(session?.user || profile)

  if (!isBrowserActive || !hasValidSession || !profile) {
    return <Navigate to="/" replace />
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
              <Route path="/profile"         element={<ProtectedRoute><AppShell><ProfilePage /></AppShell></ProtectedRoute>} />
              <Route path="/settings"        element={<ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />
              <Route path="*"                element={<Navigate to="/" replace />} />

            </Routes>
          </PageTransition>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default AppRoutes
