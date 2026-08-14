import { NavLink, useNavigate } from 'react-router-dom'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
}

const navItems = [
  { icon: '🏠', label: 'Beranda',      to: '/dashboard' },
  { icon: '📚', label: 'Kursus Saya',  to: '/my-courses' },
  { icon: '🔍', label: 'Jelajahi',     to: '/catalog' },
]
const bottomItems = [
  { icon: '👤', label: 'Profil',       to: '/profile' },
  { icon: '⚙️', label: 'Pengaturan',  to: '/settings' },
]

const navBase =
  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold ' +
  'transition-all duration-200 w-full text-left no-underline cursor-pointer'
const navActive   = 'bg-primary/[0.08] text-primary'
const navInactive = 'text-slate-500 hover:bg-slate-100 hover:text-primary'

export default function Sidebar({ isOpen, onClose, onToggle }: SidebarProps) {
  const navigate = useNavigate()

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
        className={`w-[260px] bg-white border-r border-slate-200 flex flex-col fixed top-0 left-0 h-screen z-50 shadow-sm transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + Toggle */}
        <div className="px-5 pt-6 pb-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 bg-white border border-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
              <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-8 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-[1.05rem] font-extrabold text-primary tracking-tight leading-tight truncate">KaiwaDoJo</div>
              <div className="text-[0.6rem] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Learning Platform</div>
            </div>
          </div>
          <button
            onClick={onToggle}
            aria-label="Toggle sidebar"
            className="size-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary border-none cursor-pointer transition-all text-base shrink-0 ml-2"
          >
            <span className="lg:hidden">×</span>
            <span className="hidden lg:block">◀</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 px-3 pt-3 pb-1.5">Menu</p>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `${navBase} ${isActive ? navActive : navInactive}`}
            >
              <span className="text-[1.1rem] w-6 text-center shrink-0">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 px-3 pt-4 pb-1.5">Akun</p>
          {bottomItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `${navBase} ${isActive ? navActive : navInactive}`}
            >
              <span className="text-[1.1rem] w-6 text-center shrink-0">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User card */}
        <div className="p-3 border-t border-slate-100">
          <div
            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover:bg-slate-100"
            onClick={() => { navigate('/profile'); onClose() }}
          >
            <div className="size-9 bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0">
              NR
            </div>
            <div className="min-w-0">
              <div className="text-[0.82rem] font-bold text-slate-800 truncate">Nadira Rifqi</div>
              <div className="text-[0.7rem] text-orange-500 font-semibold">🔥 7 hari streak</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Floating reopen (desktop) */}
      <button
        onClick={onToggle}
        aria-label="Buka sidebar"
        className={`hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-[60] w-7 h-16 bg-white border border-l-0 border-slate-200 rounded-r-xl items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 border-none cursor-pointer transition-all shadow-md text-xs font-bold ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        ▶
      </button>
    </>
  )
}
