import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import InstructorDashboard from './pages/Dashboard'
import MyCourses from './pages/MyCourses'

/* ── Mobile Topbar ─────────────────────────────────
   Hanya tampil di bawah breakpoint lg (< 1024px).
   Di desktop, hamburger tidak ada — sidebar punya
   tombol toggle sendiri di dalam headernya.
   ─────────────────────────────────────────────── */
function MobileTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center px-4 gap-3 shadow-sm">
      <button
        onClick={onMenuClick}
        aria-label="Buka menu"
        className="size-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 text-lg transition-all hover:bg-slate-200 border-none cursor-pointer"
      >
        ☰
      </button>
      <div className="flex items-center gap-2">
        <div className="size-7 bg-white border border-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
          <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-6 object-contain" />
        </div>
        <span className="font-extrabold text-primary text-sm tracking-tight">KaiwaDoJo</span>
      </div>
    </header>
  )
}

/* ── Placeholder ────────────────────────────────── */
function PlaceholderPage({ icon, title }: { icon: string; title: string }) {
  return (
    <main className="flex-1 p-6 md:p-8 flex items-center justify-center flex-col gap-4 text-slate-400">
      <span className="text-5xl">{icon}</span>
      <h2 className="text-slate-700 text-xl font-bold">{title}</h2>
      <p className="text-sm">Halaman ini akan segera hadir!</p>
    </main>
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
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">

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
          overflow-x-hidden → menghentikan scroll horizontal
          lg:ml-[260px] transition → bergeser saat sidebar buka/tutup
          ────────────────────────────────────── */}
      <div
        className={`
          flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden
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

/* ── Router ─────────────────────────────────────── */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<AppShell><InstructorDashboard /></AppShell>} />
        <Route path="/my-courses"   element={<AppShell><MyCourses /></AppShell>} />
        <Route path="/course-editor" element={<AppShell><PlaceholderPage icon="🚧" title="Course Editor" /></AppShell>} />
        <Route path="/catalog"      element={<AppShell><PlaceholderPage icon="📦" title="Katalog Kursus" /></AppShell>} />
        <Route path="/settings"     element={<AppShell><PlaceholderPage icon="⚙️" title="Pengaturan" /></AppShell>} />
        <Route path="*"             element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
