/**
 * src/config/appConfig.ts - Konfigurasi Terpusat Aplikasi Kaiwa Dojo
 * 
 * File ini adalah Single Source of Truth untuk semua konstanta, endpoint API,
 * kunci penyimpanan lokal, durasi timeout, dan nomor kontak admin.
 * Siapapun pengembang baru dapat melihat dan mengelola konfigurasi dari file ini.
 */

export const AppConfig = {
  // ── Informasi Aplikasi ──
  app: {
    name: 'KaiwaDojo',
    tagline: 'Platform Interaktif Belajar Bahasa Jepang',
    version: '1.0.0',
    websiteUrl: 'https://kaiwadojo.inaconnext.it.com',
  },

  // ── Endpoint API & Backend ──
  api: {
    // Base URL untuk REST API backend (default: '/api')
    baseUrl: (import.meta.env.VITE_API_BASE as string) || '/api',
  },

  // ── Kontak & Admin WhatsApp ──
  contacts: {
    // Nomor WhatsApp Admin utama untuk verifikasi pendaftaran & bantuan
    adminWaNumber: (import.meta.env.VITE_ADMIN_WA_NUMBER as string) || '087875018001',
    getAdminWaFormatted(): string {
      let num = this.adminWaNumber.replace(/[^0-9]/g, '')
      if (num.startsWith('0')) num = '62' + num.slice(1)
      return num
    },
  },

  // ── Sesi & Keamanan (Waktu dalam milidetik / detik) ──
  auth: {
    // Batas waktu inaktivitas sebelum logout otomatis (30 menit)
    inactivityTimeoutMs: 30 * 60 * 1000,
    // Interval heartbeat kehadiran user aktif (60 detik)
    presenceHeartbeatIntervalMs: 60 * 1000,
    // Interval polling sinkronisasi realtime (12 detik)
    realtimePollIntervalMs: 12 * 1000,
    // ID khusus akun master admin
    masterAdminId: '00000000-0000-0000-0000-000000000099',
  },

  // ── Kunci Penyimpanan Browser (Storage Keys) ──
  storageKeys: {
    jwtSession: 'kaiwa_jwt_session',
    activeSession: 'kaiwa_session_active',
    customProfile: 'kaiwa_custom_profile',
    lastActivity: 'kaiwa_last_activity_timestamp',
    lastPresenceHeartbeat: 'kaiwa_last_presence_heartbeat',
    sessionExpiredReason: 'kaiwa_session_expired_reason',
    theme: 'kaiwa_theme',
    textSize: 'kaiwa_text_size',
  },

  // ── Pengaturan Modul & Video Kursus ──
  course: {
    // Bab 1–25 masuk ke Jilid 1, Bab 26+ masuk ke Jilid 2
    jilid1MaxBab: 25,
    jilid1Path: '/kaiwa-1-courses',
    jilid2Path: '/kaiwa-2-courses',
  },
} as const
