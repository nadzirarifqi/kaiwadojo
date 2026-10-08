import { useState, useEffect } from 'react'
import {
  sendWhatsAppBroadcast,
  saveBroadcastLog,
  fetchBroadcastLogs,
  type BroadcastResult,
  type BroadcastLog,
} from '../lib/whatsappService'
import { fetchStudents, type StudentAccount } from '../lib/studentService'
import { fetchGroups, sortGroupsAlphabetically, type KaiwaGroup } from '../lib/groupService'

interface Props {
  adminId: string
  adminName: string
  onClose: () => void
}

const MESSAGE_TEMPLATES = [
  {
    label: 'Pengumuman Umum',
    text: '*[PENGUMUMAN KAIWADOJO]*\n\nHalo Kaka!\n\nAdmin KaiwaDojo ingin menyampaikan:\n\n{isi pengumuman di sini}\n\nTerima kasih!\n— Tim Admin KaiwaDojo',
  },
  {
    label: 'Jadwal Kelas Live',
    text: '*[JADWAL KELAS LIVE BARU]*\n\nHalo Kaka! Kelas Live berikutnya:\n\nTanggal: {tanggal}\nJam: {jam} WIB\nPemateri: {nama pemateri}\nMateri: {bab}\n\nSegera reservasi di aplikasi KaiwaDojo sebelum kuota penuh!',
  },
  {
    label: 'Reminder Misi',
    text: '*[REMINDER MISI HARIAN]*\n\nHalo Kaka! Jangan lupa susun Misi Belajar Harian kamu di KaiwaDojo ya!\n\nLogin -> Rencana Belajar -> Susun Misi Hari Ini\n\nKonsistensi adalah kunci sukses belajar Bahasa Jepang!\n— Tim Admin KaiwaDojo',
  },
  {
    label: 'Pesan Motivasi',
    text: '*[SEMANGAT BELAJAR BAHASA JEPANG]*\n\nHalo Kaka! Tetap semangat belajarnya!\n\nIngat, setiap langkah kecil hari ini adalah kemajuan besar untuk masa depan!\n\nSampai jumpa di kelas ya!\n— Tim Admin KaiwaDojo',
  },
]

