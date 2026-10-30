import { useState } from 'react'
import type { Profile } from '../hooks/useAuth'
import { useAuth } from '../hooks/useAuth'
import { BrandMark } from './Sidebar'

interface SubscriptionBlockedScreenProps {
  profile: Profile
  isExpired?: boolean
  onRefresh?: () => Promise<void>
}

export default function SubscriptionBlockedScreen({
  profile,
  isExpired = false,
  onRefresh,
}: SubscriptionBlockedScreenProps) {
  const { signOut } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)

  const adminWa = '087875018001'
  const waMessage = encodeURIComponent(
    `Halo Admin Kaiwa Dojo, saya ingin konfirmasi pembayaran langganan akun saya.\n\n` +
    `Nama: ${profile.full_name}\n` +
    `Username: ${profile.username}\n` +
    `Email: ${profile.email || '-'}\n` +
    `Status Saat Ini: ${isExpired ? 'Masa Langganan Berakhir' : 'Belum Bayar'}`
  )
  const waUrl = `https://wa.me/62${adminWa.replace(/^0/, '')}?text=${waMessage}`

  async function handleCheckStatus() {
    if (refreshing) return
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      if (onRefresh) {
        await onRefresh()
      }
      setRefreshMessage('Status berhasil dicek ulang.')
    } catch {
      setRefreshMessage('Gagal memeriksa status. Silakan coba sesaat lagi.')
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshMessage(null), 4000)
    }
  }

  const expiryDate = profile.subscription_ends_at
    ? new Date(profile.subscription_ends_at.replace(' ', 'T')).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background Decorative Sakura & Light Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-primary/20 via-rose-500/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -right-24 size-96 rounded-full bg-red-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

      {/* Top Navbar Minimal */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="text-xs uppercase tracking-widest text-slate-400 font-bold border-l border-slate-700 pl-3 ml-1 hidden sm:inline">
            Status Langganan
          </span>
        </div>

        <button
          type="button"
          onClick={() => signOut('Anda telah keluar.')}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 cursor-pointer transition-all flex items-center gap-1.5"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Keluar</span>
        </button>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center text-center">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-4 border shadow-lg backdrop-blur-md animate-fade-in bg-rose-500/15 text-rose-300 border-rose-500/30">
          <span className="size-2 rounded-full bg-rose-400 animate-pulse" />
          <span>{isExpired ? 'Masa Langganan Telah Berakhir' : 'Langganan Diperlukan'}</span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight max-w-3xl leading-tight">
          {isExpired ? (
            <>
              Masa Aktif Paket Belajar Kamu <span className="bg-gradient-to-r from-rose-400 to-red-400 bg-clip-text text-transparent">Sudah Habis</span>
            </>
          ) : (
            <>
              Aktifkan Langganan untuk Mulai <span className="bg-gradient-to-r from-red-400 to-amber-300 bg-clip-text text-transparent">Belajar di Kaiwa Dojo</span>
            </>
          )}
        </h1>

        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          Halo, <strong className="text-white font-semibold">{profile.full_name}</strong> ({profile.username}).
          {isExpired ? (
            <> Masa langganan akun kamu telah berakhir pada <strong className="text-rose-300">{expiryDate || 'periode sebelumnya'}</strong>. Silakan perpanjang langganan untuk kembali mengakses materi pembelajaran, kelas live, dan setoran kotoba.</>
          ) : (
            <> Akun kamu belum memiliki paket langganan aktif. Silakan lakukan pembayaran di website pendaftaran atau hubungi admin untuk aktivasi akun.</>
          )}
        </p>

        {/* User Account Info Pill */}
        <div className="mt-4 px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-center gap-3">
          <span>Email: <strong className="text-slate-200">{profile.email || '-'}</strong></span>
          <span className="text-slate-700">•</span>
          <span>Status Bayar: <strong className="text-amber-300 uppercase font-black">{profile.payment_status || 'unpaid'}</strong></span>
          {profile.plan_code && (
            <>
              <span className="text-slate-700">•</span>
              <span>Paket: <strong className="text-indigo-300">{profile.plan_code}</strong></span>
            </>
          )}
        </div>

        {/* Action Buttons Header */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
          <a
            href="https://bangunnegeri.inaconnext.it.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[200px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl shadow-red-950/40 border border-red-400/30 cursor-pointer transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 no-underline"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Langganan di Bangun Negeri</span>
          </a>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3.5 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-extrabold text-sm shadow-xl shadow-emerald-950/30 border border-emerald-400/30 cursor-pointer transition-all flex items-center justify-center gap-2 no-underline"
          >
            <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" />
            </svg>
            <span>WhatsApp Admin</span>
          </a>

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={refreshing}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{refreshing ? 'Memeriksa...' : 'Cek Ulang Status'}</span>
          </button>
        </div>

        {refreshMessage && (
          <p className="mt-2 text-xs font-semibold text-emerald-400 animate-fade-in">
            {refreshMessage}
          </p>
        )}

        {/* Pricing List Cards Section */}
        <div className="mt-10 w-full text-left">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Daftar Paket & Harga Langganan
              </h2>
              <p className="text-xs text-slate-400">
                Pilih paket yang sesuai dengan kebutuhan belajarmu di platform Kaiwa Dojo
              </p>
            </div>
            <span className="hidden sm:inline px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
              Resmi LPK Bangun Negeri
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Minna 1 Mandiri */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.65rem] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                    Mandiri Online
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Bab 1 - 25</span>
                </div>
                <h3 className="text-sm font-black text-white">Minna 1 Mandiri Online</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Akses materi online, video pembahasan bab, dan setoran kotoba.
                </p>
                <div className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-800/80">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Per Bulan</span>
                    <span className="font-extrabold text-white">Rp 200.000</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Per 6 Bulan</span>
                    <span className="font-extrabold text-white">Rp 1.000.000</span>
                  </div>
                  <div className="flex justify-between items-center text-xs bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20">
                    <span className="text-rose-300 font-bold">Per Tahun</span>
                    <span className="font-black text-rose-300">Rp 1.500.000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Minna 1 Kaiwa */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-indigo-500/30 hover:border-indigo-500/50 transition-all flex flex-col justify-between relative shadow-lg shadow-indigo-950/20">
              <span className="absolute -top-2.5 right-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                Populer
              </span>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.65rem] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                    Kaiwa Online
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Live Class</span>
                </div>
                <h3 className="text-sm font-black text-white">Minna 1 Kaiwa Online</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Semua fitur Mandiri + kelas percakapan (kaiwa) live mingguan bersama Sensei.
                </p>
                <div className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-800/80">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Per Bulan</span>
                    <span className="font-extrabold text-white">Rp 250.000</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Per 6 Bulan</span>
                    <span className="font-extrabold text-white">Rp 1.400.000</span>
                  </div>
                  <div className="flex justify-between items-center text-xs bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20">
                    <span className="text-indigo-300 font-bold">Per Tahun</span>
                    <span className="font-black text-indigo-300">Rp 1.800.000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Minna 1 & 2 Mandiri */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.65rem] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Paket Komplit
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Bab 1 - 50</span>
                </div>
                <h3 className="text-sm font-black text-white">Minna 1&2 Mandiri Online</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Akses penuh materi Minna no Nihongo Jilid 1 dan 2 selama 1 tahun penuh.
                </p>
                <div className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-800/80">
                  <div className="flex justify-between items-center text-xs bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                    <span className="text-emerald-300 font-bold">Per Tahun</span>
                    <span className="font-black text-emerald-300">Rp 2.500.000</span>
                  </div>
                  <p className="text-[0.68rem] text-slate-500 italic mt-1">
                    Hemat untuk persiapan intensif kerja/studi ke Jepang.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Minna 1 & 2 Kaiwa */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-amber-500/30 hover:border-amber-500/50 transition-all flex flex-col justify-between relative shadow-lg shadow-amber-950/20">
              <span className="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                Terlengkap
              </span>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.65rem] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    Ultimate Pass
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Jilid 1 & 2 + Live</span>
                </div>
                <h3 className="text-sm font-black text-white">Minna 1&2 Kaiwa Online</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Akses komplit Minna 1 & 2 ditambah kelas live kaiwa 1x seminggu selama 1 tahun.
                </p>
                <div className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-800/80">
                  <div className="flex justify-between items-center text-xs bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    <span className="text-amber-300 font-bold">Per Tahun</span>
                    <span className="font-black text-amber-300">Rp 3.500.000</span>
                  </div>
                  <p className="text-[0.68rem] text-slate-500 italic mt-1">
                    Solusi komprehensif dari nol hingga mahir kaiwa percakapan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 text-center text-xs text-slate-500 border-t border-slate-800/80">
        <p>© 2026 Kaiwa Dojo · LPK Bangun Negeri. Hak Cipta Dilindungi.</p>
      </footer>
    </div>
  )
}
