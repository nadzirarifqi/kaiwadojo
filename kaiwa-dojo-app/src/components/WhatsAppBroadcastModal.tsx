import { useState, useEffect } from 'react'
import {
  sendWhatsAppBroadcast,
  saveBroadcastLog,
  fetchBroadcastLogs,
  type BroadcastResult,
  type BroadcastLog,
} from '../lib/whatsappService'
import { fetchStudents, type StudentAccount } from '../lib/studentService'
import { fetchGroups, type KaiwaGroup } from '../lib/groupService'

interface Props {
  adminId: string
  adminName: string
  onClose: () => void
}

const MESSAGE_TEMPLATES = [
  {
    label: '📣 Pengumuman Umum',
    text: '📢 *[PENGUMUMAN KAIWADOJO]*\n\nHalo Kaka! 👋\n\nAdmin KaiwaDojo ingin menyampaikan:\n\n{isi pengumuman di sini}\n\nTerima kasih! 🙏\n— Tim Admin KaiwaDojo',
  },
  {
    label: '📅 Jadwal Kelas Live',
    text: '🎉 *JADWAL KELAS LIVE BARU!*\n\nHalo Kaka! Kelas Live berikutnya:\n\n📅 Tanggal: {tanggal}\n⏰ Jam: {jam} WIB\n👨‍🏫 Pemateri: {nama pemateri}\n📖 Materi: {bab}\n\nSegera reservasi di aplikasi KaiwaDojo sebelum kuota penuh! 🚀',
  },
  {
    label: '⚠️ Reminder Misi',
    text: '⚠️ *REMINDER MISI HARIAN*\n\nHalo Kaka! Jangan lupa susun Misi Belajar Harian kamu di KaiwaDojo ya! 🎯\n\nLogin → Rencana Belajar → Susun Misi Hari Ini\n\nKonsistensi adalah kunci sukses belajar Bahasa Jepang! 頑張ってね！💪',
  },
  {
    label: '🎊 Motivasi',
    text: '🎊 *SEMANGAT BELAJAR BAHASA JEPANG!*\n\nHalo Kaka! 日本語の勉強、頑張って！ 💫\n\nIngat, setiap langkah kecil hari ini adalah kemajuan besar untuk masa depan!\n\nSampai jumpa di kelas ya! 👋\n— Tim Admin KaiwaDojo',
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
      setGroups(grps)
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
              <div className="size-11 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0">
                📢
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
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
            {(['compose', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                {tab === 'compose' ? '✏️ Tulis Pesan' : `📋 Riwayat (${logs.length})`}
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
                    <span className="text-3xl animate-spin">⏳</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Memuat data pelajar...</span>
                  </div>
                ) : (
                  <>
                    {/* Filter */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <label className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                        🎯 Filter Target Broadcast
                      </label>
                      <select
                        value={filterGroup}
                        onChange={e => { setFilterGroup(e.target.value); setResult(null) }}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      >
                        <option value="all">📣 Semua Pelajar (Approved)</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.name}>🏷️ Grup: {g.name}</option>
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
                        <div className="text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">✅ Punya Nomor WA</div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800 text-center">
                        <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">{withoutPhone}</div>
                        <div className="text-[0.65rem] font-bold text-amber-600 dark:text-amber-500 mt-0.5">⚠️ Tanpa Nomor WA</div>
                      </div>
                    </div>

                    {withPhone.length === 0 && (
                      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                        <span className="text-lg shrink-0">🚫</span>
                        <span>Tidak ada pelajar dengan nomor WhatsApp valid pada filter ini. Broadcast tidak bisa dikirim.</span>
                      </div>
                    )}

                    {/* Templates */}
                    <div>
                      <label className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                        📝 Template Pesan Cepat
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {MESSAGE_TEMPLATES.map((tpl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setMessage(tpl.text)}
                            className="p-2.5 rounded-xl text-xs font-bold text-left bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer text-slate-700 dark:text-slate-300"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">
                          💬 Isi Pesan Broadcast
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
                          <span className="text-xl">{result.failed > 0 ? '⚠️' : '🎉'}</span>
                          <span className={result.failed > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}>
                            {result.failed > 0 ? 'Broadcast Sebagian Gagal' : 'Broadcast Berhasil Dikirim!'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs font-bold">
                          <span className="text-emerald-600 dark:text-emerald-400">✅ {result.sent} Terkirim</span>
                          <span className="text-amber-600 dark:text-amber-400">⚠️ {result.skipped} Di-skip (no phone)</span>
                          {result.failed > 0 && <span className="text-red-600 dark:text-red-400">❌ {result.failed} Gagal</span>}
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
                          <span className="animate-spin text-lg">⏳</span>
                          <span>Mengirim ke {withPhone.length} Nomor...</span>
                        </>
                      ) : (
                        <>
                          <span>📢</span>
                          <span>Kirim Broadcast ke {withPhone.length} Pelajar ({filterLabel})</span>
                        </>
                      )}
                    </button>

                    <p className="text-[0.68rem] text-slate-400 dark:text-slate-500 text-center font-medium">
                      ⚠️ Pesan akan langsung terkirim ke WhatsApp semua pelajar terdaftar. Pastikan isi pesan sudah benar.
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
                    <span className="text-4xl">📋</span>
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
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[0.68rem] font-bold border border-emerald-200 dark:border-emerald-800">
                            📣 {log.filter_label}
                          </span>
                          {log.failed_count > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-[0.68rem] font-bold">
                              ⚠️ Ada Gagal
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
                        <span className="text-emerald-600 dark:text-emerald-400">✅ {log.sent_count} Terkirim</span>
                        <span className="text-amber-600 dark:text-amber-400">⚠️ {log.skipped_count} Di-skip</span>
                        {log.failed_count > 0 && <span className="text-red-600 dark:text-red-400">❌ {log.failed_count} Gagal</span>}
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

