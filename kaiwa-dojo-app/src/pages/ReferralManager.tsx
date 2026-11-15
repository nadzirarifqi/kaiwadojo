import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchStudents, SUBSCRIPTION_PLANS, type StudentAccount } from '../lib/studentService'
import LoadingScreen from '../components/LoadingScreen'
import { AdminPage, PageHeader, StatGrid, EmptyState, AccessDenied, CARD, BTN_PRIMARY, BTN_SECONDARY } from '../components/admin/AdminUI'

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
  if (std.payment_status === 'rejected') {
    return { label: 'Ditolak', cls: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' }
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
    return <AccessDenied message="Halaman ini khusus Admin untuk melihat peserta berdasarkan kode referral." />
  }

  if (loading) {
    return <LoadingScreen message="Memuat data peserta per referral..." fullScreen={false} />
  }

  const selectCls = 'h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer'

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Admin · Pengguna"
        title="Peserta per Kode Referral"
        description="Pelajar dikelompokkan berdasarkan kode referral yang mereka gunakan saat mendaftar."
        actions={
          <>
            <button type="button" onClick={loadData} className={BTN_SECONDARY}>Muat ulang</button>
            <button type="button" onClick={() => navigate('/kelola-pelajar')} className={BTN_SECONDARY}>Kelola pelajar</button>
            <button
              type="button"
              onClick={() => downloadCsv(visibleGroups)}
              disabled={visibleMemberCount === 0}
              className={BTN_PRIMARY}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Ekspor CSV
            </button>
          </>
        }
      />

      <StatGrid
        label="Ringkasan referral"
        items={[
          { label: 'Kode digunakan', value: totalCodes, tone: 'info' },
          { label: 'Peserta dengan kode', value: withCode, tone: 'success' },
          { label: 'Peserta tanpa kode', value: withoutCode },
          {
            label: 'Kode terbanyak',
            value: topGroup ? <span className="font-mono text-xl">{topGroup.code}</span> : '-',
            hint: topGroup ? `${topGroup.members.length} peserta` : undefined,
            tone: 'warning',
          },
        ]}
      />

      {/* Filter */}
      <section aria-label="Filter peserta" className={`${CARD} p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3`}>
        <div className="relative flex-1 min-w-0">
          <svg className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            aria-label="Cari peserta atau kode referral"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari kode referral, nama, username, email, atau no. HP..."
            className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter status akun" className={selectCls}>
            <option value="all">Semua status</option>
            <option value="approved">Disetujui</option>
            <option value="pending">Menunggu</option>
            <option value="rejected">Ditolak</option>
          </select>
          <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} aria-label="Urutkan kode referral" className={selectCls}>
            <option value="count">Peserta terbanyak</option>
            <option value="latest">Pendaftar terbaru</option>
            <option value="code">Kode (A–Z)</option>
          </select>
          <label className={`${selectCls} flex items-center gap-2 select-none`}>
            <input type="checkbox" checked={showNoCode} onChange={e => setShowNoCode(e.target.checked)} className="size-4 accent-primary" />
            Tampilkan tanpa kode
          </label>
        </div>
      </section>

      {/* Daftar kode referral */}
      <section aria-labelledby="referral-list-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h2 id="referral-list-title" className="text-base font-bold text-slate-900 dark:text-white">Kelompok kode referral</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{visibleGroups.length} kelompok · {visibleMemberCount} peserta</p>
          </div>
          <button
            type="button"
            onClick={toggleAll}
            disabled={visibleGroups.length === 0}
            className="h-9 px-3 rounded-xl bg-transparent border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            {allExpanded ? 'Tutup semua' : 'Buka semua'}
          </button>
        </div>

      {visibleGroups.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            title="Tidak ada peserta yang cocok"
            description={students.length === 0 ? 'Belum ada akun pelajar terdaftar.' : 'Coba ubah kata kunci pencarian atau filter.'}
          />
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
              <article key={g.code} className={`${CARD} overflow-hidden`}>
                <h3 className="m-0">
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
                </h3>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <caption className="sr-only">Peserta dengan kode {isNoCode ? '(tanpa kode)' : g.code}</caption>
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40">
                          <th scope="col" className="px-4 py-2.5 font-bold w-10">#</th>
                          <th scope="col" className="px-4 py-2.5 font-bold">Peserta</th>
                          <th scope="col" className="px-4 py-2.5 font-bold">Kontak</th>
                          <th scope="col" className="px-4 py-2.5 font-bold">Grup / Paket</th>
                          <th scope="col" className="px-4 py-2.5 font-bold">Pembayaran</th>
                          <th scope="col" className="px-4 py-2.5 font-bold">Status</th>
                          <th scope="col" className="px-4 py-2.5 font-bold">Daftar</th>
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
              </article>
            )
          })}
        </div>
      )}
      </section>
    </AdminPage>
  )
}
