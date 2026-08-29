import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  fetchGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  syncAllStudentsWithGroups,
  matchGroupFromInstitution,
  parseKeywords,
  type KaiwaGroup,
} from '../lib/groupService'
import { fetchStudents, type StudentAccount } from '../lib/studentService'
import LoadingScreen from '../components/LoadingScreen'

export default function GroupManagerPage() {
  const navigate = useNavigate()

  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [students, setStudents] = useState<StudentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<KaiwaGroup | null>(null)
  const [formName, setFormName] = useState('')
  const [formKeywords, setFormKeywords] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Member View Drawer / Modal
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<KaiwaGroup | null>(null)
  const [memberSearch, setMemberSearch] = useState('')

  // Simulator / Keyword Match Tester
  const [testInput, setTestInput] = useState('')

  function showToast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadData() {
    setLoading(true)
    const [groupsData, studentsData] = await Promise.all([
      fetchGroups(true),
      fetchStudents(),
    ])
    setGroups(groupsData)
    setStudents(studentsData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function openAddModal() {
    setEditingGroup(null)
    setFormName('')
    setFormKeywords('')
    setFormDescription('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(grp: KaiwaGroup) {
    setEditingGroup(grp)
    setFormName(grp.name)
    setFormKeywords(grp.keywords || '')
    setFormDescription(grp.description || '')
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const name = formName.trim()
    if (!name) {
      setFormError('Nama grup tidak boleh kosong!')
      return
    }

    setSaving(true)
    if (editingGroup) {
      // 1. Instant UI update
      setGroups(prev =>
        prev.map(g =>
          g.id === editingGroup.id || g.name.toLowerCase() === editingGroup.name.toLowerCase()
            ? { ...g, name, keywords: formKeywords, description: formDescription }
            : g
        )
      )

      const res = await updateGroup(editingGroup.id, editingGroup.name, {
        name,
        keywords: formKeywords,
        description: formDescription,
      })
      if (res.success) {
        showToast(`Grup "${name}" berhasil diperbarui!`, 'success')
        setModalOpen(false)
        await loadData()
      } else {
        setFormError(res.error || 'Gagal memperbarui grup.')
      }
    } else {
      const res = await createGroup({
        name,
        keywords: formKeywords,
        description: formDescription,
      })
      if (res.success) {
        showToast(`Grup "${name}" berhasil ditambahkan!`, 'success')
        setModalOpen(false)
        await loadData()
      } else {
        setFormError(res.error || 'Gagal menambahkan grup.')
      }
    }
    setSaving(false)
  }

  async function handleDelete(grp: KaiwaGroup) {
    const studentCount = students.filter(s => (s.group_name || '').toLowerCase() === grp.name.toLowerCase()).length
    const confirmMsg = studentCount > 0
      ? `Grup "${grp.name}" saat ini memiliki ${studentCount} siswa terdaftar.\n\nJika dihapus, seluruh siswa tersebut akan otomatis diubah menjadi "Siswa Biasa (Tanpa Grup)" dan jadwal khusus grup ini akan terbuka untuk umum.\n\nLanjutkan penghapusan?`
      : `Hapus grup "${grp.name}"?`

    if (!confirm(confirmMsg)) return

    setSaving(true)
    const res = await deleteGroup(grp.id, grp.name)
    if (res.success) {
      showToast(`Grup "${grp.name}" berhasil dihapus.`, 'info')
      await loadData()
    } else {
      showToast(res.error || 'Gagal menghapus grup.', 'error')
    }
    setSaving(false)
  }

  async function handleRunSync() {
    if (
      !confirm(
        'Sinkronisasi Semua Siswa?\n\nSistem akan mengevaluasi ulang teks instansi setiap siswa terhadap kata kunci grup yang aktif. Siswa yang tidak cocok dengan kata kunci grup manapun akan otomatis diset sebagai Siswa Biasa.'
      )
    ) {
      return
    }

    setSyncing(true)
    const res = await syncAllStudentsWithGroups()
    if (res.error) {
      showToast(`Kendala sinkronisasi: ${res.error}`, 'error')
    } else {
      showToast(
        `Sinkronisasi Selesai! Total ${res.total} siswa diproses (${res.matched} terikat grup, ${res.unmatched} siswa biasa, ${res.updated} profil diperbarui).`,
        'success'
      )
      await loadData()
    }
    setSyncing(false)
  }

  // Calculate statistics
  const totalStudents = students.length
  const groupedStudents = students.filter(s => s.group_name && s.group_name.trim().length > 0)
  const regularStudents = students.filter(s => !s.group_name || s.group_name.trim().length === 0)

  // Simulation result for tester
  const simulatedMatch = testInput.trim() ? matchGroupFromInstitution(testInput, groups) : null

  if (loading) {
    return <LoadingScreen message="Memuat Data Kelola Grup & Kata Kunci..." fullScreen={false} />
  }

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-bold animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : toast.type === 'error'
              ? 'bg-red-500 text-white border-red-400'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="mb-6 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50 bg-cover bg-center text-white"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.92), rgba(88,28,135,0.85)), url('/japan-background(4).jpg')",
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-black uppercase tracking-wider flex items-center gap-1">
              <span>👥</span>
              <span className="font-jp font-bold mr-1">グループ管理</span>
              <span>Kelola Label & Kata Kunci Grup</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Manajemen Grup Siswa</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed font-medium">
            Atur label grup resmi (seperti <span className="font-bold text-amber-300">VLI2608</span>) dan kata kunci pendaftarannya. Calon siswa yang menuliskan instansi di luar grup admin akan otomatis menjadi <span className="font-bold text-sky-300">Siswa Biasa</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2 active:scale-95"
          >
            <span>+ Tambah Grup Baru</span>
          </button>
          <button
            onClick={handleRunSync}
            disabled={syncing}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-extrabold rounded-2xl border border-slate-600 cursor-pointer transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <span>{syncing ? '⏳ Menyinkronkan...' : '🔄 Sinkronisasi Semua Siswa'}</span>
          </button>
          <button
            onClick={() => navigate('/kelola-pelajar')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-extrabold rounded-2xl border border-white/20 cursor-pointer transition-all flex items-center gap-2"
          >
            <span>🧑‍🎓 Kelola Akun Pelajar &rarr;</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl font-black shrink-0">
            🏷️
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-white">{groups.length}</div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Grup Didefinisikan</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl font-black shrink-0">
            👥
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-white">{groupedStudents.length}</div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Siswa Terikat Grup Resmi</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center text-2xl font-black shrink-0">
            🌐
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-white">{regularStudents.length}</div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Siswa Biasa (Tanpa Grup)</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl font-black shrink-0">
            🧑‍🎓
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-white">{totalStudents}</div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Seluruh Siswa</div>
          </div>
        </div>
      </div>

      {/* Live Keyword Match Simulator */}
      <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800/60 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🔍</span>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">
            Live Keyword Tester (Uji Kecocokan Instansi)
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
          Ketik teks instansi atau grup apa saja di bawah ini untuk melihat langsung grup mana yang akan mendeteksi keyword tersebut, atau apakah siswa akan otomatis menjadi <span className="font-bold text-sky-600 dark:text-sky-400">Siswa Biasa</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              placeholder="Ketik teks instansi, cth: VIVA Legacy | STAI DT, STAI Bandung, atau Universitas Indonesia..."
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium shadow-xs"
            />
            {testInput && (
              <button
                type="button"
                onClick={() => setTestInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black p-1 bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="sm:w-72 shrink-0 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Hasil Deteksi:</div>
            {testInput.trim() ? (
              simulatedMatch ? (
                <span className="px-3 py-1 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-extrabold text-xs flex items-center gap-1.5">
                  <span>🏷️ Grup</span>
                  <span className="font-black underline">{simulatedMatch}</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 font-extrabold text-xs flex items-center gap-1.5">
                  <span>🌐 Siswa Biasa</span>
                </span>
              )
            ) : (
              <span className="text-xs text-slate-400 italic">Ketik untuk menguji</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Groups List Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span>🏷️ Daftar Grup & Kata Kunci Resmi</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Setiap user yang mendaftar atau mengedit profil akan dicek terhadap kata kunci di bawah.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black border-none cursor-pointer transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <span>+ Tambah Grup Baru</span>
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">🏷️</div>
            <p className="text-sm font-bold">Belum ada grup yang didefinisikan.</p>
            <p className="text-xs text-slate-500 mt-1">Klik tombol "+ Tambah Grup Baru" untuk membuat grup pertama.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(grp => {
              const kws = parseKeywords(grp.keywords)
              const grpMembers = students.filter(
                s => (s.group_name || '').toLowerCase() === grp.name.toLowerCase()
              )

              return (
                <div
                  key={grp.id}
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-5 flex flex-col justify-between transition-all hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/70 px-2.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800 font-mono">
                            {grp.name}
                          </span>
                        </div>
                        {grp.description ? (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                            {grp.description}
                          </p>
                        ) : (
                          <p className="text-[0.7rem] text-slate-400 italic mt-1">Tidak ada deskripsi</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(grp)}
                          title="Edit Grup & Kata Kunci"
                          className="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-950 dark:hover:text-purple-300 transition-all text-xs font-bold flex items-center justify-center border-none cursor-pointer"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(grp)}
                          title="Hapus Grup"
                          className="size-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-all text-xs font-black flex items-center justify-center border border-red-200 dark:border-red-900/50 cursor-pointer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Keywords tags */}
                    <div className="mb-4">
                      <div className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <span>🔑 Kata Kunci Matching ({kws.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {kws.length > 0 ? (
                          kws.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[0.7rem] font-mono font-medium shadow-2xs"
                            >
                              "{kw}"
                            </span>
                          ))
                        ) : (
                          <span className="text-[0.7rem] text-slate-400 italic">Hanya cocok persis nama grup</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Member count */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <span>👥</span>
                      <span>
                        <strong className="text-slate-900 dark:text-white font-black">{grpMembers.length}</strong> siswa
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedGroupMembers(grp)}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                    >
                      <span>Lihat Anggota &rarr;</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Tambah / Edit Grup */}
      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 animate-scale-up max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>{editingGroup ? '✏️ Edit Grup & Kata Kunci' : '✨ Tambah Grup Baru'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center border-none cursor-pointer font-black"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 shrink-0">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveGroup} className="space-y-4 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nama Label Grup <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: VLI2608 atau STAI2026"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-bold"
                  />
                  <p className="text-[0.7rem] text-slate-400 mt-1">
                    Nama resmi grup yang akan muncul di profil, filter pelajar, dan reservasi jadwal.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kata Kunci Pendaftaran (Pisahkan dengan koma)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: viva legacy, vli2608, vli 2608, viva"
                    value={formKeywords}
                    onChange={e => setFormKeywords(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
                  />
                  <p className="text-[0.7rem] text-slate-400 mt-1">
                    Jika siswa menulis salah satu kata kunci ini pada kolom instansi/grup saat daftar, mereka akan otomatis masuk ke grup ini.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                    Deskripsi / Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Grup Khusus Batch Pelajar VIVA Legacy"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border-none cursor-pointer hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formName.trim()}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold border-none cursor-pointer transition-all disabled:opacity-50 shadow-md flex items-center gap-1.5"
                  >
                    <span>{saving ? 'Menyimpan...' : editingGroup ? 'Simpan Perubahan' : 'Tambah Grup'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal / Drawer: Anggota Grup */}
      {selectedGroupMembers &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 sm:p-6 animate-scale-up max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>👥 Anggota Grup:</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
                      {selectedGroupMembers.name}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Daftar seluruh siswa yang saat ini terhubung dengan grup ini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroupMembers(null)
                    setMemberSearch('')
                  }}
                  className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center border-none cursor-pointer font-black"
                >
                  ✕
                </button>
              </div>

              {/* Member search bar */}
              <div className="mb-3 shrink-0">
                <input
                  type="text"
                  placeholder="Cari nama, username, atau email siswa..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {(() => {
                  const members = students.filter(
                    s => (s.group_name || '').toLowerCase() === selectedGroupMembers.name.toLowerCase()
                  )
                  const filtered = members.filter(
                    s =>
                      s.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      s.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      s.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      (s.institution || '').toLowerCase().includes(memberSearch.toLowerCase())
                  )

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-10 text-slate-400">
                        <div className="text-3xl mb-1">🔍</div>
                        <p className="text-xs font-bold">
                          {members.length === 0 ? 'Belum ada siswa di grup ini.' : 'Tidak ada siswa yang cocok dengan pencarian.'}
                        </p>
                      </div>
                    )
                  }

                  return filtered.map(std => (
                    <div
                      key={std.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 flex items-center justify-center font-black text-xs shrink-0 border border-purple-500/20">
                          {std.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-800 dark:text-white truncate">
                            {std.full_name}
                          </div>
                          <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">
                            @{std.username} • {std.email}
                          </div>
                          {std.institution && (
                            <div className="text-[0.65rem] text-purple-600 dark:text-purple-400 font-mono mt-0.5 truncate">
                              🏛️ "{std.institution}"
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[0.65rem] font-black shrink-0 ${
                          std.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {std.status === 'approved' ? 'Aktif' : std.status}
                      </span>
                    </div>
                  ))
                })()}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroupMembers(null)
                    setMemberSearch('')
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border-none cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </main>
  )
}
