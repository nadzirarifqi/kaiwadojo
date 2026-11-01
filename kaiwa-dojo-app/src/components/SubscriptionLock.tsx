import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getSubscriptionAccess } from '../lib/subscriptionAccess'
import ModalPortal from './ModalPortal'

const ADMIN_WA = '087875018001'
export const SUBSCRIBE_URL = 'https://bangunnegeri.inaconnext.it.com'

/* ── Ikon ── */
export function LockIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
function ExternalIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}
function WhatsAppIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" />
    </svg>
  )
}
function RefreshIcon({ className = 'size-4', spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg className={`${className} ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

/** Data & aksi bersama: link WhatsApp admin + cek ulang status langganan. */
function useSubscriptionActions() {
  const { profile, refreshProfile } = useAuth()
  const { isExpired, isRejected, rejectionReason } = getSubscriptionAccess(profile)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const waText = encodeURIComponent(
    `Halo Admin Kaiwa Dojo, saya ingin konfirmasi pembayaran langganan akun saya.\n\n` +
    `Nama: ${profile?.full_name || '-'}\n` +
    `Username: ${profile?.username || '-'}\n` +
    `Email: ${profile?.email || '-'}\n` +
    `Status Saat Ini: ${isRejected ? 'Pembayaran Ditolak' : isExpired ? 'Masa Langganan Berakhir' : 'Belum Bayar'}`
  )
  const waUrl = `https://wa.me/62${ADMIN_WA.replace(/^0/, '')}?text=${waText}`

  async function checkStatus() {
    if (checking) return
    setChecking(true)
    setMessage(null)
    try {
      // Jika langganan sudah aktif, profil baru membuat komponen induk berhenti menampilkan kunci ini
      await refreshProfile()
      setMessage('Status sudah dicek ulang. Jika sudah bayar tapi masih terkunci, hubungi admin.')
    } catch {
      setMessage('Gagal memeriksa status. Coba sesaat lagi.')
    } finally {
      setChecking(false)
    }
  }

  return { profile, isExpired, isRejected, rejectionReason, waUrl, checking, message, checkStatus }
}

/** Kotak alasan penolakan pembayaran dari admin. */
function RejectionReason({ reason, dark = false }: { reason: string; dark?: boolean }) {
  return (
    <div className={`mt-2.5 px-3 py-2 rounded-xl border text-left text-sm ${
      dark
        ? 'bg-orange-500/10 border-orange-400/30 text-orange-200'
        : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-200'
    }`}>
      <span className="font-semibold">Alasan dari admin:</span> {reason}
    </div>
  )
}

function formatEndDate(value?: string | null): string | null {
  if (!value) return null
  const d = new Date(value.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* Gaya tombol yang sama dengan Dashboard */
const BTN_PRIMARY = 'h-11 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold no-underline border-none cursor-pointer transition-colors flex items-center justify-center gap-2'
const BTN_WA = 'h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold no-underline border-none cursor-pointer transition-colors flex items-center justify-center gap-2'

/**
 * Kartu status langganan untuk Dashboard pelajar yang belum bayar / langganan habis.
 * Mengikuti gaya kartu Dashboard (putih/gelap, rounded-2xl, ikon dalam tile).
 */
export function SubscriptionStatusCard({ className = '' }: { className?: string }) {
  const { profile, isExpired, isRejected, rejectionReason, waUrl, checking, message, checkStatus } = useSubscriptionActions()
  const endDate = formatEndDate(profile?.subscription_ends_at)

  const lockedFeatures = ['Video materi', 'Tambah setoran kotoba', 'Reservasi kelas live']

  return (
    <section
      aria-label="Status langganan"
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="size-10 shrink-0 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-primary dark:text-primary-lighter flex items-center justify-center">
            <LockIcon />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {isRejected ? 'Pembayaran ditolak' : isExpired ? 'Masa langganan berakhir' : 'Aktifkan langganan'}
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-primary dark:bg-rose-950/50 dark:text-primary-lighter">
                {isRejected ? 'Tidak valid' : isExpired ? 'Kedaluwarsa' : 'Belum berlangganan'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isRejected
                ? 'Admin belum dapat memverifikasi pembayaranmu. Silakan bayar ulang atau kirim bukti pembayaran yang valid, lalu hubungi admin.'
                : isExpired
                ? <>Paket belajarmu berakhir{endDate ? <> pada <span className="font-semibold text-slate-700 dark:text-slate-200">{endDate}</span></> : null}. Perpanjang untuk membuka kembali fitur berikut.</>
                : 'Kamu tetap bisa menjelajah dashboard dan menyusun rencana belajar. Fitur berikut terbuka setelah pembayaran dikonfirmasi.'}
            </p>
            {isRejected && rejectionReason && <RejectionReason reason={rejectionReason} />}
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {lockedFeatures.map(f => (
                <li key={f} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <LockIcon className="size-3.5 text-slate-400" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2 shrink-0">
          <a href={SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
            {isRejected ? 'Bayar ulang' : isExpired ? 'Perpanjang langganan' : 'Langganan sekarang'}
            <ExternalIcon />
          </a>
          <div className="flex gap-2">
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className={`${BTN_WA} flex-1`}>
              <WhatsAppIcon />
              Admin
            </a>
            <button
              type="button"
              onClick={checkStatus}
              disabled={checking}
              title="Cek ulang status langganan"
              className="h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshIcon spinning={checking} />
              <span>{checking ? 'Memeriksa...' : 'Cek status'}</span>
            </button>
          </div>
        </div>
      </div>
      {message && <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{message}</p>}
    </section>
  )
}

/**
 * Pengingat ringkas di bagian atas halaman (selain Dashboard) untuk pelajar yang belum bayar.
 */
export function SubscriptionNoticeBar() {
  const { isExpired, isRejected } = getSubscriptionAccess(useAuth().profile)
  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <span className="size-8 shrink-0 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-primary dark:text-primary-lighter flex items-center justify-center">
        <LockIcon className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-snug">
        <span className="font-semibold text-slate-900 dark:text-white">
          {isRejected ? 'Pembayaran ditolak admin.' : isExpired ? 'Masa langganan berakhir.' : 'Akun belum berlangganan.'}
        </span>{' '}
        <span className="hidden sm:inline">Video materi, tambah kotoba, dan reservasi kelas terkunci sampai pembayaran dikonfirmasi.</span>
      </p>
      <a
        href={SUBSCRIBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="h-9 px-3 shrink-0 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-semibold no-underline transition-colors flex items-center"
      >
        {isRejected ? 'Bayar ulang' : isExpired ? 'Perpanjang' : 'Langganan'}
      </a>
    </div>
  )
}

/**
 * Isi panel "fitur terkunci" untuk pelajar yang belum bayar / langganan habis.
 * - tone="auto" (default): ikut tema terang/gelap — untuk kartu di halaman biasa & modal.
 * - tone="dark": selalu gelap — untuk area pemutar video (MyCourses) yang berlatar hitam.
 */
export function SubscriptionLockCard({
  feature,
  onClose,
  tone = 'auto',
}: {
  feature: string
  onClose?: () => void
  tone?: 'auto' | 'dark'
}) {
  const { isExpired, isRejected, rejectionReason, waUrl, checking, message, checkStatus } = useSubscriptionActions()
  const dark = tone === 'dark'

  return (
    <div className="w-full max-w-md text-center flex flex-col items-center gap-3 px-5 py-8">
      <div className={`size-14 shrink-0 rounded-2xl flex items-center justify-center ${dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 dark:bg-rose-950/50 text-primary dark:text-primary-lighter'}`}>
        <LockIcon className="size-7" />
      </div>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 dark:bg-rose-950/50 text-primary dark:text-primary-lighter'}`}>
        {isRejected ? 'Pembayaran ditolak' : isExpired ? 'Masa langganan berakhir' : 'Langganan diperlukan'}
      </span>
      <div>
        <h3 className={`text-lg font-bold leading-snug ${dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{feature} terkunci</h3>
        <p className={`text-sm leading-relaxed mt-1.5 ${dark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {isRejected
            ? 'Pembayaranmu belum dapat diverifikasi admin. Silakan bayar ulang atau kirim bukti pembayaran yang valid.'
            : isExpired
            ? 'Masa aktif paket belajarmu sudah habis. Perpanjang langganan untuk membuka fitur ini lagi.'
            : 'Akunmu belum memiliki paket langganan aktif. Lakukan pembayaran atau hubungi admin untuk aktivasi.'}
        </p>
        {isRejected && rejectionReason && <RejectionReason reason={rejectionReason} dark={dark} />}
      </div>
      <div className="w-full flex flex-col gap-2 mt-1">
        <a href={SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer" className={`w-full ${BTN_PRIMARY}`}>
          {isRejected ? 'Bayar ulang' : isExpired ? 'Perpanjang langganan' : 'Langganan sekarang'}
          <ExternalIcon />
        </a>
        <div className="flex gap-2">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className={`flex-1 ${BTN_WA}`}>
            <WhatsAppIcon />
            WhatsApp Admin
          </a>
          <button
            type="button"
            onClick={checkStatus}
            disabled={checking}
            className={`flex-1 h-11 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              dark
                ? 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <RefreshIcon spinning={checking} />
            {checking ? 'Memeriksa...' : 'Cek status'}
          </button>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`w-full h-10 px-3 rounded-xl bg-transparent text-sm font-semibold border-none cursor-pointer transition-colors ${
              dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Nanti saja
          </button>
        )}
      </div>
      {message && <p className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{message}</p>}
    </div>
  )
}

/** Modal pop-up berisi SubscriptionLockCard. */
export function SubscriptionRequiredModal({
  isOpen,
  feature,
  onClose,
}: {
  isOpen: boolean
  feature: string
  onClose: () => void
}) {
  if (!isOpen) return null
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex justify-center"
          onClick={e => e.stopPropagation()}
        >
          <SubscriptionLockCard feature={feature} onClose={onClose} />
        </div>
      </div>
    </ModalPortal>
  )
}
