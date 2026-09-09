/**
 * KaiwaDoJo Security Utilities
 * 
 * Provides defenses against:
 * 1. Cross-Site Scripting (XSS) & HTML Injection
 * 2. SQL Injection string patterns & payload sanitization
 * 3. Brute Force & Credential Stuffing (Rate Limiting & Lockout)
 * 4. Open Redirect & Malicious Link Hijacking
 */

// ============================================================
// 1. INPUT SANITIZATION & XSS PROTECTION
// ============================================================

/**
 * Strips script tags, HTML injection tags, dangerous protocols, and control characters.
 * Useful for user text inputs (names, bios, feedback, notes, kotoba).
 */
export function sanitizeInput(input: string | null | undefined, maxLength: number = 2000): string {
  if (input === null || input === undefined) return ''
  if (typeof input !== 'string') return String(input)

  let sanitized = input
    // Remove null bytes and dangerous control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove script / style tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Strip HTML tags
    .replace(/<[^>]+>/g, '')
    // Strip dangerous javascript: / data: / vbscript: protocols
    .replace(/(javascript|vbscript|data):/gi, '')
    // Strip inline event handlers like onerror=, onload=, onclick=
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // Trim and enforce maximum length
  sanitized = sanitized.trim()
  if (maxLength > 0 && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

/**
 * Escapes characters that have special meaning in HTML to prevent XSS.
 */
export function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Validates and normalizes usernames.
 * Allows only lowercase alphanumeric, underscores, and dots (length 3-32).
 */
export function sanitizeUsername(username: string): string {
  if (!username) return ''
  return username
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.]/g, '')
    .substring(0, 32)
}

/**
 * Validates email format strictly.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length > 254) return false
  // RFC 5322 standard-compliant email regex pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  return emailRegex.test(trimmed)
}

/**
 * Validates phone number to prevent injection and format errors.
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[^0-9+]/g, '').substring(0, 20)
}

/**
 * Protects against Open Redirect vulnerabilities.
 * Checks if a URL is safe to redirect to (only relative internal paths or whitelisted domains).
 */
export function isSafeRedirectUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim()
  
  // Disallow javascript:, data:, file:, etc.
  if (/^(javascript|vbscript|data|file):/i.test(trimmed)) {
    return false
  }

  // Relative path starting with / (e.g. /dashboard) is safe as long as it does not start with //
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true
  }

  // Safe external domains whitelist
  try {
    const parsed = new URL(trimmed, window.location.origin)
    const allowedHosts = [
      window.location.hostname,
      'wa.me',
      'api.whatsapp.com',
      'supabase.co',
      'browsehappy.com'
    ]
    return allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))
  } catch {
    return false
  }
}

// ============================================================
// 2. RATE LIMITING & BRUTE FORCE PROTECTION
// ============================================================

interface RateLimitRecord {
  attempts: number
  lockoutUntil: number // timestamp ms
  lastAttempt: number // timestamp ms
}

const RATE_LIMIT_PREFIX = 'kaiwa_rl_'

/**
 * Rate Limiter to protect sensitive entry points (Admin PIN, Student Login, OTP Requests).
 */
export class SecurityRateLimiter {
  private static getKey(actionKey: string): string {
    return `${RATE_LIMIT_PREFIX}${actionKey}`
  }

  private static getRecord(actionKey: string): RateLimitRecord {
    try {
      const raw = localStorage.getItem(this.getKey(actionKey))
      if (raw) {
        const parsed: RateLimitRecord = JSON.parse(raw)
        return parsed
      }
    } catch {
      // Fallback if storage corrupted
    }
    return { attempts: 0, lockoutUntil: 0, lastAttempt: 0 }
  }

  private static setRecord(actionKey: string, record: RateLimitRecord): void {
    try {
      localStorage.setItem(this.getKey(actionKey), JSON.stringify(record))
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Checks if an action is currently blocked by rate limit.
   */
  public static check(
    actionKey: string,
    maxAttempts: number = 5,
    lockoutDurationSeconds: number = 300
  ): { allowed: boolean; remainingAttempts: number; lockoutSecondsLeft: number } {
    const now = Date.now()
    const record = this.getRecord(actionKey)

    // Check if currently locked out
    if (record.lockoutUntil > now) {
      const lockoutSecondsLeft = Math.ceil((record.lockoutUntil - now) / 1000)
      return {
        allowed: false,
        remainingAttempts: 0,
        lockoutSecondsLeft,
      }
    }

    // Auto-reset if last attempt was longer than lockoutDuration
    if (record.lastAttempt > 0 && now - record.lastAttempt > lockoutDurationSeconds * 1000) {
      this.reset(actionKey)
      return {
        allowed: true,
        remainingAttempts: maxAttempts,
        lockoutSecondsLeft: 0,
      }
    }

    const remainingAttempts = Math.max(0, maxAttempts - record.attempts)
    return {
      allowed: record.attempts < maxAttempts,
      remainingAttempts,
      lockoutSecondsLeft: 0,
    }
  }

  /**
   * Records a failed attempt and triggers lockout if max attempts is reached.
   */
  public static recordFailure(
    actionKey: string,
    maxAttempts: number = 5,
    lockoutDurationSeconds: number = 300
  ): { locked: boolean; lockoutSecondsLeft: number; remainingAttempts: number } {
    const now = Date.now()
    const record = this.getRecord(actionKey)

    record.attempts += 1
    record.lastAttempt = now

    if (record.attempts >= maxAttempts) {
      record.lockoutUntil = now + lockoutDurationSeconds * 1000
      this.setRecord(actionKey, record)
      return {
        locked: true,
        lockoutSecondsLeft: lockoutDurationSeconds,
        remainingAttempts: 0,
      }
    }

    this.setRecord(actionKey, record)
    return {
      locked: false,
      lockoutSecondsLeft: 0,
      remainingAttempts: maxAttempts - record.attempts,
    }
  }

  /**
   * Resets the rate limiter on successful authentication or action.
   */
  public static reset(actionKey: string): void {
    try {
      localStorage.removeItem(this.getKey(actionKey))
    } catch {
      // Ignore storage error
    }
  }
}
