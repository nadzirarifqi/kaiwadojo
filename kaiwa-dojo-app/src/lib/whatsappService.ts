/**
 * Service khusus pengiriman Kode OTP 6-Digit via WhatsApp API (Fonnte Gateway).
 * 
 * Fonnte (fonnte.com) adalah penyedia WhatsApp Gateway di Indonesia.
 */

import { supabase } from './supabaseClient'


/**
 * Token Fonnte Terpusat (Single Source of Truth)
 */
export const DEFAULT_FONNTE_TOKEN = 'zhrUJEgA6bNS8EH3P2bb'

export function getFonnteToken(): string {
  const envToken = import.meta.env.VITE_FONNTE_TOKEN
  if (envToken && typeof envToken === 'string' && envToken.trim().length > 0) {
    return envToken.trim()
  }
  return DEFAULT_FONNTE_TOKEN
}

export interface SendWhatsAppOtpParams {
  phoneNumber: string
  otpCode: string
}

export async function sendWhatsAppOtp({ phoneNumber, otpCode }: SendWhatsAppOtpParams): Promise<{ success: boolean; reason?: string }> {
  const fonnteToken = getFonnteToken()

  // Format nomor HP agar standar (misal 081234... -> 6281234...)
  let formattedPhone = phoneNumber.replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1)
  }

  const messageText = `[KaiwaDojo] Kode OTP Pendaftaran Akun Anda adalah: ${otpCode}\n\nMasukkan kode ini pada aplikasi KaiwaDojo untuk memverifikasi pendaftaran. Jangan berikan kode ini kepada siapapun.`

  try {
    const formData = new FormData()
    formData.append('target', formattedPhone)
    formData.append('message', messageText)
    formData.append('countryCode', '62')

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken,
      },
      body: formData,
    })

    const data = await res.json()

    if (data.status) {
      console.log('OTP WhatsApp berhasil terkirim via Fonnte ke:', formattedPhone, 'menggunakan token:', `${fonnteToken.slice(0, 6)}...`)
      return { success: true }
    } else {
      console.warn('Fonnte API response note:', data.reason || data)
      return { success: false, reason: data.reason || 'Perangkat Fonnte tidak terhubung/offline.' }
    }
  } catch (err: any) {
    console.error('Error sending WA OTP via Fonnte:', err)
    return { success: false, reason: err?.message || 'Gagal terhubung ke server Fonnte.' }
  }
}

export interface SendWhatsAppApprovalParams {
  phoneNumber: string
  fullName: string
  username: string
}

export async function sendWhatsAppApprovalNotice({ phoneNumber, fullName, username }: SendWhatsAppApprovalParams): Promise<boolean> {
  const fonnteToken = getFonnteToken()

  let formattedPhone = (phoneNumber || '').replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1)
  }

  if (!formattedPhone || formattedPhone.length < 9) {
    console.warn('Nomor WhatsApp tidak valid untuk pengiriman notifikasi persetujuan:', phoneNumber)
    return false
  }

  const messageText = `🎉 *BERHASIL! AKUN KAIWADOJO ANDA TELAH DISETUJUI ADMIN*\n\nHalo *${fullName}*,\n\nPendaftaran akun KaiwaDojo Anda telah diverifikasi dan *disetujui oleh Admin*.\n\nDetail Login Anda:\n• Username: *@${username}*\n• Website: https://kaiwadojo.inaconnext.it.com/login\n\nSilakan masuk ke Dashboard dan mulai petualangan belajar Bahasa Jepang Anda sekarang! 🚀`

  try {
    const formData = new FormData()
    formData.append('target', formattedPhone)
    formData.append('message', messageText)

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken,
      },
      body: formData,
    })

    const data = await res.json()
    if (data.status) {
      console.log('Notifikasi WA persetujuan berhasil terkirim ke:', formattedPhone)
      return true
    } else {
      console.warn('Fonnte API WA approval note:', data.reason || data)
      return false
    }
  } catch (err) {
    console.error('Error sending WA approval notice:', err)
    return false
  }
}

/**
 * Memeriksa apakah nomor telepon terdaftar & aktif di WhatsApp via Fonnte API /validate
 */
export async function validateWhatsAppNumber(phoneNumber: string): Promise<{ isValid: boolean; message?: string }> {
  const fonnteToken = getFonnteToken()

  let formattedPhone = (phoneNumber || '').replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1)
  }

  if (!formattedPhone || formattedPhone.length < 9) {
    return { isValid: false, message: 'Nomor WhatsApp minimal 9 digit angka (contoh: 081234567890).' }
  }

  try {
    const formData = new FormData()
    formData.append('target', formattedPhone)

    const res = await fetch('https://api.fonnte.com/validate', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken,
      },
      body: formData,
    })

    const data = await res.json()

    if (data.status && data.registered && Array.isArray(data.registered) && data.registered.length > 0) {
      return { isValid: true }
    } else if (data.not_registered && Array.isArray(data.not_registered) && data.not_registered.length > 0) {
      return { isValid: false, message: `Nomor (${phoneNumber}) tidak terdaftar di WhatsApp! Mohon gunakan nomor WhatsApp aktif.` }
    }

    return { isValid: true }
  } catch (err) {
    console.error('Error validating WA number via Fonnte:', err)
    return { isValid: true }
  }
}

/**
 * Menghasilkan URL direct link WhatsApp ke Admin dengan pre-filled text pendaftaran
 */
