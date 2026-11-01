import type { Profile } from '../hooks/useAuth'

export interface SubscriptionAccess {
  /** true = fitur berbayar (video materi, setoran kotoba) dikunci */
  isLocked: boolean
  /** true = pernah berlangganan tapi masa aktifnya sudah habis */
  isExpired: boolean
}

/**
 * Status akses langganan. Hanya pelajar yang dibatasi; admin & pemateri selalu bebas.
 * Pelajar yang belum bayar tetap boleh masuk dashboard, tapi fitur berbayar dikunci.
 */
export function getSubscriptionAccess(profile: Profile | null | undefined): SubscriptionAccess {
  if (!profile || profile.role !== 'pelajar') {
    return { isLocked: false, isExpired: false }
  }
  const isPastEnd = profile.subscription_ends_at
    ? new Date(profile.subscription_ends_at.replace(' ', 'T')).getTime() < Date.now()
    : false
  const isExpired = isPastEnd || profile.payment_status === 'expired'
  const isLocked = profile.payment_status !== 'paid' || isPastEnd
  return { isLocked, isExpired }
}
