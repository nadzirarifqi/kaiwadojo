import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { fetchGroups, sortGroupsAlphabetically, type KaiwaGroup } from '../lib/groupService'
import {
  compileAttendance,
  pushAttendanceToSheet,
  attendanceToCsv,
  toDateKey,
  type AttendanceReport,
  type AttendanceCategory,
} from '../lib/attendanceService'
import {
  AdminPage, PageHeader, StatGrid, Panel, EmptyState, AccessDenied, Badge,
  CARD, BTN_PRIMARY, BTN_SECONDARY,
} from '../components/admin/AdminUI'

/* ── Halaman Admin: Rekap Kehadiran ───────────────
   Kehadiran = pelajar login / membuka aplikasi / beraktivitas pada hari itu.
   Admin memilih rentang tanggal, melihat matriks per hari,
   lalu mengirim hasilnya ke tab "Compile Absence" di Google Sheets.
   ─────────────────────────────────────────────── */

type PresetKey = 'today' | 'week' | 'last7' | 'month' | 'lastMonth' | 'last30'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hari ini' },
  { key: 'week', label: 'Minggu ini' },
  { key: 'last7', label: '7 hari terakhir' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'lastMonth', label: 'Bulan lalu' },
  { key: 'last30', label: '30 hari terakhir' },
]