export function getAdminWhatsAppUrl(username: string): string {
  const adminWa = import.meta.env.VITE_ADMIN_WA_NUMBER || '087875018001'
  let formatted = adminWa.replace(/[^0-9]/g, '')
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.slice(1)
  }
  const cleanUser = (username || '').replace(/^@/, '')
  const messageText = `Halo Admin KaiwaDojo, akun saya @${cleanUser} sudah registrasi.`
  return `https://wa.me/${formatted}?text=${encodeURIComponent(messageText)}`
}

/**
 * Menghasilkan URL direct link WhatsApp ke Admin untuk pengajuan hapus akun
 */
export function getAdminWhatsAppDeleteAccountUrl(username?: string, fullName?: string, email?: string): string {
  const adminWa = import.meta.env.VITE_ADMIN_WA_NUMBER || '087875018001'
  let formatted = adminWa.replace(/[^0-9]/g, '')
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.slice(1)
  }
  const cleanUser = (username || '').replace(/^@/, '')
  const nameStr = fullName ? ` (${fullName})` : ''
  const emailStr = email ? `\n• Email: ${email}` : ''
  const messageText = `Halo Admin KaiwaDojo, saya ingin mengajukan permohonan penghapusan akun saya:\n• Username: @${cleanUser}${nameStr}${emailStr}\n\nMohon bantuannya untuk memproses konfirmasi dan penghapusan akun saya dari sistem KaiwaDojo. Terima kasih.`
  return `https://wa.me/${formatted}?text=${encodeURIComponent(messageText)}`
}
/**
 * ─── BROADCAST WHATSAPP ─────────────────────────────────────────────────────
 * Kirim pesan massal dari Admin ke banyak nomor sekaligus via Fonnte API.
 */

export interface BroadcastTarget {
  id: string
  full_name: string
  phone_number?: string
}

export interface BroadcastResult {
  totalTargets: number
  sent: number
  skipped: number   // tidak punya nomor WA
  failed: number
  failReason?: string
}

export interface BroadcastLog {
  id: string
  sent_by_id: string
  sent_by_name: string
  message: string
  filter_label: string
  target_count: number
  sent_count: number
  skipped_count: number
  failed_count: number
  created_at: string
}

/**
 * Kirim pesan WA ke banyak nomor sekaligus.
 * Fonnte mendukung multi-target dengan format: "62812xxx,62813xxx,62814xxx"
 */
export async function sendWhatsAppBroadcast(
  targets: BroadcastTarget[],
  message: string
): Promise<BroadcastResult> {
  const fonnteToken = getFonnteToken()

  const skippedTargets = targets.filter(t => !t.phone_number || t.phone_number.trim().length < 8)
  const validTargets = targets.filter(t => t.phone_number && t.phone_number.trim().length >= 8)

  if (validTargets.length === 0) {
    return {
      totalTargets: targets.length,
      sent: 0,
      skipped: skippedTargets.length,
      failed: 0,
      failReason: 'Tidak ada target dengan nomor WhatsApp valid.',
    }
  }

  // Format semua nomor ke standar 62xxx
  const formattedNumbers = validTargets.map(t => {
    let num = (t.phone_number || '').replace(/[^0-9]/g, '')
    if (num.startsWith('0')) num = '62' + num.slice(1)
    return num
  })

  // Fonnte multi-target: koma-separated
  const multiTarget = formattedNumbers.join(',')

  try {
    const formData = new FormData()
    formData.append('target', multiTarget)
    formData.append('message', message)
    formData.append('countryCode', '62')

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': fonnteToken },
      body: formData,
    })

    const data = await res.json()

    if (data.status) {
      console.log(`[Broadcast WA] Terkirim ke ${validTargets.length} target via Fonnte.`)
      return {
        totalTargets: targets.length,
        sent: validTargets.length,
        skipped: skippedTargets.length,
        failed: 0,
      }
    } else {
      console.warn('[Broadcast WA] Fonnte response note:', data.reason || data)
      return {
        totalTargets: targets.length,
        sent: 0,
        skipped: skippedTargets.length,
        failed: validTargets.length,
        failReason: data.reason || 'Perangkat Fonnte tidak terhubung / offline.',
      }
    }
  } catch (err: any) {
    console.error('[Broadcast WA] Error:', err)
    return {
      totalTargets: targets.length,
      sent: 0,
      skipped: skippedTargets.length,
      failed: validTargets.length,
      failReason: err?.message || 'Gagal terhubung ke server Fonnte.',
    }
  }
}

/**
 * Simpan log broadcast ke tabel Supabase broadcast_logs
 */
export async function saveBroadcastLog(params: {
  sentById: string
  sentByName: string
  message: string
  filterLabel: string
  result: BroadcastResult
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('broadcast_logs').insert({
      sent_by_id: params.sentById,
      sent_by_name: params.sentByName,
      message: params.message,
      filter_label: params.filterLabel,
      target_count: params.result.totalTargets,
      sent_count: params.result.sent,
      skipped_count: params.result.skipped,
      failed_count: params.result.failed,
    })

    if (error) {
      console.warn('[Broadcast WA] Gagal simpan log:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[Broadcast WA] saveBroadcastLog catch:', e)
    return false
  }
}

/**
 * Ambil riwayat broadcast dari Supabase
 */
export async function fetchBroadcastLogs(limit = 10): Promise<BroadcastLog[]> {
  try {
    const { data, error } = await supabase
      .from('broadcast_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[Broadcast WA] fetchBroadcastLogs error:', error.message)
      return []
    }
    return (data || []) as BroadcastLog[]
  } catch (e) {
    console.warn('[Broadcast WA] fetchBroadcastLogs catch:', e)
    return []
  }
}
