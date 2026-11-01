import type { Profile } from '../hooks/useAuth'

export interface SubscriptionAccess {
  /** true = fitur berbayar (video materi, setoran kotoba) dikunci */
  isLocked: boolean
  /** true = pernah berlangganan tapi masa aktifnya sudah habis */
  isExpired: boolean
  /** true = admin menolak pembayaran (bukti tidak valid); alasannya di `rejectionReason` */
  isRejected: boolean
  rejectionReason: string | null
}

/**
 * Status akses langganan. Hanya pelajar yang dibatasi; admin & pemateri selalu bebas.
 * Pelajar yang belum bayar tetap boleh masuk dashboard, tapi fitur berbayar dikunci.
 */
export function getSubscriptionAccess(profile: Profile | null | undefined): SubscriptionAccess {
  if (!profile || profile.role !== 'pelajar') {
    return { isLocked: false, isExpired: false, isRejected: false, rejectionReason: null }
  }
  const isPastEnd = profile.subscription_ends_at
    ? new Date(profile.subscription_ends_at.replace(' ', 'T')).getTime() < Date.now()
    : false
  const isExpired = isPastEnd || profile.payment_status === 'expired'
  const isLocked = profile.payment_status !== 'paid' || isPastEnd
  const isRejected = profile.payment_status === 'rejected'
  return { isLocked, isExpired, isRejected, rejectionReason: isRejected ? profile.payment_note || null : null }
}
