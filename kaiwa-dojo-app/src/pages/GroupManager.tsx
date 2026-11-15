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
  sortGroupsAlphabetically,
  type KaiwaGroup,
} from '../lib/groupService'
import { fetchStudents, type StudentAccount } from '../lib/studentService'
import LoadingScreen from '../components/LoadingScreen'
import { AdminPage, PageHeader, StatGrid, Panel, EmptyState, Badge, BTN_PRIMARY, BTN_SECONDARY } from '../components/admin/AdminUI'
import { useConfirm } from '../contexts/ConfirmContext'

export default function GroupManagerPage() {
  const confirm = useConfirm()
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
    setGroups(sortGroupsAlphabetically(groupsData))
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
        sortGroupsAlphabetically(
          prev.map(g =>
            g.id === editingGroup.id || g.name.toLowerCase() === editingGroup.name.toLowerCase()
              ? { ...g, name, keywords: formKeywords, description: formDescription }
              : g
          )
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
    const ok = await confirm({
      title: `Hapus grup "${grp.name}"?`,
      message: studentCount > 0
        ? `Grup ini memiliki ${studentCount} siswa. Jika dihapus, mereka otomatis menjadi Siswa Biasa (tanpa grup) dan jadwal khusus grup ini terbuka untuk umum.`
        : 'Grup ini belum memiliki siswa.',
      confirmLabel: 'Ya, hapus',
      icon: 'trash',
    })
    if (!ok) return

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
    const ok = await confirm({
      title: 'Sinkronisasi semua siswa?',
      message: 'Sistem akan mencocokkan ulang instansi setiap siswa dengan kata kunci grup yang aktif. Siswa yang tidak cocok dengan grup mana pun otomatis menjadi Siswa Biasa.',
      confirmLabel: 'Ya, sinkronkan',
      tone: 'primary',
      icon: 'warning',
    })
    if (!ok) return

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
    <AdminPage>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toast.type === 'error'
              ? 'bg-red-600 text-white border-red-500'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : toast.type === 'error' ? (
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      <PageHeader
        eyebrow="Admin · Pengguna"
        title="Grup & Label"
        description={<>Atur label grup resmi beserta kata kunci instansinya. Pendaftar dengan instansi yang tidak cocok otomatis menjadi <strong className="font-semibold text-slate-700 dark:text-slate-200">Siswa Biasa</strong>.</>}
        actions={
          <>
            <button type="button" onClick={() => navigate('/kelola-pelajar')} className={BTN_SECONDARY}>Kelola pelajar</button>
            <button type="button" onClick={handleRunSync} disabled={syncing} className={BTN_SECONDARY}>
              <svg className={`size-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {syncing ? 'Menyinkronkan…' : 'Sinkronkan siswa'}
            </button>
            <button type="button" onClick={openAddModal} className={BTN_PRIMARY}>
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Tambah grup
            </button>
          </>
        }
      />

      <StatGrid
        label="Ringkasan grup"
        items={[
          { label: 'Total grup', value: groups.length, tone: 'primary' },
          { label: 'Siswa dalam grup', value: groupedStudents.length, tone: 'success' },
          { label: 'Siswa biasa', value: regularStudents.length, tone: 'info', hint: 'Tanpa grup resmi' },
          { label: 'Total siswa', value: totalStudents },
        ]}
      />

      {/* Uji kata kunci */}
      <Panel
        title="Uji kecocokan instansi"
        description="Ketik nama instansi untuk melihat grup mana yang akan terdeteksi saat pendaftaran."
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <label htmlFor="keyword-tester" className="sr-only">Teks instansi</label>
            <input
              id="keyword-tester"
              type="text"
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              placeholder="cth: VIVA Legacy | STAI DT, Universitas Indonesia…"
              className="w-full h-11 px-4 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {testInput && (
              <button
                type="button"
                onClick={() => setTestInput('')}
                aria-label="Kosongkan uji"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 size-5 flex items-center justify-center bg-transparent border-none cursor-pointer"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <output
            htmlFor="keyword-tester"
            aria-live="polite"
            className="sm:w-72 shrink-0 h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
          >
            <span className="text-sm text-slate-500 dark:text-slate-400">Hasil</span>
            {testInput.trim() ? (
              simulatedMatch ? (
                <Badge tone="primary">Grup: <span className="font-mono">{simulatedMatch}</span></Badge>
              ) : (
                <Badge tone="info">Siswa Biasa</Badge>
              )
            ) : (
              <span className="text-xs text-slate-400">Ketik untuk menguji</span>
            )}
          </output>
        </div>
      </Panel>

      {/* Daftar grup */}
      <Panel
        title="Daftar grup & kata kunci"
        description="Setiap pendaftaran dan perubahan profil dicek terhadap kata kunci di bawah."
      >
        {groups.length === 0 ? (
          <EmptyState
            title="Belum ada grup"
            description="Buat grup pertama beserta kata kunci instansinya."
            action={<button type="button" onClick={openAddModal} className={BTN_PRIMARY}>Tambah grup</button>}
          />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 list-none m-0 p-0">
            {groups.map(grp => {
              const kws = parseKeywords(grp.keywords)
              const grpMembers = students.filter(
                s => (s.group_name || '').toLowerCase() === grp.name.toLowerCase()
              )

              return (
                <li key={grp.id}>
                  <article className="h-full rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-4 flex flex-col gap-3 transition-colors hover:border-primary/40">
                    <header className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold font-mono text-slate-900 dark:text-white break-all">{grp.name}</h3>
                        <p className={`text-sm mt-0.5 line-clamp-2 ${grp.description ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                          {grp.description || 'Tidak ada deskripsi'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(grp)}
                          aria-label={`Edit grup ${grp.name}`}
                          className="size-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(grp)}
                          aria-label={`Hapus grup ${grp.name}`}
                          className="size-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </header>

                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Kata kunci ({kws.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {kws.length > 0 ? (
                          kws.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                            >
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">Hanya cocok persis dengan nama grup</span>
                        )}
                      </div>
                    </div>

                    <footer className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-white font-bold tabular-nums">{grpMembers.length}</strong> siswa
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupMembers(grp)}
                        className="text-sm font-semibold text-primary dark:text-primary-lighter hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Lihat anggota →
                      </button>
                    </footer>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {/* Modal: Tambah / Edit Grup */}
      {modalOpen &&
        createPortal(
          <div className="modal-overlay fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 animate-scale-up max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>{editingGroup ? 'Edit Grup & Kata Kunci' : 'Tambah Grup Baru'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center border-none cursor-pointer"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 shrink-0">
                  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
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
          <div className="modal-overlay fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 sm:p-6 animate-scale-up max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>Anggota Grup:</span>
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
                  className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center border-none cursor-pointer"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                        <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
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
                            <div className="text-[0.65rem] text-purple-600 dark:text-purple-400 font-mono mt-0.5 truncate flex items-center gap-1">
                              <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              <span>"{std.institution}"</span>
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
    </AdminPage>
  )
}