function presetRange(key: PresetKey): [string, string] {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  switch (key) {
    case 'today':
      return [toDateKey(now), toDateKey(now)]
    case 'week': {
      const mondayOffset = (now.getDay() + 6) % 7
      return [toDateKey(addDays(now, -mondayOffset)), toDateKey(now)]
    }
    case 'last7':
      return [toDateKey(addDays(now, -6)), toDateKey(now)]
    case 'month':
      return [toDateKey(new Date(y, m, 1)), toDateKey(now)]
    case 'lastMonth':
      return [toDateKey(new Date(y, m - 1, 1)), toDateKey(new Date(y, m, 0))]
    case 'last30':
      return [toDateKey(addDays(now, -29)), toDateKey(now)]
  }
}

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatLong(key: string): string {
  return parseKey(key).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CATEGORY_TONE: Record<AttendanceCategory, 'success' | 'info' | 'warning' | 'danger'> = {
  'Sangat Aktif': 'success',
  Aktif: 'info',
  'Kurang Aktif': 'warning',
  Pasif: 'danger',
}

type SortMode = 'name' | 'pct_desc' | 'pct_asc' | 'group'

const inputCls =
  'h-11 w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1'

export default function AttendanceReportPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const confirm = useConfirm()

  const initial = presetRange('month')
  const [start, setStart] = useState(initial[0])
  const [end, setEnd] = useState(initial[1])
  const [group, setGroup] = useState('all')
  const [includeUnapproved, setIncludeUnapproved] = useState(false)
  const [groups, setGroups] = useState<KaiwaGroup[]>([])

  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [lastPush, setLastPush] = useState<{ at: Date; url: string | null; students: number; days: number } | null>(null)

  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('name')

  const isAdmin = profile?.role === 'admin'
  const query = { start, end, group, include_unapproved: includeUnapproved }

  async function load() {
    if (!start || !end) return
    if (end < start) {
      setError('Tanggal akhir tidak boleh sebelum tanggal mulai.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setReport(await compileAttendance(query))
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat rekap kehadiran.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    fetchGroups().then(g => setGroups(sortGroupsAlphabetically(g))).catch(() => {})
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  function applyPreset(key: PresetKey) {
    const [s, e] = presetRange(key)
    setStart(s)
    setEnd(e)
  }
  const activePreset = PRESETS.find(p => {
    const [s, e] = presetRange(p.key)
    return s === start && e === end
  })?.key

  // Laporan yang tampil sudah tidak sesuai filter → tampilkan pengingat
  const isStale = !!report && (report.start !== start || report.end !== end)

  const rows = useMemo(() => {
    if (!report) return []
    const q = search.trim().toLowerCase()
    const list = q
      ? report.students.filter(s => [s.full_name, s.username, s.email || '', s.group_name || ''].some(v => v.toLowerCase().includes(q)))
      : [...report.students]
    list.sort((a, b) => {
      if (sortMode === 'pct_desc') return b.percentage - a.percentage || a.full_name.localeCompare(b.full_name)
      if (sortMode === 'pct_asc') return a.percentage - b.percentage || a.full_name.localeCompare(b.full_name)
      if (sortMode === 'group') return (a.group_name || '~').localeCompare(b.group_name || '~') || a.full_name.localeCompare(b.full_name)
      return a.full_name.localeCompare(b.full_name)
    })
    return list
  }, [report, search, sortMode])

  const stats = useMemo(() => {
    const list = report?.students || []
    const avg = list.length ? list.reduce((n, s) => n + s.percentage, 0) / list.length : 0
    const count = (c: AttendanceCategory) => list.filter(s => s.category === c).length
    return { avg, veryActive: count('Sangat Aktif'), passive: count('Pasif'), total: list.length }
  }, [report])

  function downloadCsv() {
    if (!report) return
    const blob = new Blob([attendanceToCsv(report, rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rekap-kehadiran_${report.start}_${report.end}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handlePush() {
    if (end < start) {
      setError('Tanggal akhir tidak boleh sebelum tanggal mulai.')
      return
    }
    const ok = await confirm({
      title: 'Kirim ke Google Sheets?',
      message: `Isi tab "Compile Absence" akan diganti dengan rekap ${formatLong(start)} – ${formatLong(end)}.`,
      confirmLabel: 'Ya, kirim',
      tone: 'primary',
    })
    if (!ok) return
    setPushing(true)
    try {
      const res = await pushAttendanceToSheet(query)
      setLastPush({ at: new Date(), url: res.sheet_url, students: res.students, days: res.days })
      toast.success(`${res.students} siswa × ${res.days} hari terkirim ke tab "Compile Absence".`)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim ke Google Sheets.')
    } finally {
      setPushing(false)
    }
  }

  if (!isAdmin) {
    return <AccessDenied message="Halaman ini khusus Admin untuk merekap kehadiran pelajar." />
  }

  const dates = report?.dates || []

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Admin · Aktivitas"
        title="Rekap Kehadiran"
        description="Pelajar dihitung hadir pada hari ia login, membuka aplikasi, atau beraktivitas (setor kotoba, kuis, reservasi kelas, rencana harian, menonton video). Pilih rentang tanggal, periksa hasilnya, lalu kirim ke Google Sheets."
        actions={
          <>
            <button type="button" onClick={downloadCsv} disabled={!report || rows.length === 0} className={BTN_SECONDARY}>
              Unduh CSV
            </button>
            <button type="button" onClick={handlePush} disabled={pushing || loading} className={BTN_PRIMARY}>
              <svg className={`size-4 ${pushing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                {pushing
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />}
              </svg>
              {pushing ? 'Mengirim…' : 'Kirim ke Google Sheets'}
            </button>
          </>
        }
      />

      {/* ── Rentang waktu & filter ── */}
      <Panel title="Rentang waktu" description="Pilih periode cepat atau tentukan tanggal sendiri.">
        <form
          onSubmit={e => { e.preventDefault(); load() }}
          className="flex flex-col gap-4"
        >
          <div role="group" aria-label="Periode cepat" className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                aria-pressed={activePreset === p.key}
                onClick={() => applyPreset(p.key)}
                className={`h-9 px-3 rounded-lg text-sm font-semibold cursor-pointer border transition-colors ${
                  activePreset === p.key
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="att-start" className={labelCls}>Dari tanggal</label>
              <input id="att-start" type="date" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label htmlFor="att-end" className={labelCls}>Sampai tanggal</label>
              <input id="att-end" type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label htmlFor="att-group" className={labelCls}>Grup</label>
              <select id="att-group" value={group} onChange={e => setGroup(e.target.value)} className={`${inputCls} cursor-pointer font-semibold`}>
                <option value="all">Semua grup</option>
                {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                <option value="__no_group__">Siswa Biasa (tanpa grup)</option>
              </select>
            </div>
            <button type="submit" disabled={loading} className={`${BTN_PRIMARY} w-full`}>
              {loading ? 'Memuat…' : 'Tampilkan rekap'}
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none w-fit">
            <input type="checkbox" checked={includeUnapproved} onChange={e => setIncludeUnapproved(e.target.checked)} className="size-4 accent-primary" />
            Sertakan akun yang belum diverifikasi
          </label>

          {isStale && !loading && (
            <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
              Rentang tanggal berubah — tekan <strong>Tampilkan rekap</strong> untuk memperbarui tabel.
              Tombol <strong>Kirim ke Google Sheets</strong> selalu memakai rentang yang dipilih di atas.
            </p>
          )}
          {error && (
            <p className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-semibold" role="alert">
              {error}
            </p>
          )}
        </form>
      </Panel>

      {lastPush && (
        <aside aria-label="Hasil pengiriman" className={`${CARD} px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-emerald-300 dark:border-emerald-800`}>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <strong className="text-emerald-700 dark:text-emerald-300">Terkirim</strong> pukul {lastPush.at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} —
            {' '}{lastPush.students} siswa × {lastPush.days} hari ke tab <strong>Compile Absence</strong>.
          </p>
          {lastPush.url && (
            <a href={lastPush.url} target="_blank" rel="noopener noreferrer" className={`${BTN_SECONDARY} no-underline`}>
              Buka Google Sheets ↗
            </a>
          )}
        </aside>
      )}

      {report && (
        <StatGrid
          label="Ringkasan kehadiran"
          items={[
            { label: 'Jumlah siswa', value: stats.total, hint: `${report.total_days} hari dalam periode` },
            { label: 'Rata-rata kehadiran', value: `${stats.avg.toFixed(0)}%`, tone: 'info' },
            { label: 'Sangat aktif', value: stats.veryActive, tone: 'success', hint: 'hadir ≥ 80%' },
            { label: 'Pasif', value: stats.passive, tone: 'danger', hint: 'hadir < 40%' },
          ]}
        />
      )}

      {/* ── Tabel kehadiran ── */}
      <Panel
        title="Kehadiran per hari"
        description={report ? `${formatLong(report.start)} – ${formatLong(report.end)} · jam = pertama kali aktif hari itu (${report.timezone})` : undefined}
        actions={report && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              type="search"
              aria-label="Cari siswa"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari siswa…"
              className={`${inputCls} sm:w-56`}
            />
            <select aria-label="Urutkan" value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className={`${inputCls} sm:w-44 cursor-pointer font-semibold`}>
              <option value="name">Nama (A–Z)</option>
              <option value="pct_desc">Kehadiran tertinggi</option>
              <option value="pct_asc">Kehadiran terendah</option>
              <option value="group">Grup</option>
            </select>
          </div>
        )}
        bodyClassName="p-0 sm:p-0 pt-4"
      >
        {loading && !report ? (
          <div className="py-12 flex justify-center">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Memuat" />
          </div>
        ) : !report || rows.length === 0 ? (
          <EmptyState
            title={!report ? 'Belum ada rekap' : search ? 'Tidak ada siswa yang cocok' : 'Tidak ada siswa di filter ini'}
            description={!report ? 'Pilih rentang tanggal lalu tekan "Tampilkan rekap".' : search ? `Tidak ada hasil untuk "${search}".` : 'Ubah grup atau sertakan akun yang belum diverifikasi.'}
          />
        ) : (
          <div className={`overflow-auto max-h-[70vh] border-t border-slate-100 dark:border-slate-800 ${loading ? 'opacity-60' : ''}`}>
            <table className="text-sm border-separate border-spacing-0 min-w-full">
              <caption className="sr-only">Matriks kehadiran siswa per tanggal</caption>
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <th scope="col" className="sticky top-0 left-0 z-30 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 min-w-[200px]">Siswa</th>
                  <th scope="col" className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center">Hadir</th>
                  <th scope="col" className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-semibold border-b border-slate-200 dark:border-slate-700">Kategori</th>
                  {dates.map(d => {
                    const dt = parseKey(d)
                    const weekend = dt.getDay() === 0
                    return (
                      <th
                        key={d}
                        scope="col"
                        className={`sticky top-0 z-20 px-1.5 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center whitespace-nowrap ${weekend ? 'bg-slate-100 dark:bg-slate-800/90' : 'bg-slate-50 dark:bg-slate-800'}`}
                      >
                        <abbr title={formatLong(d)} className="no-underline block leading-tight">
                          <span className="block">{DAY_SHORT[dt.getDay()]}</span>
                          <span className="block text-slate-700 dark:text-slate-200">{dt.getDate()} {MONTH_SHORT[dt.getMonth()]}</span>
                        </abbr>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} className="group">
                    <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 px-3 py-2 text-left font-normal border-b border-slate-100 dark:border-slate-800">
                      <span className="block font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">{s.full_name}</span>
                      <span className="block text-xs text-slate-500 truncate max-w-[220px]">@{s.username} · {s.group_name || 'Siswa Biasa'}</span>
                    </th>
                    <td className="px-3 py-2 text-center border-b border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 whitespace-nowrap">
                      <span className="font-bold tabular-nums text-slate-900 dark:text-white">{s.present_days}</span>
                      <span className="text-xs text-slate-400"> / {report.total_days}</span>
                      <span className="block text-xs text-slate-500 tabular-nums">{Math.round(s.percentage)}%</span>
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 whitespace-nowrap">
                      <Badge tone={CATEGORY_TONE[s.category]}>{s.category}</Badge>
                    </td>
                    {dates.map(d => {
                      const time = s.days[d]
                      return (
                        <td key={d} className="px-1 py-1.5 text-center border-b border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60">
                          {time ? (
                            <span className="inline-block min-w-[3rem] px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tabular-nums" title={`Hadir ${formatLong(d)}, masuk ${time}`}>
                              {time}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600" title={`Tidak hadir ${formatLong(d)}`}>
                              <span aria-hidden="true">·</span>
                              <span className="sr-only">Tidak hadir</span>
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-xs">
                  <th scope="row" className="sticky left-0 bottom-0 z-10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Total hadir</th>
                  <td className="sticky bottom-0 bg-slate-50 dark:bg-slate-800" />
                  <td className="sticky bottom-0 bg-slate-50 dark:bg-slate-800" />
                  {dates.map(d => (
                    <td key={d} className="sticky bottom-0 bg-slate-50 dark:bg-slate-800 px-1 py-2 text-center font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {report.present_per_date[d] ?? 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </AdminPage>
  )
}
