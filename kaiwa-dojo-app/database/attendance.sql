-- Kaiwa Dojo — log kehadiran harian (rekap kehadiran berdasarkan login)
-- Tabel ini juga dibuat otomatis oleh api/lib/db.php (ensureAttendanceSchema).
-- Jalankan file ini manual hanya jika user database tidak punya hak CREATE.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `student_daily_logins` (
  `user_id` CHAR(36) NOT NULL,
  `login_date` DATE NOT NULL,                 -- tanggal (zona waktu ATTENDANCE_TIMEZONE, default Asia/Jakarta)
  `first_seen_at` DATETIME(3) NOT NULL,       -- pertama login / membuka aplikasi hari itu = jam hadir
  `last_seen_at` DATETIME(3) NOT NULL,        -- terakhir terlihat aktif hari itu
  `sign_in_count` INT NOT NULL DEFAULT 0,     -- jumlah login dengan password hari itu
  `active_minutes` INT NOT NULL DEFAULT 0,    -- total menit aktif hari itu (diakumulasi setiap heartbeat ~10 menit)
  PRIMARY KEY (`user_id`, `login_date`),
  KEY `idx_daily_logins_date` (`login_date`),
  CONSTRAINT `student_daily_logins_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Riwayat sebelum tabel ini dibuat dibaca langsung dari jejak aktivitas lain saat rekap
-- (auth_sessions, setoran kotoba, kuis, reservasi, rencana harian, video) — tidak perlu backfill.
