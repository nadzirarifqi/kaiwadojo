import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getSubscriptionAccess } from '../lib/subscriptionAccess'
import ModalPortal from './ModalPortal'

const ADMIN_WA = '087875018001'
const SUBSCRIBE_URL = 'https://bangunnegeri.inaconnext.it.com'

/**
 * Isi panel "fitur terkunci" untuk pelajar yang belum bayar / langganan habis.
 * Dipakai di area pemutar video (MyCourses) dan modal tambah kotoba (SetoranKotoba).
 */
export function SubscriptionLockCard({ feature, onClose }: { feature: string; onClose?: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const { isExpired } = getSubscriptionAccess(profile)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const waText = encodeURIComponent(
    `Halo Admin Kaiwa Dojo, saya ingin konfirmasi pembayaran langganan akun saya.\n\n` +
    `Nama: ${profile?.full_name || '-'}\n` +
    `Username: ${profile?.username || '-'}\n` +
    `Email: ${profile?.email || '-'}\n` +
    `Status Saat Ini: ${isExpired ? 'Masa Langganan Berakhir' : 'Belum Bayar'}`
  )
  const waUrl = `https://wa.me/62${ADMIN_WA.replace(/^0/, '')}?text=${waText}`

  async function handleCheck() {
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

  return (
    <div className="w-full max-w-md text-center text-white flex flex-col items-center gap-3 px-5 py-8">
      <div className="size-14 shrink-0 rounded-2xl bg-rose-500/15 text-rose-300 flex items-center justify-center">
        <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300">
        {isExpired ? 'Masa langganan berakhir' : 'Langganan diperlukan'}
      </span>
      <div>
        <h3 className="text-lg font-bold leading-snug">{feature} terkunci</h3>
        <p className="text-sm text-slate-400 leading-relaxed mt-1.5">
          {isExpired
            ? 'Masa aktif paket belajarmu sudah habis. Perpanjang langganan untuk membuka fitur ini lagi.'
            : 'Akunmu belum memiliki paket langganan aktif. Lakukan pembayaran atau hubungi admin untuk aktivasi.'}
        </p>
      </div>
      <div className="w-full flex flex-col gap-2 mt-1">
        <a
          href={SUBSCRIBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold text-sm no-underline transition-colors"
        >
          Langganan Sekarang
        </a>
        <div className="flex gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-xs no-underline transition-colors"
          >
            WhatsApp Admin
          </a>
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs border-none cursor-pointer transition-colors disabled:opacity-50"
          >
            {checking ? 'Memeriksa...' : 'Cek Ulang Status'}
          </button>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-2 rounded-xl bg-transparent text-slate-400 hover:text-slate-200 text-xs font-semibold border-none cursor-pointer"
          >
            Nanti saja
          </button>
        )}
      </div>
      {message && <p className="text-xs font-semibold text-emerald-400">{message}</p>}
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
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex justify-center"
          onClick={e => e.stopPropagation()}
        >
          <SubscriptionLockCard feature={feature} onClose={onClose} />
        </div>
      </div>
    </ModalPortal>
  )
}
