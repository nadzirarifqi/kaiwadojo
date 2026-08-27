export interface UserPresence {
  isOnline: boolean
  label: string
  relativeTime: string
  lastActiveDate: Date | null
}

/**
 * Menghitung status presence pengguna (Online / Offline)
 * Jika pengguna memiliki aktivitas dalam 5 menit terakhir, dianggap Online.
 * Jika lebih dari 5 menit, dianggap Offline dan ditampilkan waktu relatif terakhir aktif.
 */
export function calculateUserPresence(lastActiveAt: string | null | undefined): UserPresence {
  if (!lastActiveAt) {
    return {
      isOnline: false,
      label: 'Offline',
      relativeTime: 'Belum pernah online',
      lastActiveDate: null,
    }
  }

  const now = Date.now()
  const activeTime = new Date(lastActiveAt).getTime()
  if (isNaN(activeTime)) {
    return {
      isOnline: false,
      label: 'Offline',
      relativeTime: 'Tidak diketahui',
      lastActiveDate: null,
    }
  }

  const diffMs = now - activeTime
  // Batas toleransi online: 5 menit (300.000 ms)
  const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

  if (diffMs <= ONLINE_THRESHOLD_MS && diffMs >= -60000) {
    return {
      isOnline: true,
      label: 'Online',
      relativeTime: 'Sedang aktif sekarang',
      lastActiveDate: new Date(activeTime),
    }
  }

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  let relative = ''
  if (diffMin < 60) {
    relative = `${Math.max(1, diffMin)} menit lalu`
  } else if (diffHour < 24) {
    relative = `${diffHour} jam lalu`
  } else if (diffDay === 1) {
    const timeStr = new Date(activeTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    relative = `Kemarin ${timeStr}`
  } else if (diffDay < 7) {
    relative = `${diffDay} hari lalu`
  } else {
    relative = new Date(activeTime).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return {
    isOnline: false,
    label: 'Offline',
    relativeTime: `${relative}`,
    lastActiveDate: new Date(activeTime),
  }
}
