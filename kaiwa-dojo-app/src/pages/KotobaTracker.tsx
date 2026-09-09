import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  fetchAllStudentKotobaStats,
  subscribeToKotobaRealtime,
  type StudentKotobaStat,
  type GlobalKotobaSummary,
  KOTOBA_TRACKER_UPDATE_EVENT,
} from '../lib/kotobaService'
import { fetchGroups, type KaiwaGroup } from '../lib/groupService'
import LoadingScreen from '../components/LoadingScreen'

/* ── Helper: Format Relative Time ── */
function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Belum pernah setor'
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 60) return 'Baru saja'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} hari lalu`

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/* ── Helper: Format Full Date ── */
function formatFullDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function KotobaTrackerPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // Verify role: Admin and Pemateri only
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'pemateri'

  const [stats, setStats] = useState<StudentKotobaStat[]>([])
  const [summary, setSummary] = useState<GlobalKotobaSummary>({
    totalStudents: 0,
    activeStudents: 0,
    totalKotoba: 0,
    masteredKotoba: 0,
    unmasteredKotoba: 0,
    globalMasteryRate: 0,
  })
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [masteryFilter, setMasteryFilter] = useState<'all' | 'high' | 'progress' | 'empty'>('all')
  const [sortBy, setSortBy] = useState<'total' | 'recent' | 'percentage' | 'name'>('total')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Selected student for detail modal
  const [selectedStudent, setSelectedStudent] = useState<StudentKotobaStat | null>(null)

  // Load Data
  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true)
    else setRefreshing(true)

    try {
      const [kotobaRes, groupList] = await Promise.all([
        fetchAllStudentKotobaStats(),
        fetchGroups(true),
      ])
      setStats(kotobaRes.stats)
      setSummary(kotobaRes.summary)
      setGroups(groupList)

      // If a student modal is currently open, keep their data updated
      if (selectedStudent) {
        const updatedStudent = kotobaRes.stats.find(s => s.student_id === selectedStudent.student_id)
        if (updatedStudent) {
          setSelectedStudent(updatedStudent)
        }
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()

    const handleSync = () => {
      loadData(false)
    }

    window.addEventListener(KOTOBA_TRACKER_UPDATE_EVENT, handleSync)
    const unsubscribeRealtime = subscribeToKotobaRealtime(handleSync)

    return () => {
      window.removeEventListener(KOTOBA_TRACKER_UPDATE_EVENT, handleSync)
      unsubscribeRealtime()
    }
  }, [])

  // Filtered and Sorted list
  const filteredStudents = useMemo(() => {
    let result = [...stats]

    // 1. Group Filter
    if (selectedGroup !== 'all') {
      if (selectedGroup === '__no_group__') {
        result = result.filter(s => !s.group_name)
      } else {
        result = result.filter(s => s.group_name?.toLowerCase() === selectedGroup.toLowerCase())
      }
    }

    // 2. Mastery Filter
    if (masteryFilter === 'high') {
      result = result.filter(s => s.total_kotoba > 0 && s.mastery_percentage >= 80)
    } else if (masteryFilter === 'progress') {
      result = result.filter(s => s.total_kotoba > 0 && s.mastery_percentage < 80)
    } else if (masteryFilter === 'empty') {
      result = result.filter(s => s.total_kotoba === 0)
    }

    // 3. Search Term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter(s => {
        const nameMatch = s.full_name.toLowerCase().includes(q)
        const userMatch = s.username.toLowerCase().includes(q)
        const emailMatch = s.email.toLowerCase().includes(q)
        const groupMatch = (s.group_name || '').toLowerCase().includes(q)
        // Also search within student's kotoba list
        const kotobaMatch = s.kotoba_list.some(
          k =>
            k.japanese.toLowerCase().includes(q) ||
            k.romaji.toLowerCase().includes(q) ||
            k.meaning.toLowerCase().includes(q)
        )
        return nameMatch || userMatch || emailMatch || groupMatch || kotobaMatch
      })
    }

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === 'total') {
        return b.total_kotoba - a.total_kotoba || a.full_name.localeCompare(b.full_name)
      }
      if (sortBy === 'recent') {
        const timeA = a.last_submitted_at ? new Date(a.last_submitted_at).getTime() : 0
        const timeB = b.last_submitted_at ? new Date(b.last_submitted_at).getTime() : 0
        return timeB - timeA || b.total_kotoba - a.total_kotoba
      }
      if (sortBy === 'percentage') {
        return b.mastery_percentage - a.mastery_percentage || b.total_kotoba - a.total_kotoba
      }
      if (sortBy === 'name') {
        return a.full_name.localeCompare(b.full_name)
      }
      return 0
    })

    return result
  }, [stats, selectedGroup, masteryFilter, searchTerm, sortBy])

  // Export CSV
  function handleExportCSV() {
    const rows = [
      ['No', 'Nama Siswa', 'Username', 'Email', 'Grup / Batch', 'Total Kotoba', 'Dikuasai', 'Belum Dikuasai', 'Persentase Penguasaan (%)', 'Setoran Terakhir'],
    ]

    filteredStudents.forEach((s, idx) => {
      rows.push([
        String(idx + 1),
        `"${s.full_name.replace(/"/g, '""')}"`,
        `"${s.username.replace(/"/g, '""')}"`,
        `"${s.email.replace(/"/g, '""')}"`,
        `"${(s.group_name || 'Siswa Biasa').replace(/"/g, '""')}"`,
        String(s.total_kotoba),
        String(s.mastered_count),
        String(s.unmastered_count),
        `${s.mastery_percentage}%`,
        `"${formatFullDate(s.last_submitted_at)}"`,
      ])
    })

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Rekap_Setoran_Kotoba_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isAuthorized) {
    return (
      <main className="flex-1 p-6 lg:p-8 flex items-center justify-center min-h-[70vh]">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md text-center border border-slate-200 dark:border-slate-700 shadow-xl">
          <span className="text-5xl mb-4 block">🚫</span>
          <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">Akses Terbatas</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Halaman ini khusus diperuntukkan untuk Admin dan Pemateri Kaiwa Dojo.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    )
  }

  if (loading) {
    return <LoadingScreen message="Memuat Data Setoran Kotoba Seluruh Siswa..." fullScreen={false} />
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-fade-in bg-slate-50 dark:bg-slate-950">
      {/* ⛩️ Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-indigo-950 text-white rounded-2xl lg:rounded-[28px] p-5 sm:p-7 mb-7 shadow-xl relative overflow-hidden border border-amber-900/30">
        <div className="absolute right-4 -bottom-6 text-[8rem] sm:text-[10rem] font-black text-amber-500/5 select-none pointer-events-none leading-none font-serif">
          語
        </div>
        <div className="absolute -left-10 -top-10 size-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[0.65rem] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                Admin & Pemateri Tracker
              </span>
              <span className="text-[0.65rem] font-bold text-amber-200/80 bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Realtime Database
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white flex items-center gap-2.5">
              <span className="text-2xl sm:text-3xl">語</span>
              <span>Tracker Setoran Kotoba Pelajar</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-2xl">
              Pantau progres hafalan kosakata mandiri seluruh peserta, tingkat penguasaan, dan telusuri daftar kosakata detail per siswa.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Refresh data"
            >
              <span className={`text-sm ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
              <span>{refreshing ? 'Memperbarui...' : 'Segarkan'}</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredStudents.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <span>📊</span>
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📊 Global Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        {/* Metric 1: Total Kotoba Global */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Kosakata Disetor</span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base font-black font-serif">
              語
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
              {summary.totalKotoba.toLocaleString('id-ID')}
            </div>
            <p className="text-[0.7rem] text-slate-400 mt-1 font-medium">
              Dari {summary.activeStudents} pelajar aktif menyetor
            </p>
          </div>
        </div>

        {/* Metric 2: Mastered Kotoba */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Sudah Dikuasai</span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-black">
              ✅
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {summary.masteredKotoba.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[0.7rem] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md">
                {summary.globalMasteryRate}% Dikuasai
              </span>
            </div>
          </div>
        </div>

        {/* Metric 3: Unmastered Kotoba */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Belum Dikuasai</span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-black">
              ⏳
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {summary.unmasteredKotoba.toLocaleString('id-ID')}
            </div>
            <p className="text-[0.7rem] text-slate-400 mt-1 font-medium">
              Kosakata dalam proses latihan/hafalan
            </p>
          </div>
        </div>

        {/* Metric 4: Active Students Ratio */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Partisipasi Siswa</span>
            <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-black">
              👥
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
              {summary.activeStudents} <span className="text-sm font-semibold text-slate-400">/ {summary.totalStudents}</span>
            </div>
            <p className="text-[0.7rem] text-slate-400 mt-1 font-medium">
              {summary.totalStudents > 0 ? Math.round((summary.activeStudents / summary.totalStudents) * 100) : 0}% siswa memiliki setoran
            </p>
          </div>
        </div>
      </div>

      {/* 🔍 Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari siswa, username, email, kata..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
          >
            <option value="all">👥 Semua Grup ({groups.length})</option>
            {groups.map(g => (
              <option key={g.id} value={g.name}>
                🏷️ {g.name}
              </option>
            ))}
            <option value="__no_group__">🌐 Tanpa Grup (Siswa Biasa)</option>
          </select>

          {/* Mastery Level Filter */}
          <select
            value={masteryFilter}
            onChange={e => setMasteryFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
          >
            <option value="all">🎯 Semua Status</option>
            <option value="high">🏆 Tuntas ≥ 80%</option>
            <option value="progress">⚡ Sedang Belajar (1-79%)</option>
            <option value="empty">⭕ Belum Ada Setoran (0)</option>
          </select>

          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
          >
            <option value="total">📊 Urutkan: Terbanyak Kotoba</option>
            <option value="recent">⏱️ Urutkan: Terakhir Setor</option>
            <option value="percentage">🏆 Urutkan: % Tertinggi</option>
            <option value="name">🔤 Urutkan: Nama (A-Z)</option>
          </select>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-end sm:self-auto shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>🔲</span>
            <span>Kartu</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>📑</span>
            <span>Tabel</span>
          </button>
        </div>
      </div>

      {/* 📋 Result Count Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Menampilkan <strong className="text-slate-800 dark:text-white">{filteredStudents.length}</strong> pelajar
        </span>
      </div>

      {/* 📭 Empty State */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center gap-3">
          <span className="text-5xl">🔎</span>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Tidak ada pelajar yang cocok</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Coba ubah kata kunci pencarian atau sesuaikan filter grup / status penguasaan.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* 🔲 GRID VIEW CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudents.map(student => {
            const hasKotoba = student.total_kotoba > 0
            const initials = student.full_name
              .split(' ')
              .map(w => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <div
                key={student.student_id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group"
              >
                <div>
                  {/* Top Row: Avatar & Group Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {student.avatar_url ? (
                        <img
                          src={student.avatar_url}
                          alt={student.full_name}
                          className="size-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="size-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white truncate">
                          {student.full_name}
                        </h3>
                        <p className="text-[0.7rem] text-slate-400 truncate">
                          @{student.username}
                        </p>
                      </div>
                    </div>

                    {student.group_name ? (
                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                        👥 {student.group_name}
                      </span>
                    ) : (
                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                        🌐 Siswa Biasa
                      </span>
                    )}
                  </div>

                  {/* Progress Stats Section */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <span>🎯 Penguasaan:</span>
                        <strong className="text-slate-800 dark:text-white">{student.mastery_percentage}%</strong>
                      </span>
                      <span className="font-semibold text-slate-400 text-[0.7rem]">
                        {student.mastered_count} / {student.total_kotoba} Kata
                      </span>
                    </div>

                    {/* Visual Segmented Progress Bar */}
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                      {hasKotoba ? (
                        <>
                          <div
                            style={{ width: `${student.mastery_percentage}%` }}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-500"
                            title={`Dikuasai: ${student.mastered_count} kata`}
                          />
                          <div
                            style={{ width: `${100 - student.mastery_percentage}%` }}
                            className="bg-amber-400/80 dark:bg-amber-500/60 h-full transition-all duration-500"
                            title={`Belum Dikuasai: ${student.unmastered_count} kata`}
                          />
                        </>
                      ) : (
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-full" />
                      )}
                    </div>

                    {/* Breakdown Pills */}
                    <div className="flex items-center justify-between text-[0.68rem] mt-2.5 font-medium">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                        <span>✅ Dikuasai:</span>
                        <span>{student.mastered_count}</span>
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                        <span>⏳ Belum:</span>
                        <span>{student.unmastered_count}</span>
                      </span>
                      <span className="text-slate-400">
                        Total: <strong>{student.total_kotoba}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Relative last submission date */}
                  <div className="flex items-center justify-between text-[0.7rem] text-slate-400 mb-4 px-1">
                    <span>Setoran Terakhir:</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {formatRelativeTime(student.last_submitted_at)}
                    </span>
                  </div>
                </div>

                {/* Open Kotoba List Button */}
                <button
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                    hasKotoba
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 hover:text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="font-serif">語</span>
                  <span>Lihat List Kotoba ({student.total_kotoba})</span>
                  <span>➔</span>
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        /* 📑 TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[0.65rem] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Pelajar</th>
                  <th className="py-3.5 px-3">Grup / Batch</th>
                  <th className="py-3.5 px-3 text-center">Total Kotoba</th>
                  <th className="py-3.5 px-3 text-center">Dikuasai</th>
                  <th className="py-3.5 px-3 text-center">Belum</th>
                  <th className="py-3.5 px-4">Progress Penguasaan</th>
                  <th className="py-3.5 px-3">Setoran Terakhir</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {filteredStudents.map(student => {
                  const initials = student.full_name
                    .split(' ')
                    .map(w => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr
                      key={student.student_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {student.avatar_url ? (
                            <img
                              src={student.avatar_url}
                              alt={student.full_name}
                              className="size-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="size-8 rounded-xl bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-white truncate">
                              {student.full_name}
                            </div>
                            <div className="text-[0.68rem] text-slate-400 truncate">
                              @{student.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {student.group_name ? (
                          <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                            👥 {student.group_name}
                          </span>
                        ) : (
                          <span className="text-[0.65rem] text-slate-400">🌐 Siswa Biasa</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-black text-slate-800 dark:text-white">
                        {student.total_kotoba}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {student.mastered_count}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400">
                        {student.unmastered_count}
                      </td>
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${student.mastery_percentage}%` }}
                              className="bg-emerald-500 h-full"
                            />
                            <div
                              style={{ width: `${100 - student.mastery_percentage}%` }}
                              className="bg-amber-400 h-full"
                            />
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 shrink-0 w-8 text-right">
                            {student.mastery_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(student.last_submitted_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                        >
                          Lihat Kotoba ({student.total_kotoba})
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🔍 DETAIL MODAL PER SISWA */}
      {selectedStudent && (
        <StudentKotobaDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </main>
  )
}

/* ──────────────────────────────────────────────────────────
   MODAL DETAIL KOTOBA PER SISWA
   ────────────────────────────────────────────────────────── */
interface StudentKotobaDetailModalProps {
  student: StudentKotobaStat
  onClose: () => void
}

function StudentKotobaDetailModal({ student, onClose }: StudentKotobaDetailModalProps) {
  const [filterTab, setFilterTab] = useState<'all' | 'mastered' | 'unmastered'>('all')
  const [searchKotoba, setSearchKotoba] = useState('')
  const [activeImagePreview, setActiveImagePreview] = useState<string | null>(null)

  const initials = student.full_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Japanese Text-to-Speech audio pronunciation
  function handlePlayAudio(japaneseText: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Browser Anda tidak mendukung Web Speech API.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(japaneseText)
    utterance.lang = 'ja-JP'
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  // Filtered kotoba list inside modal
  const filteredKotobaList = useMemo(() => {
    let list = student.kotoba_list

    if (filterTab === 'mastered') {
      list = list.filter(k => k.is_mastered)
    } else if (filterTab === 'unmastered') {
      list = list.filter(k => !k.is_mastered)
    }

    if (searchKotoba.trim()) {
      const q = searchKotoba.toLowerCase().trim()
      list = list.filter(
        k =>
          k.japanese.toLowerCase().includes(q) ||
          k.romaji.toLowerCase().includes(q) ||
          k.meaning.toLowerCase().includes(q)
      )
    }

    return list
  }, [student.kotoba_list, filterTab, searchKotoba])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700">
          <div className="flex items-center gap-3.5 min-w-0">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt={student.full_name}
                className="size-13 rounded-2xl object-cover border-2 border-amber-500/40 shrink-0 shadow-md"
              />
            ) : (
              <div className="size-13 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white truncate">
                  {student.full_name}
                </h2>
                {student.group_name ? (
                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    👥 {student.group_name}
                  </span>
                ) : (
                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    🌐 Siswa Biasa
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                @{student.username} • {student.email}
              </p>
            </div>
          </div>

          {/* Quick Stats Pill & Close Button */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[0.65rem] block">Total Kosakata</span>
                <span className="font-black text-amber-300 text-sm">{student.total_kotoba}</span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div>
                <span className="text-slate-400 text-[0.65rem] block">Penguasaan</span>
                <span className="font-black text-emerald-300 text-sm">{student.mastery_percentage}%</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="size-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              title="Tutup Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Controls (Tabs + Search) */}
        <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterTab === 'all'
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Semua ({student.total_kotoba})
            </button>
            <button
              onClick={() => setFilterTab('mastered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filterTab === 'mastered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'
              }`}
            >
              <span>✅ Dikuasai</span>
              <span>({student.mastered_count})</span>
            </button>
            <button
              onClick={() => setFilterTab('unmastered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filterTab === 'unmastered'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50'
              }`}
            >
              <span>⏳ Belum Dikuasai</span>
              <span>({student.unmastered_count})</span>
            </button>
          </div>

          {/* Search inside student kotobas */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchKotoba}
              onChange={e => setSearchKotoba(e.target.value)}
              placeholder="Cari kanji, romaji, arti..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            {searchKotoba && (
              <button
                onClick={() => setSearchKotoba('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modal Body: Kotoba List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-[300px]">
          {filteredKotobaList.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-2">
              <span className="text-4xl">📭</span>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Tidak ada kosakata pada kategori ini
              </h4>
              <p className="text-xs text-slate-400">
                {searchKotoba
                  ? 'Coba ganti kata kunci pencarian.'
                  : 'Siswa belum menambahkan kosakata pada filter ini.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredKotobaList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                    item.is_mastered
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Top Row: Japanese Character + Pronounce Audio + Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-jp tracking-wide">
                          {item.japanese}
                        </span>
                        <button
                          onClick={() => handlePlayAudio(item.japanese)}
                          className="size-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs transition-all cursor-pointer"
                          title="Dengarkan Pelafalan Jepang"
                        >
                          🔊
                        </button>
                      </div>

                      <span
                        className={`text-[0.62rem] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                          item.is_mastered
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        <span>{item.is_mastered ? '✅ Dikuasai' : '⏳ Belum'}</span>
                      </span>
                    </div>

                    {/* Romaji */}
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                      {item.romaji}
                    </div>

                    {/* Meaning (Indonesian) */}
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug mb-3">
                      {item.meaning}
                    </div>

                    {/* Attached Memory Illustration / Photo (if any) */}
                    {item.image_url && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative group/img max-h-32 bg-slate-100 dark:bg-slate-900">
                        <img
                          src={item.image_url}
                          alt={item.meaning}
                          className="w-full h-28 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => setActiveImagePreview(item.image_url!)}
                        />
                        <button
                          onClick={() => setActiveImagePreview(item.image_url!)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <span>🔍</span>
                          <span>Perbesar</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Footer: Date of submission */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[0.65rem] text-slate-400">
                    <span>Disetor pada:</span>
                    <span className="font-semibold text-slate-500 dark:text-slate-300">
                      {formatFullDate(item.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">
            Menampilkan {filteredKotobaList.length} dari total {student.total_kotoba} kosakata
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Full Image Preview Modal */}
      {activeImagePreview && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveImagePreview(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh]">
            <img
              src={activeImagePreview}
              alt="Kotoba Visual Illustration"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setActiveImagePreview(null)}
              className="absolute -top-3 -right-3 size-8 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-md"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
