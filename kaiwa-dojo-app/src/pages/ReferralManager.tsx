import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchStudents, SUBSCRIPTION_PLANS, type StudentAccount } from '../lib/studentService'
import LoadingScreen from '../components/LoadingScreen'

/* ── Halaman Admin: Peserta per Kode Referral ──────
   Mengelompokkan akun pelajar berdasarkan `profiles.referral_code`
   yang mereka isi saat mendaftar.
   ─────────────────────────────────────────────── */

const NO_CODE_KEY = '__NO_CODE__'

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected'
type SortMode = 'count' | 'code' | 'latest'

interface ReferralGroup {
  code: string // NO_CODE_KEY untuk peserta tanpa kode
  members: StudentAccount[]
  latestJoin: number
}

function normalizeCode(code?: string | null): string {
  return (code || '').trim().toUpperCase()
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function formatDate(value?: string | null): string {
  const d = parseDate(value)
  return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

function paymentInfo(std: StudentAccount): { label: string; cls: string } {
  const endsAt = parseDate(std.subscription_ends_at)
  const isExpired = endsAt ? endsAt.getTime() < Date.now() : false
  if (std.payment_status === 'expired' || (std.payment_status === 'paid' && isExpired)) {
    return { label: 'Kedaluwarsa', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
  }
  if (std.payment_status === 'paid') {
    return { label: 'Lunas', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' }
  }
  if (std.payment_status === 'pending') {
    return { label: 'Menunggu', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' }
  }
  return { label: 'Belum bayar', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' }
}

function statusInfo(status: StudentAccount['status']): { label: string; cls: string } {
  if (status === 'approved') return { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' }
  if (status === 'pending') return { label: 'Menunggu', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' }
  return { label: 'Ditolak', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' }
}

function planName(code?: string): string {
  if (!code) return '-'
  return SUBSCRIPTION_PLANS.find(p => p.code === code || p.id === code)?.name || code
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(groups: ReferralGroup[]) {
  const header = ['Kode Referral', 'Nama', 'Username', 'Email', 'No. HP', 'Instansi', 'Grup', 'Paket', 'Pembayaran', 'Status Akun', 'Tanggal Daftar']
  const rows = groups.flatMap(g =>
    g.members.map(m => [
      g.code === NO_CODE_KEY ? '' : g.code,
      m.full_name,
      m.username,
      m.email,
      m.phone_number || '',
      m.institution || '',
      m.group_name || '',
      planName(m.plan_code),
      paymentInfo(m).label,
      statusInfo(m.status).label,
      formatDate(m.created_at),
    ])
  )
  const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `peserta-per-referral-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function ReferralManagerPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [students, setStudents] = useState<StudentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('count')
  const [showNoCode, setShowNoCode] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function loadData() {
    setLoading(true)
    setStudents(await fetchStudents())
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.role === 'admin') loadData()
    else setLoading(false)
  }, [profile?.role])

  // Kelompokkan semua pelajar berdasarkan kode referral
  const allGroups = useMemo<ReferralGroup[]>(() => {
    const map = new Map<string, StudentAccount[]>()
    for (const s of students) {
      const key = normalizeCode(s.referral_code) || NO_CODE_KEY
      const list = map.get(key)
      if (list) list.push(s)
      else map.set(key, [s])
    }
    return Array.from(map.entries()).map(([code, members]) => ({
      code,
      members: [...members].sort((a, b) => (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0)),
      latestJoin: Math.max(...members.map(m => parseDate(m.created_at)?.getTime() || 0)),
    }))
  }, [students])

  // Terapkan filter status, pencarian, dan urutan
  const visibleGroups = useMemo<ReferralGroup[]>(() => {
    const q = search.trim().toLowerCase()
    const result: ReferralGroup[] = []
    for (const g of allGroups) {
      if (g.code === NO_CODE_KEY && !showNoCode) continue
      const codeMatches = q !== '' && g.code !== NO_CODE_KEY && g.code.toLowerCase().includes(q)
      const members = g.members.filter(m => {
        if (statusFilter !== 'all' && m.status !== statusFilter) return false
        if (!q || codeMatches) return true
        return [m.full_name, m.username, m.email, m.phone_number, m.institution]
          .some(v => (v || '').toLowerCase().includes(q))
      })
      if (members.length > 0) result.push({ ...g, members })
    }
    result.sort((a, b) => {
      // Kelompok "tanpa kode" selalu di paling bawah
      if (a.code === NO_CODE_KEY) return 1
      if (b.code === NO_CODE_KEY) return -1
      if (sortMode === 'code') return a.code.localeCompare(b.code)
      if (sortMode === 'latest') return b.latestJoin - a.latestJoin
      return b.members.length - a.members.length || a.code.localeCompare(b.code)
    })
    return result
  }, [allGroups, search, statusFilter, sortMode, showNoCode])

  const totalCodes = allGroups.filter(g => g.code !== NO_CODE_KEY).length
  const withCode = students.filter(s => normalizeCode(s.referral_code) !== '').length
  const withoutCode = students.length - withCode
  const topGroup = allGroups
    .filter(g => g.code !== NO_CODE_KEY)
    .reduce<ReferralGroup | null>((best, g) => (!best || g.members.length > best.members.length ? g : best), null)
  const visibleMemberCount = visibleGroups.reduce((n, g) => n + g.members.length, 0)
  const searching = search.trim() !== ''

  function toggle(code: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const allExpanded = visibleGroups.length > 0 && visibleGroups.every(g => expanded.has(g.code))
  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(visibleGroups.map(g => g.code)))
  }

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
          Halaman ini khusus diperuntukkan untuk Admin untuk melihat peserta berdasarkan kode referral.
        </p>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl border-none cursor-pointer">
          Kembali ke Dashboard
        </button>
      </main>
    )
  }

  if (loading) {
    return <LoadingScreen message="Memuat data peserta per referral..." fullScreen={false} />
  }

  const statCard = (value: React.ReactNode, label: string, tone: string, icon: string) => (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 min-w-0">
      <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${tone}`}>
        <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-black text-slate-800 dark:text-white truncate">{value}</div>
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
      </div>
    </div>
  )

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* Header */}
      <div
        className="mb-6 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50 bg-cover bg-center text-white"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.92), rgba(14,116,144,0.85)), url('/japan-background(3).jpg')",
        }}
      >
        <div>
          <span className="inline-flex px-3 py-1 mb-1.5 rounded-full bg-cyan-500/20 text-cyan-100 border border-cyan-400/30 text-xs font-black uppercase tracking-wider items-center gap-1.5">
            <span className="font-jp font-bold mr-1">紹介コード</span>
            <span>Kode Referral</span>
          </span>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">Peserta per Kode Referral</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed font-medium">
            Daftar pelajar dikelompokkan berdasarkan kode referral yang mereka gunakan saat mendaftar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => downloadCsv(visibleGroups)}
            disabled={visibleMemberCount === 0}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-extrabold rounded-2xl border border-slate-600 cursor-pointer transition-all shadow-md flex items-center gap-2 active:scale-95"
          >
            <svg className="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Muat Ulang</span>
          </button>
          <button
            onClick={() => navigate('/kelola-pelajar')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-extrabold rounded-2xl border border-white/20 cursor-pointer transition-all"
          >
            Kelola Akun Pelajar &rarr;
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCard(totalCodes, 'Kode Referral Digunakan', 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
          'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z')}
        {statCard(withCode, 'Peserta dengan Referral', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z')}
        {statCard(withoutCode, 'Peserta Tanpa Referral', 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
          'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636')}
        {statCard(
          topGroup ? <span className="font-mono">{topGroup.code}</span> : '-',
          topGroup ? `Terbanyak · ${topGroup.members.length} peserta` : 'Kode Terbanyak',
          'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'
        )}
      </div>

      {/* Filter */}
      <div className="mb-4 bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari kode referral, nama, username, email, atau no. HP..."
            className="w-full h-11 pl-10 pr-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter status akun"
            className="h-11 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">Semua status</option>
            <option value="approved">Disetujui</option>
            <option value="pending">Menunggu</option>
            <option value="rejected">Ditolak</option>
          </select>
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            aria-label="Urutkan kode referral"
            className="h-11 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="count">Peserta terbanyak</option>
            <option value="latest">Pendaftar terbaru</option>
            <option value="code">Kode (A–Z)</option>
          </select>
          <label className="h-11 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={showNoCode} onChange={e => setShowNoCode(e.target.checked)} className="size-4 accent-cyan-600" />
            Tampilkan tanpa kode
          </label>
          <button
            onClick={toggleAll}
            disabled={visibleGroups.length === 0}
            className="h-11 px-3 rounded-2xl bg-transparent border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            {allExpanded ? 'Tutup semua' : 'Buka semua'}
          </button>
        </div>
      </div>

      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 px-1">
        Menampilkan {visibleGroups.length} kelompok · {visibleMemberCount} peserta
      </p>

      {/* Daftar kode referral */}
      {visibleGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-dashed border-slate-300 dark:border-slate-700 text-center">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Tidak ada peserta yang cocok</p>
          <p className="text-xs text-slate-500 mt-1">
            {students.length === 0 ? 'Belum ada akun pelajar terdaftar.' : 'Coba ubah kata kunci pencarian atau filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleGroups.map(g => {
            const isNoCode = g.code === NO_CODE_KEY
            const isOpen = expanded.has(g.code) || searching
            const approved = g.members.filter(m => m.status === 'approved').length
            const pending = g.members.filter(m => m.status === 'pending').length
            const paid = g.members.filter(m => paymentInfo(m).label === 'Lunas').length
            return (
              <section key={g.code} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(g.code)}
                  aria-expanded={isOpen}
                  className="w-full flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 bg-transparent border-none cursor-pointer text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <svg className={`size-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className={`px-3 py-1 rounded-xl text-sm font-black tracking-wide ${isNoCode ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 italic' : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300 font-mono'}`}>
                    {isNoCode ? 'Tanpa kode referral' : g.code}
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{g.members.length} peserta</span>
                  <span className="flex flex-wrap gap-1.5 ml-auto text-[11px] font-bold">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{approved} disetujui</span>
                    {pending > 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{pending} menunggu</span>}
                    <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{paid} lunas</span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40">
                          <th className="px-4 py-2.5 font-bold w-10">#</th>
                          <th className="px-4 py-2.5 font-bold">Peserta</th>
                          <th className="px-4 py-2.5 font-bold">Kontak</th>
                          <th className="px-4 py-2.5 font-bold">Grup / Paket</th>
                          <th className="px-4 py-2.5 font-bold">Pembayaran</th>
                          <th className="px-4 py-2.5 font-bold">Status</th>
                          <th className="px-4 py-2.5 font-bold">Daftar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((m, i) => {
                          const pay = paymentInfo(m)
                          const st = statusInfo(m.status)
                          return (
                            <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                              <td className="px-4 py-3 text-xs text-slate-400 font-semibold">{i + 1}</td>
                              <td className="px-4 py-3 min-w-0">
                                <div className="font-bold text-slate-800 dark:text-white">{m.full_name || '-'}</div>
                                <div className="text-xs text-slate-500">@{m.username}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs text-slate-700 dark:text-slate-300 break-all">{m.email}</div>
                                <div className="text-xs text-slate-500">{m.phone_number || '-'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{m.group_name || 'Siswa Biasa'}</div>
                                <div className="text-xs text-slate-500">{planName(m.plan_code)}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-bold ${pay.cls}`}>{pay.label}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(m.created_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
