import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
import { fetchGroups, matchGroupFromInstitution, sortGroupsAlphabetically, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { calculateUserPresence } from '../lib/presenceUtils'
import { sendWhatsAppApprovalNotice } from '../lib/whatsappService'
import { supabase } from '../lib/supabaseClient'
import { fetchKotobaCountsByUser } from '../lib/kotobaService'

export default function StudentManager() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [students, setStudents] = useState<StudentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false)

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<StudentAccount | null>(null)

  // Form Fields State
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [institution, setInstitution] = useState('')
  const [domisili, setDomisili] = useState('')
  const [kelurahan, setKelurahan] = useState('')
  const [kecamatan, setKecamatan] = useState('')
  const [kabupaten, setKabupaten] = useState('')
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState<StudentStatus>('approved')
  const [groupName, setGroupName] = useState('') // normalized group

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Available groups from kaiwa_groups table
  const [availableGroups, setAvailableGroups] = useState<KaiwaGroup[]>([])

  // Kotoba submission counts per user_id
  const [kotobaCounts, setKotobaCounts] = useState<Map<string, number>>(new Map())

  async function loadData() {
    setLoading(true)
    const [data, counts] = await Promise.all([
      fetchStudents(),
      fetchKotobaCountsByUser(),
    ])
    setStudents(data)
    setKotobaCounts(counts)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    loadGroups()

    const handleGroupSync = () => {
      loadGroups()
      loadData()
    }
    window.addEventListener(GROUP_UPDATE_EVENT, handleGroupSync)

    // Auto-refresh presence every 5 minutes — only when tab is visible (saves egress)
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStudents().then(data => setStudents(data))
      }
    }, 5 * 60 * 1000)

    return () => {
      window.removeEventListener(GROUP_UPDATE_EVENT, handleGroupSync)
      clearInterval(refreshInterval)
    }
  }, [])

  async function loadGroups() {
    try {
      const data = await fetchGroups(true)
      setAvailableGroups(sortGroupsAlphabetically(data))
    } catch {
      setAvailableGroups([])
    }
  }

  function showToastMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function openAddModal() {
    setFullName('')
    setUsername('')
    setEmail('')
    setInstitution('')
    setDomisili('')
    setKelurahan('')
    setKecamatan('')
    setKabupaten('')
    setBio('')
    setStatus('approved')
    setGroupName('')
    setShowAddModal(true)
  }

  function openEditModal(std: StudentAccount) {
    setEditingStudent(std)
    setFullName(std.full_name)
    setUsername(std.username)
    setEmail(std.email)
    setInstitution(std.institution || '')
    setDomisili(std.domisili || '')
    setKelurahan(std.kelurahan || '')
    setKecamatan(std.kecamatan || '')
    setKabupaten(std.kabupaten || '')
    setBio(std.bio || '')
    setStatus(std.status || 'approved')
    setGroupName(std.group_name || '')
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
      showToastMsg(`Akun "${std.full_name}" Disetujui & Pesan WA Berhasil Terkirim ke WA ${waTarget}!`)
    } else {
      showToastMsg(`Akun "${std.full_name}" Disetujui!`)
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
    showToastMsg(`Akun pelajar "${std.full_name}" telah dinonaktifkan`)
    await loadData()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim()) {
      alert('Mohon isi nama lengkap, username, dan email siswa!')
      return
    }

    setSaving(true)
    const targetGroup = groupName.trim() || null
    const created = await createStudentAccount({
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      institution: institution.trim(),
      domisili: domisili.trim() || undefined,
      kelurahan: kelurahan.trim() || undefined,
      kecamatan: kecamatan.trim() || undefined,
      kabupaten: kabupaten.trim() || undefined,
      group_name: targetGroup,
      bio: bio.trim(),
      status,
    })

    setSaving(false)
    setShowAddModal(false)
    if (created) {
      showToastMsg(`Berhasil menambahkan akun Pelajar baru: ${created.full_name}!`)
    } else {
      showToastMsg(`Gagal menambahkan akun Pelajar. Periksa koneksi atau database!`)
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
    const targetGroup = groupName.trim() || null

    // 1. Update React state secara instan
    setStudents(prev =>
      prev.map(s =>
        s.id === editingStudent.id || s.username.toLowerCase() === editingStudent.username.toLowerCase()
          ? {
              ...s,
              full_name: fullName.trim(),
              username: username.trim().toLowerCase(),
              email: email.trim().toLowerCase(),
              institution: institution.trim(),
              domisili: domisili.trim() || undefined,
              kelurahan: kelurahan.trim() || undefined,
              kecamatan: kecamatan.trim() || undefined,
              kabupaten: kabupaten.trim() || undefined,
              group_name: targetGroup || undefined,
              bio: bio.trim(),
              status,
            }
          : s
      )
    )

    // 2. Simpan ke database Supabase
    await updateStudentAccount(editingStudent.id, {
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      institution: institution.trim(),
      domisili: domisili.trim() || null,
      kelurahan: kelurahan.trim() || null,
      kecamatan: kecamatan.trim() || null,
      kabupaten: kabupaten.trim() || null,
      group_name: targetGroup,
      bio: bio.trim(),
      status,
    })

    // 3. Update direct profiles override
    await supabase
      .from('profiles')
      .update({ group_name: targetGroup })
      .eq('id', editingStudent.id)

    setSaving(false)
    setEditingStudent(null)
    showToastMsg(`Berhasil memperbarui akun: ${fullName.trim()}!`)
    await loadData()
  }

  async function handleDelete(std: StudentAccount) {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun pelajar "${std.full_name}" (@${std.username}) secara permanen?`)) return

    setSaving(true)

    // 1. Hapus dari React state secara instan
    setStudents(prev => prev.filter(s => s.id !== std.id && s.username.toLowerCase() !== std.username.toLowerCase()))

    // 2. Hapus dari database Supabase (menghapus profiles dan auth.users secara tuntas)
    const success = await deleteStudentAccount(std.id, std.email)

    setSaving(false)
    if (success) {
      showToastMsg(`Akun pelajar "${std.full_name}" (@${std.username}) berhasil dihapus.`)
    } else {
      showToastMsg(`Gagal menghapus akun pelajar "${std.full_name}".`)
    }
    await loadData()
  }

  // Security check: Only admin can access
  if (profile?.role !== 'admin') {
    return (
      <main className="flex-1 p-6 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Akses Terbatas Khusus Admin</h2>
        <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
          Halaman ini khusus diperuntukkan untuk Admin untuk mengelola akun Pelajar/Siswa.
        </p>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl border-none cursor-pointer">
          Kembali ke Dashboard
        </button>
      </main>
    )
  }

  const pendingCount = students.filter(s => s.status === 'pending').length
  const approvedCount = students.filter(s => s.status === 'approved').length
  const onlineCount = students.filter(s => calculateUserPresence(s.last_active_at).isOnline).length

  const filteredStudents = useMemo(() => {
    return students
      .filter(std => {
        if (statusFilter === 'pending' && std.status !== 'pending') return false
        if (statusFilter === 'approved' && std.status !== 'approved') return false

        if (groupFilter !== 'all') {
          if (groupFilter === 'no_group') {
            if (std.group_name) return false
          } else if (std.group_name !== groupFilter) {
            return false
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const digitsOnlyQ = q.replace(/\D/g, '')
          const matchesName = (std.full_name || '').toLowerCase().includes(q)
          const matchesUsername = (std.username || '').toLowerCase().includes(q)
          const matchesEmail = (std.email || '').toLowerCase().includes(q)
          const matchesPhone =
            (std.phone_number || '').toLowerCase().includes(q) ||
            (digitsOnlyQ.length >= 3 && (std.phone_number || '').replace(/\D/g, '').includes(digitsOnlyQ))
          const matchesInstitution = (std.institution || '').toLowerCase().includes(q)
          const matchesGroup = (std.group_name || '').toLowerCase().includes(q)

          return matchesName || matchesUsername || matchesEmail || matchesPhone || matchesInstitution || matchesGroup
        }

        return true
      })
      .sort((a, b) => {
        // Prioritas 1: Online vs Offline (Online didahulukan)
        const isOnlineA = calculateUserPresence(a.last_active_at).isOnline
        const isOnlineB = calculateUserPresence(b.last_active_at).isOnline
        if (isOnlineA !== isOnlineB) {
          return isOnlineA ? -1 : 1
        }

        // Prioritas 2: Status Verifikasi (Menunggu persetujuan -> Terverifikasi -> Ditolak)
        const getVerificationRank = (status?: string): number => {
          if (status === 'pending') return 1
          if (status === 'approved') return 2
          if (status === 'rejected') return 3
          return 4
        }
        const rankA = getVerificationRank(a.status)
        const rankB = getVerificationRank(b.status)
        if (rankA !== rankB) {
          return rankA - rankB
        }

        // Prioritas 3: Nama Grup (A-Z)
        const groupA = (a.group_name || '').trim()
        const groupB = (b.group_name || '').trim()
        const groupComp = groupA.localeCompare(groupB, undefined, { sensitivity: 'base', numeric: true })
        if (groupComp !== 0) {
          return groupComp
        }

        // Prioritas 4: Nama Siswa (A-Z)
        const nameA = (a.full_name || a.username || '').trim()
        const nameB = (b.full_name || b.username || '').trim()
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true })
      })
  }, [students, statusFilter, groupFilter, searchQuery])

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-[600] bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-extrabold animate-bounce flex items-center gap-2">
          <svg className="size-4 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-7 rounded-3xl shadow-xl border border-slate-700/50">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-primary/20 text-red-300 border border-primary/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Menu Admin</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{onlineCount} Sedang Online</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-black">
              {approvedCount} Pelajar Terverifikasi
            </span>
            {pendingCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black animate-pulse flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-400" />
                <span>{pendingCount} Menunggu Persetujuan</span>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Kelola & Verifikasi Akun Pelajar</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Halaman khusus Admin untuk melihat status aktivitas (online/offline), **menyetujui (approve), menolak, menambah, dan mengedit** data akun Pelajar kaiwadojo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/kelola-grup')}
            className="px-4 py-3 bg-purple-600/90 hover:bg-purple-600 text-white text-xs sm:text-sm font-extrabold rounded-2xl border border-purple-400/40 cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Kelola Grup & Kata Kunci</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-5 py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md shrink-0 flex items-center justify-center gap-2"
          >
            <span>+ Tambah Akun Pelajar Baru</span>
          </button>
        </div>
      </div>

      {/* Students List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <span>Daftar Akun Siswa / Pelajar</span>
              </h3>
              {searchQuery.trim() || groupFilter !== 'all' || statusFilter !== 'all' ? (
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  Menampilkan {filteredStudents.length} dari {students.length} pelajar
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-400">
                  Total: {students.length} pelajar
                </span>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                Semua ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-amber-500'
                }`}
              >
                <span className="size-1.5 rounded-full bg-amber-400" />
                <span>Menunggu ({pendingCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-emerald-600'
                }`}
              >
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span>Terverifikasi ({approvedCount})</span>
              </button>
            </div>
          </div>

          {/* Search & Group Filter Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, @username, email, nomor WA, asal lembaga, grup..."
                className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center border-none cursor-pointer transition-colors"
                  title="Hapus pencarian"
                >
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter by Group Dropdown */}
            {availableGroups.length > 0 && (
              <div className="shrink-0 sm:w-56">
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="all">Semua Grup</option>
                  <option value="no_group">Tanpa Grup (Siswa Biasa)</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(searchQuery.trim() || groupFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setGroupFilter('all')
                }}
                className="px-3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold border-none cursor-pointer transition-colors shrink-0 flex items-center justify-center gap-1.5"
                title="Reset filter & pencarian"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {searchQuery.trim() || groupFilter !== 'all' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-1">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  Tidak ada akun pelajar yang cocok
                </p>
                <p className="text-xs text-slate-400 max-w-md">
                  {searchQuery.trim() && (
                    <>
                      Kata kunci: <span className="font-semibold text-primary">"{searchQuery}"</span>
                    </>
                  )}
                  {searchQuery.trim() && groupFilter !== 'all' && ' • '}
                  {groupFilter !== 'all' && (
                    <>
                      Filter grup: <span className="font-semibold text-purple-500">{groupFilter === 'no_group' ? 'Tanpa Grup' : groupFilter}</span>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setGroupFilter('all')
                    setStatusFilter('all')
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold border-none cursor-pointer hover:bg-primary-dark transition-colors shadow-xs"
                >
                  Reset Pencarian & Filter
                </button>
              </div>
            ) : statusFilter === 'pending' ? (
              <span className="italic">Tidak ada akun pelajar yang sedang menunggu verifikasi.</span>
            ) : (
              <span className="italic">Belum ada akun pelajar yang terdaftar dalam kategori ini.</span>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[0.7rem] font-black uppercase text-slate-400 tracking-wider">
                  <th className="pb-3 px-2">Nama Siswa</th>
                  <th className="pb-3 px-2">Status Online</th>
                  <th className="pb-3 px-2">Username & Email</th>
                  <th className="pb-3 px-2">No. WhatsApp</th>
                  <th className="pb-3 px-2">Asal Lembaga / PT</th>
                  <th className="pb-3 px-2">Grup</th>
                  <th className="pb-3 px-2">Setoran Kotoba</th>
                  <th className="pb-3 px-2">Status Verifikasi</th>
                  <th className="pb-3 px-2 text-right">Aksi Verifikasi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold">
                {filteredStudents.map(std => {
                  const presence = calculateUserPresence(std.last_active_at)
                  return (
                    <tr key={std.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img
                              src={std.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${std.username}`}
                              alt={std.full_name}
                              className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 object-cover"
                            />
                            <span
                              title={presence.isOnline ? 'Online (Sedang Aktif)' : presence.relativeTime}
                              className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                presence.isOnline ? 'bg-emerald-500 shadow-sm animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-800 dark:text-white">{std.full_name}</div>
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[0.65rem] font-black uppercase">
                              Pelajar
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status Online Column */}
                      <td className="py-3 px-2">
                        {presence.isOnline ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[0.68rem] font-black border border-emerald-300 dark:border-emerald-800 w-fit shadow-2xs">
                              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Online</span>
                            </span>
                            <span className="text-[0.62rem] text-emerald-600 dark:text-emerald-400 font-bold">Sedang aktif</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[0.65rem] font-bold border border-slate-200 dark:border-slate-700 w-fit">
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              <span>Offline</span>
                            </span>
                            <span className="text-[0.62rem] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                              {presence.relativeTime}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        <div className="font-bold text-slate-700 dark:text-slate-200">@{std.username}</div>
                        <div className="text-[0.68rem] text-slate-400">{std.email}</div>
                      </td>
                      <td className="py-3 px-2">
                        {std.phone_number ? (
                          <a
                            href={`https://wa.me/${std.phone_number.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[0.68rem] font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                          >
                            <svg className="size-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{std.phone_number}</span>
                          </a>
                        ) : (
                          <span className="text-[0.65rem] text-slate-400 italic">— Tidak ada</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{std.institution || '-'}</div>
                        {(std.kabupaten || std.kecamatan || std.domisili) && (
                          <div className="text-[0.65rem] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate max-w-[170px]" title={[std.domisili, std.kelurahan, std.kecamatan, std.kabupaten].filter(Boolean).join(', ')}>
                            <svg className="size-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{[std.kelurahan, std.kecamatan, std.kabupaten || std.domisili].filter(Boolean).join(', ') || std.domisili}</span>
                          </div>
                        )}
                      </td>
                      {/* Grup Column */}
                      <td className="py-3 px-2">
                        {std.group_name ? (
                          <span className="px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 text-[0.65rem] font-black border border-purple-200 dark:border-purple-800 whitespace-nowrap font-mono">
                            {std.group_name}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[0.65rem] font-semibold">
                            Siswa Biasa
                          </span>
                        )}
                      </td>

                      {/* Setoran Kotoba Column */}
                      <td className="py-3 px-2">
                        {(() => {
                          const count = kotobaCounts.get(std.id) || 0
                          return count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 text-[0.68rem] font-black border border-violet-200 dark:border-violet-800 whitespace-nowrap">
                              <svg className="size-3 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>{count} kata</span>
                            </span>
                          ) : (
                            <span className="text-[0.65rem] text-slate-400 dark:text-slate-600 italic">— Belum ada</span>
                          )
                        })()}
                      </td>

                      {/* Status Verifikasi Column */}
                      <td className="py-3 px-2">
                        {std.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[0.65rem] font-black uppercase">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>Terverifikasi</span>
                          </span>
                        ) : std.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[0.65rem] font-black uppercase animate-pulse">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            <span>Menunggu</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[0.65rem] font-black uppercase">
                            <span className="size-1.5 rounded-full bg-red-500" />
                            <span>Ditolak</span>
                          </span>
                        )}
                      </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {std.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApprove(std)}
                              disabled={saving}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black border-none cursor-pointer transition-all shadow-xs flex items-center gap-1"
                            >
                              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Setujui</span>
                            </button>
                            <button
                              onClick={() => handleReject(std)}
                              disabled={saving}
                              className="px-2.5 py-1.5 rounded-xl bg-red-100 dark:bg-red-950 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs font-bold border-none cursor-pointer transition-colors flex items-center gap-1"
                            >
                              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span>Tolak</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEditModal(std)}
                              disabled={saving}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold border-none cursor-pointer transition-colors flex items-center gap-1"
                            >
                              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(std)}
                              disabled={saving}
                              className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-900/40 cursor-pointer transition-colors flex items-center gap-1"
                            >
                              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Hapus</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal Portal */}
      {showAddModal &&
        createPortal(
          <div className="modal-overlay fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl sm:max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-primary/20 text-red-400 flex items-center justify-center text-sm font-black border border-primary/30">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Tambah Akun Pelajar Baru</h3>
                    <p className="text-[0.68rem] text-slate-300">Pendaftaran akun pelajar & penetapan grup resmi</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer text-base flex items-center justify-center transition-all"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Kolom Kiri: Informasi Pribadi & Login */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Nama Lengkap Siswa <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="contoh: Budi Santoso"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Username <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="budisantoso"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="budi@kaiwadojo.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Status Akun
                      </label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as StudentStatus)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                      >
                        <option value="approved">Aktif (Terverifikasi)</option>
                        <option value="pending">Menunggu Persetujuan</option>
                        <option value="rejected">Nonaktif / Ditolak</option>
                      </select>
                    </div>
                  </div>

                  {/* Kolom Kanan: Lembaga, Grup, & Bio */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Asal Lembaga / Instansi
                        </label>
                        {institution.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              const detected = matchGroupFromInstitution(institution, availableGroups)
                              setGroupName(detected)
                            }}
                            className="text-[0.65rem] text-purple-600 dark:text-purple-400 hover:underline font-bold bg-transparent border-none cursor-pointer flex items-center gap-1"
                          >
                            <svg className="size-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Cocokkan Grup</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="contoh: VIVA Legacy | STAI DT"
                        value={institution}
                        onChange={e => {
                          const newInst = e.target.value
                          setInstitution(newInst)
                          if (!groupName) {
                            const autoGrp = matchGroupFromInstitution(newInst, availableGroups)
                            setGroupName(autoGrp)
                          }
                        }}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="p-3 bg-purple-50/70 dark:bg-purple-950/20 rounded-2xl border border-purple-200/80 dark:border-purple-800/60">
                      <label className="text-xs font-black text-purple-700 dark:text-purple-300 block mb-1">
                        Label Grup Siswa
                      </label>
                      <select
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-700 text-xs font-extrabold bg-white dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      >
                        <option value="">— Siswa Biasa (Tanpa Grup Khusus)</option>
                        {availableGroups.map(g => (
                          <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                      </select>
                      <p className="text-[0.65rem] text-slate-500 dark:text-slate-400 mt-1">
                        {groupName ? `User terikat grup "${groupName}" dan dapat melihat jadwal grup.` : 'User hanya dapat melihat kelas umum/publik.'}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Bio / Catatan Siswa
                      </label>
                      <input
                        type="text"
                        placeholder="Persiapan magang kerja di Tokyo"
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                      />
                    </div>

                    {/* Alamat Domisili */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Alamat Domisili
                      </label>
                      <input
                        type="text"
                        placeholder="Jl. / RT / RW / No. Rumah"
                        value={domisili}
                        onChange={e => setDomisili(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                      />
                    </div>

                    {/* Grid: Kelurahan, Kecamatan, Kabupaten */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[0.68rem] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Kelurahan
                        </label>
                        <input
                          type="text"
                          placeholder="Kelurahan"
                          value={kelurahan}
                          onChange={e => setKelurahan(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[0.68rem] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Kecamatan
                        </label>
                        <input
                          type="text"
                          placeholder="Kecamatan"
                          value={kecamatan}
                          onChange={e => setKecamatan(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[0.68rem] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Kabupaten/Kota
                        </label>
                        <input
                          type="text"
                          placeholder="Kabupaten"
                          value={kabupaten}
                          onChange={e => setKabupaten(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl border-none cursor-pointer text-xs transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-extrabold rounded-xl border-none cursor-pointer text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>{saving ? 'Menyimpan...' : 'Simpan Akun Pelajar'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Student Modal Portal */}
      {editingStudent &&
        createPortal(
          <div className="modal-overlay fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl sm:max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center text-sm font-black border border-purple-400/30">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Edit Data Akun Pelajar</h3>
                    <p className="text-[0.68rem] text-slate-300">Ubah data profil, status akun, dan penetapan label grup</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer text-base flex items-center justify-center transition-all"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdate} className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Kolom Kiri: Informasi Pribadi & Login */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Nama Lengkap Siswa <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Username <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Status Akun Pelajar
                      </label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as StudentStatus)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      >
                        <option value="approved">Aktif (Terverifikasi)</option>
                        <option value="pending">Menunggu Persetujuan</option>
                        <option value="rejected">Nonaktif / Ditolak</option>
                      </select>
                    </div>

                    {/* Alamat Domisili */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Alamat Domisili
                      </label>
                      <input
                        type="text"
                        placeholder="Jl. / RT / RW / No. Rumah"
                        value={domisili}
                        onChange={e => setDomisili(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Grid: Kelurahan, Kecamatan, Kabupaten */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[0.68rem] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Kelurahan
                        </label>
                        <input
                          type="text"
                          placeholder="Kelurahan"
                          value={kelurahan}
                          onChange={e => setKelurahan(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-[0.68rem] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Kecamatan
                        </label>
                        <input
                          type="text"
                          placeholder="Kecamatan"
                          value={kecamatan}
                          onChange={e => setKecamatan(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-[0.68rem] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                          Kabupaten/Kota
                        </label>
                        <input
                          type="text"
                          placeholder="Kabupaten"
                          value={kabupaten}
                          onChange={e => setKabupaten(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan: Lembaga, Grup, & Bio */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Asal Lembaga / Instansi
                        </label>
                        {institution.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              const detected = matchGroupFromInstitution(institution, availableGroups)
                              setGroupName(detected)
                            }}
                            className="text-[0.65rem] text-purple-600 dark:text-purple-400 hover:underline font-bold bg-transparent border-none cursor-pointer flex items-center gap-1"
                          >
                            <svg className="size-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Cocokkan Grup</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="contoh: VIVA Legacy | STAI DT"
                        value={institution}
                        onChange={e => setInstitution(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Group Dropdown - Admin Override */}
                    <div className="p-3 bg-purple-50/70 dark:bg-purple-950/20 rounded-2xl border border-purple-200/80 dark:border-purple-800/60">
                      <label className="text-xs font-black text-purple-700 dark:text-purple-300 block mb-1">
                        Label Grup Siswa <span className="font-bold text-slate-400 normal-case">(Pilih/Ubah)</span>
                      </label>
                      <select
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-700 text-xs font-extrabold bg-white dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      >
                        <option value="">— Siswa Biasa (Tanpa Grup Khusus)</option>
                        {availableGroups.map(g => (
                          <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                      </select>
                      <p className="text-[0.65rem] text-slate-500 dark:text-slate-400 mt-1">
                        {groupName ? `User terikat ke grup "${groupName}".` : 'User adalah Siswa Biasa (hanya akses kelas umum).'}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                        Bio / Catatan Siswa
                      </label>
                      <input
                        type="text"
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl border-none cursor-pointer text-xs transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl border-none cursor-pointer text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </main>
  )
}
