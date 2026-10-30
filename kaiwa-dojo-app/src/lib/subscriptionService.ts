import { AppConfig } from '../config/appConfig'

/**
 * Integrasi langganan (website pendaftaran bangunnegeri).
 * Kode referral + email dari pendaftaran langganan dipakai untuk membuat akun kaiwadojo.
 */

const API_BASE = AppConfig.api.baseUrl

/** Apakah pendaftaran wajib memakai kode langganan? (diatur di server: REQUIRE_SUBSCRIPTION) */
export async function fetchRegistrationConfig(): Promise<{ required: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/subscriptions.php?action=registration_config`)
    const json = await res.json()
    return { required: Boolean(json?.data?.required) }
  } catch {
    return { required: false }
  }
}

export interface ReferralVerification {
  valid: boolean
  message?: string
  planName?: string
}

/** Cek kode referral + email sebelum akun dibuat (server tetap memeriksa ulang saat mendaftar). */
export async function verifyReferralCode(email: string, referralCode: string): Promise<ReferralVerification> {
  try {
    const res = await fetch(`${API_BASE}/subscriptions.php?action=verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, referral_code: referralCode }),
    })
    const json = await res.json()
    if (json?.error) return { valid: false, message: json.error.message }
    return { valid: Boolean(json?.data?.valid), message: json?.data?.message, planName: json?.data?.plan_name }
  } catch {
    return { valid: false, message: 'Tidak dapat memeriksa kode referral. Periksa koneksi lalu coba lagi.' }
  }
}
