/**
 * Service khusus pengiriman Kode OTP 6-Digit via WhatsApp API (Fonnte Gateway).
 * 
 * Fonnte (fonnte.com) adalah penyedia WhatsApp Gateway populer & murah di Indonesia.
 */

export interface SendWhatsAppOtpParams {
  phoneNumber: string
  otpCode: string
}

export async function sendWhatsAppOtp({ phoneNumber, otpCode }: SendWhatsAppOtpParams): Promise<boolean> {
  const fonnteToken = import.meta.env.VITE_FONNTE_TOKEN || 'zhrUJEgA6bNS8EH3P2bb'

  // Format nomor HP agar standar (misal 081234... -> 6281234...)
  let formattedPhone = phoneNumber.replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1)
  }

  const messageText = `[KaiwaDojo] Kode OTP Pendaftaran Akun Anda adalah: ${otpCode}\n\nMasukkan kode ini pada aplikasi KaiwaDojo untuk memverifikasi pendaftaran. Jangan berikan kode ini kepada siapapun.`

  if (!fonnteToken) {
    console.warn(
      `[SIMULASI WA] Token Fonnte belum diset. OTP ${otpCode} terkirim (simulasi) ke WhatsApp: ${formattedPhone}`
    )
    return true
  }

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
      console.log('OTP WhatsApp berhasil terkirim via Fonnte ke:', formattedPhone)
      return true
    } else {
      console.warn('Fonnte API response note:', data.reason || data)
      return false
    }
  } catch (err) {
    console.error('Error sending WA OTP via Fonnte:', err)
    return false
  }
}

export interface SendWhatsAppApprovalParams {
  phoneNumber: string
  fullName: string
  username: string
}

export async function sendWhatsAppApprovalNotice({ phoneNumber, fullName, username }: SendWhatsAppApprovalParams): Promise<boolean> {
  const fonnteToken = import.meta.env.VITE_FONNTE_TOKEN || 'zhrUJEgA6bNS8EH3P2bb'

  let formattedPhone = (phoneNumber || '').replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1)
  }

  if (!formattedPhone || formattedPhone.length < 9) {
    console.warn('Nomor WhatsApp tidak valid untuk pengiriman notifikasi persetujuan:', phoneNumber)
    return false
  }

  const messageText = `🎉 *BERHASIL! AKUN KAIWADOJO ANDA TELAH DISETUJUI ADMIN*\n\nHalo *${fullName}*,\n\nPendaftaran akun KaiwaDojo Anda telah diverifikasi dan *disetujui oleh Admin*.\n\nDetail Login Anda:\n• Username: *@${username}*\n• Website: https://kaiwadojo.inaconnext.it.com/login\n\nSilakan masuk ke Dashboard dan mulai petualangan belajar Bahasa Jepang Anda sekarang! 🚀`

  if (!fonnteToken) {
    console.warn(`[SIMULASI WA] Notifikasi persetujuan terkirim (simulasi) ke WA: ${formattedPhone}`)
    return true
  }

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
  const fonnteToken = import.meta.env.VITE_FONNTE_TOKEN || 'zhrUJEgA6bNS8EH3P2bb'

  let formattedPhone = (phoneNumber || '').replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1)
  }

  if (!formattedPhone || formattedPhone.length < 9) {
    return { isValid: false, message: 'Nomor WhatsApp minimal 9 digit angka (contoh: 081234567890).' }
  }

  if (!fonnteToken) {
    return { isValid: true }
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

