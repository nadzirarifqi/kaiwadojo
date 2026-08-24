import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  type StudentAccount,
  type StudentStatus,
  fetchStudents,
  createStudentAccount,
  updateStudentAccount,
  deleteStudentAccount,
  approveStudentAccount,
  rejectStudentAccount,
} from '../lib/studentService'
import { sendWhatsAppApprovalNotice } from '../lib/whatsappService'

export default function StudentManager() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [students, setStudents] = useState<StudentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all')

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false)

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<StudentAccount | null>(null)

  // Form Fields State
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState<StudentStatus>('approved')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const data = await fetchStudents()
    setStudents(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function showToastMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function openAddModal() {
    setFullName('')
    setUsername('')
    setEmail('')
    setBio('')
    setStatus('approved')
    setShowAddModal(true)
  }

  function openEditModal(std: StudentAccount) {
    setEditingStudent(std)
    setFullName(std.full_name)
    setUsername(std.username)
    setEmail(std.email)
    setBio(std.bio || '')
    setStatus(std.status || 'approved')
  }

  async function handleApprove(std: StudentAccount) {
    setSaving(true)

    // 1. Update React state secara instan
    setStudents(prev =>
      prev.map(item => (item.id === std.id || item.username === std.username ? { ...item, status: 'approved' } : item))
    )

    // 2. Simpan status 'approved' ke Supabase DB
    await approveStudentAccount(std.id)

    // 3. Kirim Notifikasi WhatsApp Persetujuan via Fonnte API
    const waTarget = std.phone_number || std.username || ''
    const waSent = await sendWhatsAppApprovalNotice({
      phoneNumber: waTarget,
      fullName: std.full_name,
      username: std.username,
    })

    setSaving(false)
    if (waSent) {
      showToastMsg(`Akun "${std.full_name}" Disetujui & Pesan WA Berhasil Terkirim ke WA ${waTarget}! ✅`)
    } else {
      showToastMsg(`Akun "${std.full_name}" Disetujui! ✅`)
    }

    await loadData()
  }

  async function handleReject(std: StudentAccount) {
    if (!confirm(`Apakah Anda yakin ingin menolak/menonaktifkan akun "${std.full_name}"?`)) return
    setSaving(true)

    // 1. Update React state secara instan
    setStudents(prev =>
      prev.map(item =>
        item.id === std.id || item.username.toLowerCase() === std.username.toLowerCase()
          ? { ...item, status: 'rejected' }
          : item
      )
    )

    // 2. Simpan status 'rejected' ke DB Supabase
    await rejectStudentAccount(std.id)

    setSaving(false)
    showToastMsg(`Akun pelajar "${std.full_name}" telah dinonaktifkan ❌`)
    await loadData()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim()) {
      alert('Mohon isi nama lengkap, username, dan email siswa!')
      return
    }

    setSaving(true)
    const created = await createStudentAccount({
      full_name: fullName,
      username,
      email,
      bio,
      status,
    })

    setSaving(false)
    setShowAddModal(false)
    if (created) {
      showToastMsg(`Berhasil menambahkan akun Pelajar baru: ${created.full_name}!`)
    } else {
      showToastMsg(`Gagal menambahkan akun Pelajar. Periksa koneksi/DB! ❌`)
    }
    await loadData()
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingStudent) return
    if (!fullName.trim() || !username.trim() || !email.trim()) {
      alert('Mohon isi nama lengkap, username, dan email siswa!')
      return
    }

    setSaving(true)
    await updateStudentAccount(editingStudent.id, {
      full_name: fullName,
      username,
      email,
      bio,
      status,
    })

    setSaving(false)
    setEditingStudent(null)
    showToastMsg(`Berhasil memperbarui data akun Pelajar: ${fullName}!`)
    await loadData()
  }

  async function handleDelete(std: StudentAccount) {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun pelajar "${std.full_name}" (@${std.username}) secara permanen?`)) return

    setSaving(true)

    // 1. Hapus dari React state secara instan
    setStudents(prev => prev.filter(s => s.id !== std.id && s.username.toLowerCase() !== std.username.toLowerCase()))

    // 2. Hapus dari Supabase DB
    const success = await deleteStudentAccount(std.id)

    setSaving(false)
    if (success) {
      showToastMsg(`Berhasil menghapus akun pelajar "${std.full_name}". ✅`)
    } else {
      showToastMsg(`Gagal menghapus akun pelajar "${std.full_name}". ❌`)
    }
    await loadData()
  }

  // Security check: Only admin can access
  if (profile?.role !== 'admin') {
    return (
      <main className="flex-1 p-6 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Akses Terbatas Khusus Admin</h2>
        <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
          Halaman ini khusus diperuntukkan untuk Super Admin untuk mengelola akun Pelajar/Siswa.
        </p>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl border-none cursor-pointer">
          Kembali ke Dashboard
        </button>
      </main>
    )
  }

  const pendingCount = students.filter(s => s.status === 'pending').length
  const approvedCount = students.filter(s => s.status === 'approved').length

  const filteredStudents = students.filter(std => {
    if (statusFilter === 'pending') return std.status === 'pending'
    if (statusFilter === 'approved') return std.status === 'approved'
    return true
  })

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-[600] bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-extrabold animate-bounce flex items-center gap-2">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-7 rounded-3xl shadow-xl border border-slate-700/50">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-primary/20 text-red-300 border border-primary/30 text-xs font-black uppercase tracking-wider">
              👑 Menu Super Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
              {approvedCount} Pelajar Terverifikasi
            </span>
            {pendingCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black animate-pulse">
                ⏳ {pendingCount} Menunggu Persetujuan
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>🎓 Kelola & Verifikasi Akun Pelajar</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Halaman khusus Admin untuk **menyetujui (approve), menolak, menambah, dan mengedit** data akun Pelajar Kaiwa Dojo.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-5 py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md shrink-0 flex items-center justify-center gap-2"
        >
          <span>+ Tambah Akun Pelajar Baru</span>
        </button>
      </div>

      {/* Students List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span>📋 Daftar Akun Siswa / Pelajar</span>
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({students.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-amber-500'
              }`}
            >
              ⏳ Menunggu ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              ✅ Terverifikasi ({approvedCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm italic">
            {statusFilter === 'pending'
              ? 'Tidak ada akun pelajar yang sedang menunggu verifikasi.'
              : 'Belum ada akun pelajar yang terdaftar dalam kategori ini.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[0.7rem] font-black uppercase text-slate-400 tracking-wider">
                  <th className="pb-3 px-2">Nama Siswa</th>
                  <th className="pb-3 px-2">Username & Email</th>
                  <th className="pb-3 px-2">Status Verifikasi</th>
                  <th className="pb-3 px-2">Bio / Catatan</th>
                  <th className="pb-3 px-2 text-right">Aksi Verifikasi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold">
                {filteredStudents.map(std => (
                  <tr key={std.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={std.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${std.username}`}
                          alt={std.full_name}
                          className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                        />
                        <div>
                          <div className="font-extrabold text-slate-800 dark:text-white">{std.full_name}</div>
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[0.65rem] font-black uppercase">
                            🎓 Pelajar
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-bold text-slate-700 dark:text-slate-200">@{std.username}</div>
                      <div className="text-[0.68rem] text-slate-400">{std.email}</div>
                    </td>
                    <td className="py-3 px-2">
                      {std.status === 'pending' ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[0.68rem] font-black border border-amber-300 dark:border-amber-800 animate-pulse">
                          ⏳ Menunggu Verifikasi
                        </span>
                      ) : std.status === 'rejected' ? (
                        <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[0.68rem] font-black border border-red-300 dark:border-red-800">
                          ❌ Ditolak / Nonaktif
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[0.68rem] font-black border border-emerald-300 dark:border-emerald-800">
                          ✅ Terverifikasi
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-slate-600 dark:text-slate-300 text-[0.7rem] max-w-xs line-clamp-1">{std.bio || 'Siswa Kaiwa Dojo'}</div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {std.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApprove(std)}
                              disabled={saving}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black border-none cursor-pointer transition-all shadow-xs"
                            >
                              ✓ Setujui (Approve)
                            </button>
                            <button
                              onClick={() => handleReject(std)}
                              disabled={saving}
                              className="px-2.5 py-1.5 rounded-xl bg-red-100 dark:bg-red-950 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs font-bold border-none cursor-pointer transition-colors"
                            >
                              ✕ Tolak
                            </button>
                          </>
                        ) : std.status === 'rejected' ? (
                          <button
                            onClick={() => handleApprove(std)}
                            disabled={saving}
                            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border-none cursor-pointer transition-colors"
                          >
                            ✓ Setujui Ulang
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReject(std)}
                            disabled={saving}
                            className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 text-xs font-bold border-none cursor-pointer transition-colors"
                          >
                            🔒 Nonaktifkan
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(std)}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border-none cursor-pointer transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(std)}
                          className="px-2 py-1 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-100 text-red-600 dark:text-red-300 text-xs font-bold border-none cursor-pointer transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 bg-gradient-to-r from-primary to-primary-light text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Admin Panel</span>
                <h3 className="text-lg font-extrabold">🎓 Tambah Akun Pelajar</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="size-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-lg flex items-center justify-center">×</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: Budi Santoso"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Username Login *</label>
                  <input
                    type="text"
                    required
                    placeholder="budisantoso"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Email Siswa *</label>
                  <input
                    type="email"
                    required
                    placeholder="budi@kaiwadojo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Bio / Deskripsi Siswa</label>
                <input
                  type="text"
                  placeholder="Persiapan kerja magang di Tokyo"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl border-none cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white font-extrabold rounded-xl border-none cursor-pointer text-xs shadow-md"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Akun Pelajar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Admin Panel</span>
                <h3 className="text-lg font-extrabold">✏️ Edit Akun Pelajar</h3>
              </div>
              <button onClick={() => setEditingStudent(null)} className="size-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-lg flex items-center justify-center">×</button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Bio / Deskripsi Siswa</label>
                <input
                  type="text"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl border-none cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl border-none cursor-pointer text-xs shadow-md"
                >
                  {saving ? 'Memperbarui...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
