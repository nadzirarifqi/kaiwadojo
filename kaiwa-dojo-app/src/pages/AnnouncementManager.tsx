import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  type Announcement,
  type AnnouncementCategory,
  type TargetAudience,
  type CreateAnnouncementPayload,
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchAnnouncementReadStats,
  CATEGORY_CONFIG,
  AUDIENCE_CONFIG,
  ANNOUNCEMENT_UPDATE_EVENT,
  subscribeToAnnouncementRealtime,
} from '../lib/announcementService'
import { fetchGroups, type KaiwaGroup } from '../lib/groupService'
import LoadingScreen from '../components/LoadingScreen'
import AnnouncementModal from '../components/AnnouncementModal'

export default function AnnouncementManager() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [readStats, setReadStats] = useState<Record<string, number>>({})
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterAudience, setFilterAudience] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Announcement | null>(null)
  const [previewItem, setPreviewItem] = useState<Announcement | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<CreateAnnouncementPayload>({
    title: '',
    content: '',
    category: 'info',
    target_audience: 'all',
    target_group: '',
    is_active: true,
    is_pinned: false,
    author_name: profile?.full_name || 'Admin Dojo',
    action_url: '',
    action_text: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function loadData() {
    setLoading(true)
    const [annList, stats, groupList] = await Promise.all([
      fetchAnnouncements(),
      fetchAnnouncementReadStats(),
      fetchGroups(true),
    ])
    setAnnouncements(annList)
    setReadStats(stats)
    setGroups(groupList)
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    const handleSync = () => {
      fetchAnnouncements().then(setAnnouncements)
      fetchAnnouncementReadStats().then(setReadStats)
    }

    window.addEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)
    const unsubscribe = subscribeToAnnouncementRealtime(handleSync)

    return () => {
      window.removeEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribe()
    }
  }, [])

  // Security Check
  if (profile?.role !== 'admin') {
    return (
      <main className="flex-1 p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-xl">
          <div className="size-16 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 text-3xl flex items-center justify-center mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mb-2">
            Akses Khusus Administrator
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Halaman ini hanya dapat diakses oleh Admin KaiwaDojo untuk mempublikasikan pengumuman resmi ke seluruh platform.
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
    return <LoadingScreen message="Memuat Papan Pengumuman Admin..." fullScreen={false} />
  }

  // Open Create Modal
  function handleOpenCreate() {
    setFormData({
      title: '',
      content: '',
      category: 'info',
      target_audience: 'all',
      target_group: '',
      is_active: true,
      is_pinned: false,
      author_name: profile?.full_name || 'Admin Dojo',
      action_url: '',
      action_text: '',
    })
    setIsCreateModalOpen(true)
  }

  // Open Edit Modal
  function handleOpenEdit(ann: Announcement) {
    setEditingItem(ann)
    setFormData({
      title: ann.title,
      content: ann.content,
      category: ann.category,
      target_audience: ann.target_audience,
      target_group: ann.target_group || '',
      is_active: ann.is_active,
      is_pinned: ann.is_pinned,
      author_name: ann.author_name,
      action_url: ann.action_url || '',
      action_text: ann.action_text || '',
    })
    setIsCreateModalOpen(true)
  }

  // Handle Form Submit (Create / Edit)
  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title.trim()) {
      showToast('⚠️ Judul pengumuman tidak boleh kosong!')
      return
    }
    if (!formData.content.trim()) {
      showToast('⚠️ Isi pengumuman tidak boleh kosong!')
      return
    }

    setSubmitting(true)
    if (editingItem) {
      const res = await updateAnnouncement(editingItem.id, formData)
      if (res.success) {
        showToast('✓ Pengumuman berhasil diperbarui!')
        setIsCreateModalOpen(false)
        setEditingItem(null)
        await loadData()
      } else {
        showToast(`❌ Gagal memperbarui: ${res.error}`)
      }
    } else {
      const res = await createAnnouncement({
        ...formData,
        author_id: profile?.id,
        author_name: formData.author_name || profile?.full_name || 'Admin Dojo',
      })
      if (res.success) {
        showToast('✓ Pengumuman baru berhasil diterbitkan!')
        setIsCreateModalOpen(false)
        await loadData()
      } else {
        showToast(`❌ Gagal menerbitkan: ${res.error}`)
      }
    }
    setSubmitting(false)
  }

  // Toggle Active Status
  async function handleToggleActive(ann: Announcement) {
    const newStatus = !ann.is_active
    const res = await updateAnnouncement(ann.id, { is_active: newStatus })
    if (res.success) {
      showToast(newStatus ? '✓ Pengumuman diaktifkan' : '✓ Pengumuman dinonaktifkan')
      await loadData()
    }
  }

  // Toggle Pinned Status
  async function handleTogglePin(ann: Announcement) {
    const newPin = !ann.is_pinned
    const res = await updateAnnouncement(ann.id, { is_pinned: newPin })
    if (res.success) {
      showToast(newPin ? '📌 Pengumuman di-pin ke paling atas' : '✓ Pin dilepas')
      await loadData()
    }
  }

  // Delete Announcement
  async function handleDelete(id: string) {
    setSubmitting(true)
    const res = await deleteAnnouncement(id)
    if (res.success) {
      showToast('✓ Pengumuman telah dihapus.')
      setDeleteConfirmId(null)
      await loadData()
    } else {
      showToast(`❌ Gagal menghapus: ${res.error}`)
    }
    setSubmitting(false)
  }

  // Filtering list
  const filteredAnnouncements = announcements.filter(ann => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const titleMatch = ann.title.toLowerCase().includes(q)
      const contentMatch = ann.content.toLowerCase().includes(q)
      const authorMatch = ann.author_name?.toLowerCase().includes(q)
      if (!titleMatch && !contentMatch && !authorMatch) return false
    }

    // Category filter
    if (filterCategory !== 'all' && ann.category !== filterCategory) {
      return false
    }

    // Audience filter
    if (filterAudience !== 'all' && ann.target_audience !== filterAudience) {
      return false
    }

    // Status filter
    if (filterStatus === 'active' && !ann.is_active) return false
    if (filterStatus === 'inactive' && ann.is_active) return false

    return true
  })

  // Calculations for top metrics
  const totalCount = announcements.length
  const activeCount = announcements.filter(a => a.is_active).length
  const pinnedCount = announcements.filter(a => a.is_pinned).length
  const totalReads = Object.values(readStats).reduce((acc, curr) => acc + curr, 0)

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl shadow-xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <span>🔔</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-red-500/15 via-primary/20 to-amber-500/20 text-primary dark:text-red-400 flex items-center justify-center text-3xl shadow-xs border border-primary/20 shrink-0">
            📢
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Kelola Papan Pengumuman
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:text-red-400 font-jp">
                お知らせ管理
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Buat, edit, dan publikasikan pengumuman resmi yang langsung muncul di layar siswa saat pertama kali login.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-3 rounded-2xl bg-primary hover:bg-primary-dark active:scale-95 text-white text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border-none cursor-pointer shrink-0"
        >
          <span className="text-base">➕</span>
          <span>Buat Pengumuman Baru</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-bold border border-blue-500/20 shrink-0">
            📑
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Pengumuman
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
              {totalCount}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold border border-emerald-500/20 shrink-0">
            🟢
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Aktif / Tayang
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold border border-amber-500/20 shrink-0">
            📌
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Di-Pin ke Atas
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {pinnedCount}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold border border-purple-500/20 shrink-0">
            👁️
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Dibaca Siswa
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
              {totalReads}x
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Cari judul atau isi..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <option value="all">Semua Kategori</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>

          {/* Audience Filter */}
          <select
            value={filterAudience}
            onChange={e => setFilterAudience(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <option value="all">Semua Target Audiens</option>
            {Object.entries(AUDIENCE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <option value="all">Semua Status (Aktif & Nonaktif)</option>
            <option value="active">🟢 Hanya Aktif / Tayang</option>
            <option value="inactive">⚪ Hanya Nonaktif / Arsip</option>
          </select>
        </div>
      </div>

      {/* Announcement Cards List */}
      <div className="space-y-4">
        {filteredAnnouncements.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
            <div className="text-4xl">📭</div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              Belum ada pengumuman yang sesuai filter
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Silakan sesuaikan filter pencarian Anda atau buat pengumuman baru untuk diterbitkan ke peserta didik.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold border-none cursor-pointer hover:opacity-90 transition-all"
            >
              + Buat Pengumuman Baru
            </button>
          </div>
        ) : (
          filteredAnnouncements.map(ann => {
            const catCfg = CATEGORY_CONFIG[ann.category] || CATEGORY_CONFIG.info
            const audCfg = AUDIENCE_CONFIG[ann.target_audience] || AUDIENCE_CONFIG.all
            const reads = readStats[ann.id] || 0

            return (
              <div
                key={ann.id}
                className={`p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border transition-all shadow-xs ${
                  ann.is_pinned
                    ? 'border-amber-400/60 dark:border-amber-500/40 ring-1 ring-amber-400/20'
                    : 'border-slate-200 dark:border-slate-800'
                } ${!ann.is_active ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50' : ''}`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-lg flex items-center justify-center shrink-0">
                      {catCfg.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${catCfg.badgeClass}`}>
                          {catCfg.label}
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                          <span>{audCfg.icon}</span>
                          <span>{audCfg.label}</span>
                        </span>

                        {ann.target_group && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                            🏷️ Grup: {ann.target_group}
                          </span>
                        )}

                        {ann.is_pinned && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            📌 Di-Pin
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            ann.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-500/10 text-slate-500 border-slate-400/30'
                          }`}
                        >
                          {ann.is_active ? '🟢 Tayang Aktif' : '⚪ Nonaktif / Draf'}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                        {ann.title}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Oleh: <span className="font-semibold text-slate-600 dark:text-slate-300">{ann.author_name}</span> •{' '}
                        {new Date(ann.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Top Action Quick Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => setPreviewItem(ann)}
                      title="Pratinjau Tampilan Pengguna"
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border-none cursor-pointer flex items-center gap-1.5"
                    >
                      <span>👁️</span>
                      <span>Pratinjau Pop-up</span>
                    </button>

                    <button
                      onClick={() => handleTogglePin(ann)}
                      title={ann.is_pinned ? 'Lepas Pin' : 'Pin ke Paling Atas'}
                      className={`size-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all border cursor-pointer ${
                        ann.is_pinned
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-500'
                      }`}
                    >
                      📌
                    </button>

                    <button
                      onClick={() => handleOpenEdit(ann)}
                      title="Edit Pengumuman"
                      className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(ann.id)}
                      title="Hapus Pengumuman"
                      className="size-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-bold transition-all border border-rose-200 dark:border-rose-900 cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Content snippet */}
                <div className="py-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed line-clamp-3">
                  {ann.content}
                </div>

                {/* Action button link if attached */}
                {ann.action_url && ann.action_text && (
                  <div className="pt-1 pb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary dark:text-red-400 bg-primary/5 dark:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                      <span>🔗 Tombol Aksi:</span>
                      <span>"{ann.action_text}"</span>
                      <span className="text-[10px] text-slate-400">({ann.action_url})</span>
                    </span>
                  </div>
                )}

                {/* Footer status row */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                      <span>👥</span>
                      <span>{reads} Pengguna telah membaca</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Status Tayang:</span>
                    <button
                      onClick={() => handleToggleActive(ann)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                        ann.is_active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 hover:bg-emerald-500/10 hover:text-emerald-600'
                      }`}
                    >
                      {ann.is_active ? '✓ Aktif (Klik utk Matikan)' : '✕ Nonaktif (Klik utk Aktifkan)'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── CREATE / EDIT MODAL ───────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary dark:text-red-400 flex items-center justify-center text-lg font-bold">
                  {editingItem ? '✏️' : '📢'}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingItem ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pengumuman ini akan langsung muncul sebagai pop-up di layar login pengguna.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setEditingItem(null)
                }}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold flex items-center justify-center border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Judul */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Judul Pengumuman <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jadwal Libur Obon & Pembaruan Materi Bab 15 🌸"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Kategori & Target Audiens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kategori Pengumuman
                  </label>
                  <select
                    value={formData.category}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, category: e.target.value as AnnouncementCategory }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.icon} {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Audiens
                  </label>
                  <select
                    value={formData.target_audience}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, target_audience: e.target.value as TargetAudience }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.entries(AUDIENCE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.icon} {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Grup (Opsional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Grup Spesifik (Opsional - Kosongkan jika untuk semua grup)
                </label>
                <select
                  value={formData.target_group || ''}
                  onChange={e => setFormData(prev => ({ ...prev, target_group: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">-- Semua Grup Belajar --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.name}>
                      Grup: {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Isi Pengumuman */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Isi Pesan Pengumuman <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder="Tuliskan isi pengumuman secara rinci. Gunakan enter/baris baru untuk memisahkan paragraf atau poin-poin..."
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 leading-relaxed resize-y"
                />
              </div>

              {/* Action Button Links (Opsional) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span>🔗</span>
                  <span>Tombol Aksi Tambahan (Opsional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Teks Tombol Aksi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Buka Kursus Sekarang"
                      value={formData.action_text || ''}
                      onChange={e => setFormData(prev => ({ ...prev, action_text: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      URL Tujuan / Link Halaman
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: /learning-plan atau https://..."
                      value={formData.action_url || ''}
                      onChange={e => setFormData(prev => ({ ...prev, action_url: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles (Aktif & Pinned) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="size-4 accent-primary rounded-sm"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white">
                      Langsung Aktifkan
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Pengumuman akan langsung tayang bagi user
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_pinned}
                    onChange={e => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
                    className="size-4 accent-primary rounded-sm"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white">
                      📌 Pin ke Paling Atas
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Prioritas utama di urutan teratas
                    </div>
                  </div>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false)
                    setEditingItem(null)
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark active:scale-95 text-white text-xs font-black shadow-md transition-all border-none cursor-pointer flex items-center gap-1.5"
                >
                  <span>{submitting ? '⏳ Menyimpan...' : editingItem ? 'Simpan Perubahan' : '📢 Terbitkan Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
            <div className="size-14 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl mx-auto">
              🗑️
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Hapus Pengumuman Ini?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tindakan ini permanen. Pengumuman beserta catatan pembacaannya akan dihapus dari sistem.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all border-none cursor-pointer"
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE PREVIEW MODAL ───────────────────────── */}
      {previewItem && (
        <AnnouncementModal
          isOpen={Boolean(previewItem)}
          onClose={() => setPreviewItem(null)}
          announcements={[previewItem]}
        />
      )}
    </main>
  )
}
