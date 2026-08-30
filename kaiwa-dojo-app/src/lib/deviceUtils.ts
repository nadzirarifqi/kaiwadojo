import { supabase } from './supabaseClient'

const CLIENT_SESSION_ID_KEY = 'kaiwa_client_session_id'

/**
 * Detect human-friendly device & browser name
 */
export function getDeviceInfo(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'Perangkat Web'
  }

  const ua = navigator.userAgent || ''
  
  // OS Detection
  let os = 'Perangkat'
  if (/windows nt 10\.0/i.test(ua)) os = 'Windows 10/11'
  else if (/windows/i.test(ua)) os = 'Windows PC'
  else if (/iphone/i.test(ua)) os = 'iPhone'
  else if (/ipad/i.test(ua)) os = 'iPad'
  else if (/macintosh|mac os x/i.test(ua)) os = 'Mac'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/linux/i.test(ua)) os = 'Linux PC'

  // Browser Detection
  let browser = 'Browser'
  if (/edg/i.test(ua)) browser = 'Microsoft Edge'
  else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) browser = 'Chrome'
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'
  else if (/opr|opera/i.test(ua)) browser = 'Opera'

  return `${os} • ${browser}`
}

/**
 * Get or create a unique session ID for this browser tab/instance
 */
export function getOrCreateClientSessionId(): string {
  if (typeof window === 'undefined') return 'server_session'
  
  let sessId = sessionStorage.getItem(CLIENT_SESSION_ID_KEY)
  if (!sessId) {
    sessId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
    sessionStorage.setItem(CLIENT_SESSION_ID_KEY, sessId)
  }
  return sessId
}

/**
 * Set a new fresh client session ID
 */
export function generateNewClientSessionId(): string {
  const sessId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(CLIENT_SESSION_ID_KEY, sessId)
  }
  return sessId
}

/**
 * Clear client session ID from storage
 */
export function clearClientSessionId(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(CLIENT_SESSION_ID_KEY)
  }
}

/**
 * Claim and register this device's session in Supabase profiles
 */
export async function claimDeviceSession(userId: string): Promise<{ sessionId: string; deviceInfo: string }> {
  const sessionId = getOrCreateClientSessionId()
  const deviceInfo = getDeviceInfo()

  try {
    await supabase
      .from('profiles')
      .update({
        current_session_id: sessionId,
        current_device_info: deviceInfo,
        last_session_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      })
      .eq('id', userId)
  } catch (e) {
    console.warn('Claim device session note:', e)
  }

  return { sessionId, deviceInfo }
}