export default function WhatsAppBroadcastModal({ adminId, adminName, onClose }: Props) {
  const [students, setStudents] = useState<StudentAccount[]>([])
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [logs, setLogs] = useState<BroadcastLog[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<BroadcastResult | null>(null)
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose')

  useEffect(() => {
    async function load() {
      setLoadingData(true)
      const [stds, grps, ls] = await Promise.all([
        fetchStudents(),
        fetchGroups(),
        fetchBroadcastLogs(10),
      ])
      setStudents(stds)
      setGroups(sortGroupsAlphabetically(grps))
      setLogs(ls)
      setLoadingData(false)
    }
    load()
  }, [])

  const approvedStudents = students.filter(s => s.status === 'approved')
  const filteredTargets = filterGroup === 'all'
    ? approvedStudents
    : approvedStudents.filter(s => (s.group_name || '').toLowerCase() === filterGroup.toLowerCase())

  const withPhone = filteredTargets.filter(s => s.phone_number && s.phone_number.trim().length >= 8)
  const withoutPhone = filteredTargets.length - withPhone.length

  const filterLabel = filterGroup === 'all'
    ? 'Semua Pelajar'
    : `Grup ${filterGroup.toUpperCase()}`

  async function handleSend() {
    if (!message.trim() || sending || withPhone.length === 0) return

    setSending(true)
    setResult(null)

    const targets = filteredTargets.map(s => ({
      id: s.id,
      full_name: s.full_name,
      phone_number: s.phone_number,
    }))

    const res = await sendWhatsAppBroadcast(targets, message.trim())
    setResult(res)

    await saveBroadcastLog({
      sentById: adminId,
      sentByName: adminName,
      message: message.trim(),
      filterLabel,
      result: res,
    })

    const newLogs = await fetchBroadcastLogs(10)
    setLogs(newLogs)
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] overflow-y-auto animate-fade-in">
      <div className="flex min-h-full items-start justify-center p-3 sm:p-6 pt-8 sm:pt-12 pb-12">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col border border-slate-200 dark:border-slate-800">

          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <svg className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">Broadcast WhatsApp Admin</h3>
                <p className="text-xs text-white/80 font-medium">Kirim pesan massal ke pelajar via Fonnte API</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="size-9 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-xl flex items-center justify-center"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
            {(['compose', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                {tab === 'compose' ? (
                  <>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <span>Tulis Pesan</span>
                  </>
                ) : (
                  <>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <span>Riwayat ({logs.length})</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[70dvh]">

            {/* COMPOSE */}
            {activeTab === 'compose' && (
              <div className="flex flex-col gap-4">
                {loadingData ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <svg className="size-8 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Memuat data pelajar...</span>
                  </div>
                ) : (
                  <>
                    {/* Filter */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <label className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        <span>Filter Target Broadcast</span>
                      </label>
                      <select
                        value={filterGroup}
                        onChange={e => { setFilterGroup(e.target.value); setResult(null) }}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      >
                        <option value="all">Semua Pelajar (Approved)</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.name}>Grup: {g.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                        <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">{filteredTargets.length}</div>
                        <div className="text-[0.65rem] font-bold text-slate-400 mt-0.5">Total Target</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                        <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">{withPhone.length}</div>
                        <div className="text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5 flex items-center justify-center gap-1">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>Punya Nomor WA</span>
                        </div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800 text-center">
                        <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">{withoutPhone}</div>
                        <div className="text-[0.65rem] font-bold text-amber-600 dark:text-amber-500 mt-0.5 flex items-center justify-center gap-1">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          <span>Tanpa Nomor WA</span>
                        </div>
                      </div>
                    </div>

                    {withPhone.length === 0 && (
                      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                        <svg className="size-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        <span>Tidak ada pelajar dengan nomor WhatsApp valid pada filter ini. Broadcast tidak bisa dikirim.</span>
                      </div>
                    )}

                    {/* Templates */}
                    <div>
                      <label className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                        <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span>Template Pesan Cepat</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {MESSAGE_TEMPLATES.map((tpl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setMessage(tpl.text)}
                            className="p-2.5 rounded-xl text-xs font-bold text-left bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer text-slate-700 dark:text-slate-300 flex items-center gap-2"
                          >
                            <svg className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="truncate">{tpl.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                          <span>Isi Pesan Broadcast</span>
                        </label>
                        <span className={`text-[0.65rem] font-bold ${message.length > 900 ? 'text-red-500' : 'text-slate-400'}`}>
                          {message.length} / 1000
                        </span>
                      </div>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        maxLength={1000}
                        rows={7}
                        placeholder="Tulis pesan yang akan dikirim ke semua pelajar via WhatsApp...&#10;Gunakan *teks* untuk bold, _teks_ untuk italic."
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium bg-white dark:bg-slate-800 dark:text-white outline-none focus:border-emerald-500 resize-none leading-relaxed"
                      />
                    </div>

                    {/* Result */}
                    {result && (
                      <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${
                        result.failed > 0
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        <div className="text-sm font-extrabold flex items-center gap-2">
                          {result.failed > 0 ? (
                            <svg className="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          ) : (
                            <svg className="size-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          )}
                          <span className={result.failed > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}>
                            {result.failed > 0 ? 'Broadcast Sebagian Gagal' : 'Broadcast Berhasil Dikirim!'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs font-bold">
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span>{result.sent} Terkirim</span>
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span>{result.skipped} Di-skip (no phone)</span>
                          </span>
                          {result.failed > 0 && (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              <span>{result.failed} Gagal</span>
                            </span>
                          )}
                        </div>
                        {result.failReason && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{result.failReason}</p>
                        )}
                      </div>
                    )}

                    {/* Send Button */}
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || !message.trim() || withPhone.length === 0}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-800 text-white font-extrabold rounded-2xl border-none cursor-pointer text-sm shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <>
                          <svg className="size-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Mengirim ke {withPhone.length} Nomor...</span>
                        </>
                      ) : (
                        <>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>Kirim Broadcast ke {withPhone.length} Pelajar ({filterLabel})</span>
                        </>
                      )}
                    </button>

                    <p className="text-[0.68rem] text-slate-400 dark:text-slate-500 text-center font-medium flex items-center justify-center gap-1.5">
                      <svg className="size-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <span>Pesan akan langsung terkirim ke WhatsApp semua pelajar terdaftar. Pastikan isi pesan sudah benar.</span>
                    </p>
                  </>
                )}
              </div>
            )}

            {/* HISTORY */}
            {activeTab === 'history' && (
              <div className="flex flex-col gap-3">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Belum ada riwayat broadcast.</p>
                    <p className="text-xs text-slate-400">Riwayat akan muncul di sini setelah Anda mengirim pesan.</p>
                  </div>
                ) : (
                  logs.map(log => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[0.68rem] font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>{log.filter_label}</span>
                          </span>
                          {log.failed_count > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-[0.68rem] font-bold flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-red-500" />
                              <span>Ada Gagal</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[0.65rem] text-slate-400 shrink-0">
                          {new Date(log.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-3 whitespace-pre-line bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        {log.message}
                      </p>

                      <div className="flex flex-wrap gap-2 text-[0.68rem] font-bold items-center">
                        <span className="text-slate-500">Total: {log.target_count}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{log.sent_count} Terkirim</span>
                        </span>
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          <span>{log.skipped_count} Di-skip</span>
                        </span>
                        {log.failed_count > 0 && (
                          <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            <span>{log.failed_count} Gagal</span>
                          </span>
                        )}
                        <span className="text-slate-400 ml-auto italic">oleh {log.sent_by_name}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

