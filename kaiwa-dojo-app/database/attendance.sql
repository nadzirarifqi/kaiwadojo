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
  PRIMARY KEY (`user_id`, `login_date`),
  KEY `idx_daily_logins_date` (`login_date`),
  CONSTRAINT `student_daily_logins_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Isi riwayat lama (sekali saja) dari sesi login yang masih tersimpan & aktivitas terakhir
INSERT INTO student_daily_logins (user_id, login_date, first_seen_at, last_seen_at, sign_in_count)
SELECT s.user_id, DATE(s.created_at), MIN(s.created_at), MAX(s.created_at), 0
FROM auth_sessions s JOIN users u ON u.id = s.user_id
GROUP BY s.user_id, DATE(s.created_at)
ON DUPLICATE KEY UPDATE first_seen_at = LEAST(first_seen_at, VALUES(first_seen_at)), last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at));

INSERT INTO student_daily_logins (user_id, login_date, first_seen_at, last_seen_at, sign_in_count)
SELECT id, DATE(last_sign_in_at), last_sign_in_at, last_sign_in_at, 1
FROM users WHERE last_sign_in_at IS NOT NULL
ON DUPLICATE KEY UPDATE first_seen_at = LEAST(first_seen_at, VALUES(first_seen_at)), last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at));

INSERT INTO student_daily_logins (user_id, login_date, first_seen_at, last_seen_at, sign_in_count)
SELECT p.id, DATE(p.last_active_at), p.last_active_at, p.last_active_at, 0
FROM profiles p JOIN users u ON u.id = p.id
WHERE p.last_active_at IS NOT NULL
ON DUPLICATE KEY UPDATE first_seen_at = LEAST(first_seen_at, VALUES(first_seen_at)), last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at));
