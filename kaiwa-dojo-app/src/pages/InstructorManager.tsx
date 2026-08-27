import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  type InstructorAccount,
  fetchInstructors,
  createInstructorAccount,
  updateInstructorAccount,
  deleteInstructorAccount
} from '../lib/instructorService'

export default function InstructorManager() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [instructors, setInstructors] = useState<InstructorAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false)

  // Edit Modal State
  const [editingInst, setEditingInst] = useState<InstructorAccount | null>(null)

  // Form Fields State
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [bio, setBio] = useState('')
  const [expertise, setExpertise] = useState('Bunpou, Kaiwa')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const data = await fetchInstructors()
    setInstructors(data)
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
    setPassword('')
    setBio('')
    setExpertise('Bunpou, Kaiwa')
    setShowAddModal(true)
  }

  function openEditModal(inst: InstructorAccount) {
    setEditingInst(inst)
    setFullName(inst.full_name)
    setUsername(inst.username)
    setEmail(inst.email)
    setBio(inst.bio || '')
    setExpertise(inst.expertise.join(', '))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim() || !password.trim()) {
      alert('Mohon isi nama lengkap, username, email, dan password pengajar!')
      return
    }

    if (password.length < 6) {
      alert('Kata sandi / password pengajar minimal harus 6 karakter!')
      return
    }

    setSaving(true)
    const expArr = expertise.split(',').map(s => s.trim()).filter(Boolean)
    const created = await createInstructorAccount({
      full_name: fullName,
      username,
      email,
      password,
      bio,
      expertise: expArr.length > 0 ? expArr : ['Kaiwa', 'Japanese'],
    })

    setSaving(false)
    setShowAddModal(false)
    showToastMsg(`Berhasil membuat akun Pemateri baru: ${created.full_name}! Password telah dikonfigurasi.`)
    await loadData()
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingInst) return
    if (!fullName.trim() || !username.trim() || !email.trim()) {
      alert('Mohon isi nama lengkap, username, dan email pengajar!')
      return
    }

    setSaving(true)
    const expArr = expertise.split(',').map(s => s.trim()).filter(Boolean)
    await updateInstructorAccount(editingInst.id, {
      full_name: fullName,
      username,
      email,
      bio,
      expertise: expArr.length > 0 ? expArr : editingInst.expertise,
    })

    setSaving(false)
    setEditingInst(null)
    showToastMsg(`Berhasil memperbarui data akun Pemateri: ${fullName}!`)
    await loadData()
  }

  async function handleDelete(inst: InstructorAccount) {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus akun Pemateri "${inst.full_name}" (@${inst.username})? Action ini tidak dapat dibatalkan.`)
    if (!confirmDelete) return

    await deleteInstructorAccount(inst.id)
    showToastMsg(`Akun Pemateri "${inst.full_name}" telah dihapus!`)
    await loadData()
  }

  // Security check: Only admin can access
  if (profile?.role !== 'admin') {
    return (
      <main className="flex-1 p-6 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Akses Terbatas Khusus Admin</h2>
        <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
          Halaman ini khusus diperuntukkan untuk Admin (kaiwahiroshima) untuk membuat, mengedit, dan menghapus akun Pemateri.
        </p>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl border-none cursor-pointer">
          Kembali ke Dashboard
        </button>
      </main>
    )
  }

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
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-primary/20 text-red-300 border border-primary/30 text-xs font-black uppercase tracking-wider">
              👑 Menu Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
              {instructors.length} Pemateri Terdaftar
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>👨‍🏫 Manajemen Full Kontrol Akun Pemateri</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Halaman khusus Admin untuk **menambah, mengedit, dan menghapus** akun Pemateri/Pengajar.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-5 py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md shrink-0 flex items-center justify-center gap-2"
        >
          <span>+ Tambah Akun Pemateri Baru</span>
        </button>
      </div>

      {/* Instructors List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <span>📋 Daftar Pemateri / Pengajar Aktif</span>
          </h3>
          <span className="text-xs text-slate-400 font-bold">Total: {instructors.length} Sensei</span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : instructors.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm italic">
            Belum ada akun pemateri yang terdaftar. Klik "+ Tambah Akun Pemateri Baru" di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[0.7rem] font-black uppercase text-slate-400 tracking-wider">
                  <th className="pb-3 px-2">Sensei / Pengajar</th>
                  <th className="pb-3 px-2">Username & Email</th>
                  <th className="pb-3 px-2">No. WhatsApp</th>
                  <th className="pb-3 px-2">Bidang Keahlian</th>
                  <th className="pb-3 px-2">Role Status</th>
                  <th className="pb-3 px-2 text-right">Aksi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold">
                {instructors.map(inst => (
                  <tr key={inst.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={inst.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.username}`}
                          alt={inst.full_name}
                          className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                        />
                        <div>
                          <div className="font-extrabold text-slate-800 dark:text-white">{inst.full_name}</div>
                          <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 line-clamp-1">{inst.bio || 'Pengajar KaiwaDojo'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-bold text-slate-700 dark:text-slate-200">@{inst.username}</div>
                      <div className="text-[0.68rem] text-slate-400">{inst.email}</div>
                    </td>
                    <td className="py-3 px-2">
                      {inst.phone_number ? (
                        <a
                          href={`https://wa.me/${inst.phone_number.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[0.68rem] font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          <span>📱</span>
                          <span>{inst.phone_number}</span>
                        </a>
                      ) : (
                        <span className="text-[0.65rem] text-slate-400 italic">— Tidak ada</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {inst.expertise.map((exp, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[0.65rem] font-bold">
                            {exp}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[0.65rem] font-black uppercase">
                        👨‍🏫 Pemateri
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(inst)}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border-none cursor-pointer transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(inst)}
                          className="px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-300 text-xs font-bold border-none cursor-pointer transition-colors"
                        >
                          🗑️ Hapus
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

      {/* Add Instructor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 bg-gradient-to-r from-primary to-primary-light text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Admin Panel</span>
                <h3 className="text-lg font-extrabold">👨‍🏫 Tambah Akun Pemateri</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="size-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-lg flex items-center justify-center">×</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Nama Lengkap Pengajar *</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: Sato Sensei"
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
                    placeholder="contoh: satosensei"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Email Pengajar *</label>
                  <input
                    type="email"
                    required
                    placeholder="sato@kaiwadojo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Password Akun Pemateri (Min. 6 Karakter) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password123!"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Bio / Deskripsi Pengajar</label>
                <input
                  type="text"
                  placeholder="Spesialis Bunpou & Percakapan Alami N3"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Bidang Keahlian (Pisahkan dengan koma)</label>
                <input
                  type="text"
                  placeholder="Bunpou, Kaiwa, JLPT N3"
                  value={expertise}
                  onChange={e => setExpertise(e.target.value)}
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
                  {saving ? 'Menyimpan...' : 'Simpan Pemateri'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Instructor Modal */}
      {editingInst && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Admin Panel</span>
                <h3 className="text-lg font-extrabold">✏️ Edit Akun Pemateri</h3>
              </div>
              <button onClick={() => setEditingInst(null)} className="size-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-lg flex items-center justify-center">×</button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Nama Lengkap Pengajar *</label>
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Bio / Deskripsi</label>
                <input
                  type="text"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">Bidang Keahlian (Pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={expertise}
                  onChange={e => setExpertise(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingInst(null)}
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
