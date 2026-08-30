import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  fetchFeedbacks,
  updateFeedbackStatus,
  updateFeedbackAdminNotes,
  deleteFeedback,
  type FeedbackItem,
  type FeedbackStatus,
  type FeedbackCategory,
  CATEGORY_META,
  STATUS_META,
  FEEDBACK_UPDATE_EVENT,
} from '../lib/feedbackService'
import LoadingScreen from '../components/LoadingScreen'

export default function FeedbackManager() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedRating, setSelectedRating] = useState<string>('all')

  // Selected feedback for Detail Modal
  const [activeFeedback, setActiveFeedback] = useState<FeedbackItem | null>(null)
  const [editingNotes, setEditingNotes] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  async function loadData() {
    setLoading(true)
    const data = await fetchFeedbacks()
    setFeedbacks(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    const handleSync = () => {
      fetchFeedbacks().then(data => setFeedbacks(data))
    }

    window.addEventListener(FEEDBACK_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)

    return () => {
      window.removeEventListener(FEEDBACK_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [])

  // Security Access Check
  if (profile?.role !== 'admin') {
    return (
      <main className="flex-1 p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-xl">
          <div className="size-16 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 text-3xl flex items-center justify-center mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mb-2">
            Akses Khusus Admin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Halaman ini hanya dapat diakses oleh Administrator untuk mengelola masukan, saran, dan evaluasi pengguna platform.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold border-none cursor-pointer hover:opacity-90 transition-all"
          >
            ← Kembali ke Beranda
          </button>
        </div>
      </main>
    )
  }

  if (loading) {
    return <LoadingScreen message="Memuat Masukan & Saran Pengguna..." fullScreen={false} />
  }

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter((item) => {
    // 1. Status Filter
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false

    // 2. Category Filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false

    // 3. Rating Filter
    if (selectedRating !== 'all') {
      if (selectedRating === '5' && item.rating !== 5) return false
      if (selectedRating === '4' && item.rating !== 4) return false
      if (selectedRating === '3' && item.rating !== 3) return false
      if (selectedRating === 'low' && (item.rating > 2 || item.rating < 1)) return false
    }

    // 4. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const inMsg = (item.message || '').toLowerCase().includes(q)
      const inTitle = (item.title || '').toLowerCase().includes(q)
      const inName = (item.name || '').toLowerCase().includes(q)
      const inEmail = (item.email || '').toLowerCase().includes(q)
      const inPhone = (item.phone_number || '').toLowerCase().includes(q)
      const inPage = (item.page_url || '').toLowerCase().includes(q)
      if (!inMsg && !inTitle && !inName && !inEmail && !inPhone && !inPage) return false
    }

    return true
  })

  // Statistics
  const totalCount = feedbacks.length
  const unreadCount = feedbacks.filter(f => f.status === 'unread').length
  const inProgressCount = feedbacks.filter(f => f.status === 'in_progress').length
  const resolvedCount = feedbacks.filter(f => f.status === 'resolved').length
  const avgRating = totalCount > 0
    ? (feedbacks.reduce((sum, f) => sum + (f.rating || 5), 0) / totalCount).toFixed(1)
    : '5.0'

  async function handleStatusChange(id: string, newStatus: FeedbackStatus) {
    const res = await updateFeedbackStatus(id, newStatus)
    if (res.success) {
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f))
      if (activeFeedback && activeFeedback.id === id) {
        setActiveFeedback({ ...activeFeedback, status: newStatus })
      }
      showToast(`Status masukan berhasil diubah ke "${STATUS_META[newStatus].label}"`)
    } else {
      showToast(`Gagal: ${res.error}`)
    }
  }

  async function handleSaveNotes() {
    if (!activeFeedback) return
    setIsSavingNotes(true)
    const res = await updateFeedbackAdminNotes(activeFeedback.id, editingNotes)
    setIsSavingNotes(false)
    if (res.success) {
      setFeedbacks(prev => prev.map(f => f.id === activeFeedback.id ? { ...f, admin_notes: editingNotes } : f))
      setActiveFeedback({ ...activeFeedback, admin_notes: editingNotes })
      showToast('Catatan admin berhasil disimpan!')
    } else {
      showToast(`Gagal menyimpan catatan: ${res.error}`)
    }
  }

  async function handleDelete(id: string, titleOrSender: string) {
    if (!confirm(`Hapus masukan dari "${titleOrSender}"? Tindakan ini tidak dapat dibatalkan.`)) return
    const res = await deleteFeedback(id)
    if (res.success) {
      setFeedbacks(prev => prev.filter(f => f.id !== id))
      if (activeFeedback?.id === id) setActiveFeedback(null)
      showToast('Masukan berhasil dihapus.')
    } else {
      showToast(`Gagal: ${res.error}`)
    }
  }

  function openDetailModal(item: FeedbackItem) {
    setActiveFeedback(item)
    setEditingNotes(item.admin_notes || '')
    // Auto-mark as read if currently unread
    if (item.status === 'unread') {
      handleStatusChange(item.id, 'read')
    }
  }

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 bg-slate-900/90 text-white rounded-2xl shadow-xl backdrop-blur-md border border-slate-700/60 text-xs sm:text-sm font-bold animate-fade-in flex items-center gap-2">
          <span>✨</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="mb-6 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50 bg-cover bg-center text-white"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.95), rgba(180,83,9,0.85)), url('/japan-background(4).jpg')",
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider flex items-center gap-1">
              <span>💡</span>
              <span className="font-jp font-bold mr-1">ご意見・ご提案</span>
              <span>Panel Masukan & Saran</span>
            </span>
            {unreadCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-black animate-pulse">
                ● {unreadCount} Masukan Baru
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Kelola Masukan & Saran Pengguna</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed font-medium">
            Tinjau saran fitur, laporan bug/kendala teknis, serta evaluasi kepuasan dari para pelajar, pengajar, maupun pengunjung website.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start md:self-auto px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 cursor-pointer backdrop-blur-sm transition-all flex items-center gap-2"
        >
          <span>🔄</span>
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {/* Total */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400">Total Masukan</span>
            <span className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">
              📊
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</span>
            <span className="text-[0.68rem] text-slate-400 ml-1">pesan</span>
          </div>
        </div>

        {/* Unread */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-blue-500/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-blue-500">Belum Dibaca</span>
            <span className="size-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm">
              📬
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{unreadCount}</span>
            {unreadCount > 0 && (
              <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
                Perlu Review
              </span>
            )}
          </div>
        </div>

        {/* In Progress */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-amber-500">Sedang Diproses</span>
            <span className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm">
              ⏳
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{inProgressCount}</span>
            <span className="text-[0.68rem] text-slate-400 ml-1">dalam tahap kerja</span>
          </div>
        </div>

        {/* Resolved */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-500/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-emerald-500">Selesai / Diterapkan</span>
            <span className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
              ✅
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{resolvedCount}</span>
            <span className="text-[0.68rem] text-slate-400 ml-1">terselesaikan</span>
          </div>
        </div>

        {/* Rating */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400">Kepuasan Rata-rata</span>
            <span className="size-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-sm">
              ⭐
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{avgRating}</span>
            <span className="text-xs text-amber-400 font-bold">★ / 5.0</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari masukan berdasarkan kata kunci, judul, nama, atau email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {(Object.keys(CATEGORY_META) as FeedbackCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
                </option>
              ))}
            </select>

            {/* Rating Filter */}
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Bintang</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 Bintang)</option>
              <option value="4">⭐⭐⭐⭐ (4 Bintang)</option>
              <option value="3">⭐⭐⭐ (3 Bintang)</option>
              <option value="low">⭐ - ⭐⭐ (1-2 Bintang)</option>
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
            Status:
          </span>
          <button
            type="button"
            onClick={() => setSelectedStatus('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all border shrink-0 cursor-pointer ${
              selectedStatus === 'all'
                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
            }`}
          >
            Semua ({feedbacks.length})
          </button>
          {(Object.keys(STATUS_META) as FeedbackStatus[]).map((st) => {
            const count = feedbacks.filter(f => f.status === st).length
            const isSelected = selectedStatus === st
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all border shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
                }`}
              >
                <span>{STATUS_META[st].icon}</span>
                <span>{STATUS_META[st].label}</span>
                <span className="text-[0.65rem] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Feedback List Table / Cards */}
      {filteredFeedbacks.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
            Tidak ada masukan yang cocok dengan filter
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau ubah filter status dan kategori di atas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredFeedbacks.map((item) => {
            const catMeta = CATEGORY_META[item.category] || CATEGORY_META.saran_fitur
            const statMeta = STATUS_META[item.status] || STATUS_META.unread
            const formattedDate = new Date(item.created_at).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all hover:shadow-md ${
                  item.status === 'unread'
                    ? 'border-blue-300 dark:border-blue-800/80 ring-2 ring-blue-500/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  {/* Left: Sender & Category */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Pill */}
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${catMeta.badgeClass}`}>
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.label}</span>
                    </span>

                    {/* Rating Stars */}
                    <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/40 text-amber-500 text-xs font-black">
                      <span>★ {item.rating || 5}</span>
                    </div>

                    {/* Sender Identity */}
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>👤 {item.name}</span>
                      <span className="text-[0.65rem] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-semibold">
                        {item.role}
                      </span>
                    </span>

                    {/* Date */}
                    <span className="text-[0.7rem] text-slate-400 font-medium">
                      🕒 {formattedDate}
                    </span>
                  </div>

                  {/* Right: Status Dropdown & Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as FeedbackStatus)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer ${statMeta.badgeClass}`}
                    >
                      {(Object.keys(STATUS_META) as FeedbackStatus[]).map((st) => (
                        <option key={st} value={st}>
                          {STATUS_META[st].icon} {STATUS_META[st].label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => openDetailModal(item)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border-none cursor-pointer transition-all"
                    >
                      Buka Detail 🔍
                    </button>
                  </div>
                </div>

                {/* Title if present */}
                {item.title && (
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mb-1.5">
                    {item.title}
                  </h3>
                )}

                {/* Message Body */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line mb-3">
                  {item.message}
                </p>

                {/* Footer Info: Contact & Admin Notes */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
                    {item.email && (
                      <a
                        href={`mailto:${item.email}`}
                        className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                      >
                        ✉️ {item.email}
                      </a>
                    )}
                    {item.phone_number && (
                      <a
                        href={`https://wa.me/${item.phone_number.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        💬 WA: {item.phone_number}
                      </a>
                    )}
                    {item.page_url && (
                      <span className="truncate max-w-[200px] sm:max-w-xs text-[0.7rem] text-slate-400" title={item.page_url}>
                        🌐 {new URL(item.page_url, window.location.origin).pathname}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {item.admin_notes && (
                      <span className="text-[0.7rem] px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-900/40">
                        📝 Ada Catatan Admin
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.title || item.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-none bg-transparent cursor-pointer transition-all"
                      title="Hapus masukan ini"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── DETAIL & NOTES MODAL ───────────────────────────────────────────── */}
      {activeFeedback && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveFeedback(null)
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-up relative overflow-hidden my-auto max-h-[92dvh] flex flex-col text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded-xl text-xs font-bold border ${CATEGORY_META[activeFeedback.category]?.badgeClass}`}>
                    {CATEGORY_META[activeFeedback.category]?.icon} {CATEGORY_META[activeFeedback.category]?.label}
                  </span>
                  <span className="text-amber-500 font-bold text-xs">
                    {'★'.repeat(activeFeedback.rating || 5)} ({activeFeedback.rating || 5}/5)
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {activeFeedback.title || 'Detail Masukan Pengguna'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setActiveFeedback(null)}
                className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs sm:text-sm">
              {/* Full Message */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <span className="block text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Isi Pesan Masukan:
                </span>
                <p className="whitespace-pre-line text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {activeFeedback.message}
                </p>
              </div>

              {/* Sender Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <div>
                  <span className="block text-[0.65rem] font-bold text-slate-400 uppercase">Nama Pengirim</span>
                  <span className="font-extrabold text-slate-800 dark:text-white">{activeFeedback.name}</span>
                </div>
                <div>
                  <span className="block text-[0.65rem] font-bold text-slate-400 uppercase">Role / Status</span>
                  <span className="font-extrabold capitalize text-slate-800 dark:text-white">{activeFeedback.role}</span>
                </div>
                {activeFeedback.email && (
                  <div>
                    <span className="block text-[0.65rem] font-bold text-slate-400 uppercase">Email Kontak</span>
                    <a href={`mailto:${activeFeedback.email}`} className="font-bold text-primary hover:underline">
                      {activeFeedback.email}
                    </a>
                  </div>
                )}
                {activeFeedback.phone_number && (
                  <div>
                    <span className="block text-[0.65rem] font-bold text-slate-400 uppercase">WhatsApp</span>
                    <a
                      href={`https://wa.me/${activeFeedback.phone_number.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {activeFeedback.phone_number} →
                    </a>
                  </div>
                )}
                {activeFeedback.page_url && (
                  <div className="sm:col-span-2">
                    <span className="block text-[0.65rem] font-bold text-slate-400 uppercase">Halaman Sumber</span>
                    <a
                      href={activeFeedback.page_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-slate-600 dark:text-slate-300 hover:underline break-all"
                    >
                      {activeFeedback.page_url}
                    </a>
                  </div>
                )}
              </div>

              {/* Status Update Select */}
              <div>
                <label className="block text-[0.72rem] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Ubah Status Masukan
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['unread', 'in_progress', 'resolved', 'archived'] as FeedbackStatus[]).map((st) => {
                    const isSelected = activeFeedback.status === st
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(activeFeedback.id, st)}
                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{STATUS_META[st].icon}</span>
                        <span>{STATUS_META[st].label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Admin Internal Notes Editor */}
              <div>
                <label className="block text-[0.72rem] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  📝 Catatan Internal Admin
                </label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Tambahkan catatan untuk tim pengembang (misal: 'Sudah dimasukkan ke roadmap v2.1' atau 'Sudah diperbaiki pada commit #abc')..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold border-none cursor-pointer shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingNotes ? 'Menyimpan...' : 'Simpan Catatan Admin 💾'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDelete(activeFeedback.id, activeFeedback.name)}
                className="px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold border-none cursor-pointer transition-all"
              >
                🗑️ Hapus Masukan
              </button>

              <button
                type="button"
                onClick={() => setActiveFeedback(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border-none cursor-pointer hover:bg-slate-200 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
