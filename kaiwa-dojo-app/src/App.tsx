import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import StudentDashboard from './pages/Dashboard'
import InstructorDashboard from './pages/InstructorDashboard'
import MyCourses from './pages/MyCourses'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import LearningPlanPage from './pages/LearningPlan'
import ProfilePage from './pages/Profile'
import SettingsPage from './pages/Settings'
import ClassReservationPage from './pages/ClassReservation'
import InstructorScheduleManagerPage from './pages/InstructorScheduleManager'
import CourseEditorPage from './pages/CourseEditor'

/* ── Role-Aware Dashboard Router ─────────────────── */
function DashboardRoute() {
  const { profile } = useAuth()
  const role = profile?.role || 'pelajar'

  if (role === 'pemateri' || role === 'admin') {
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
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-14 flex items-center px-4 gap-3 shadow-sm safe-left safe-right">
      <button
        onClick={onMenuClick}
        aria-label="Buka menu"
        className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-lg transition-all hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer shrink-0"
      >
        ☰
      </button>
      <div className="flex items-center gap-2">
        <div className="size-7 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
          <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-6 object-contain" />
        </div>
        <span className="font-extrabold text-primary dark:text-red-400 text-sm tracking-tight">KaiwaDoJo</span>
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
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Memuat...</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

/* ── Router ─────────────────────────────────────── */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route path="/"                element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"       element={<ProtectedRoute><AppShell><DashboardRoute /></AppShell></ProtectedRoute>} />
          <Route path="/my-courses"      element={<ProtectedRoute><AppShell><MyCourses /></AppShell></ProtectedRoute>} />
          <Route path="/learning-plan"   element={<ProtectedRoute><AppShell><LearningPlanPage /></AppShell></ProtectedRoute>} />
          <Route path="/reservasi-kelas" element={<ProtectedRoute><AppShell><ClassReservationPage /></AppShell></ProtectedRoute>} />
          <Route path="/kelola-jadwal"   element={<ProtectedRoute><AppShell><InstructorScheduleManagerPage /></AppShell></ProtectedRoute>} />
          <Route path="/kelola-kursus"   element={<ProtectedRoute><AppShell><CourseEditorPage /></AppShell></ProtectedRoute>} />
          <Route path="/profile"         element={<ProtectedRoute><AppShell><ProfilePage /></AppShell></ProtectedRoute>} />
          <Route path="/settings"        element={<ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />
          <Route path="*"                element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
