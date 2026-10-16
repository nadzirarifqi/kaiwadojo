-- ==============================================================================
-- Kaiwa Dojo — Skrip Optimasi Indeks & Kolom Database MariaDB
-- Target Database : kaiw_database
-- Dibuat untuk mempercepat kecepatan read (jadwal, agenda, profil, kuis, progress)
-- Aman dijalankan berkali-kali (idempotent dengan IF NOT EXISTS) di MariaDB/CyberPanel
-- ==============================================================================

USE `kaiw_database`;
SET NAMES utf8mb4;

-- 0. Tambah kolom alamat pada tabel profiles (jika belum ada)
ALTER TABLE `kaiw_database`.`profiles`
  ADD COLUMN IF NOT EXISTS `domisili` TEXT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `kelurahan` TEXT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `kecamatan` TEXT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `kabupaten` TEXT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `referral_code` VARCHAR(32) NULL DEFAULT NULL;

-- 0.1 Perbaiki tipe kolom image_url & avatar_url agar mampu menampung gambar base64 foto kamera HP (mencegah error "1406 Data too long")
ALTER TABLE `kaiw_database`.`user_kotoba_submissions`
  MODIFY COLUMN `image_url` LONGTEXT NULL;

ALTER TABLE `kaiw_database`.`profiles`
  MODIFY COLUMN `avatar_url` LONGTEXT NULL;

-- 1. Optimasi tabel jadwal kelas (class_schedules)
CREATE INDEX IF NOT EXISTS `idx_class_schedules_date` ON `kaiw_database`.`class_schedules` (`date`);
CREATE INDEX IF NOT EXISTS `idx_class_schedules_start_date` ON `kaiw_database`.`class_schedules` (`start_date`);
CREATE INDEX IF NOT EXISTS `idx_class_schedules_instructor` ON `kaiw_database`.`class_schedules` (`instructor_id`);
CREATE INDEX IF NOT EXISTS `idx_class_schedules_type` ON `kaiw_database`.`class_schedules` (`type`);
CREATE INDEX IF NOT EXISTS `idx_class_schedules_created` ON `kaiw_database`.`class_schedules` (`created_at`);

-- 2. Optimasi tabel reservasi kelas (class_reservations)
CREATE INDEX IF NOT EXISTS `idx_class_reservations_user_created` ON `kaiw_database`.`class_reservations` (`user_id`, `created_at`);

-- 3. Optimasi tabel misi harian (daily_missions)
CREATE INDEX IF NOT EXISTS `idx_daily_missions_date` ON `kaiw_database`.`daily_missions` (`date`);

-- 4. Optimasi tabel streak belajar (learning_streaks)
CREATE INDEX IF NOT EXISTS `idx_learning_streaks_date` ON `kaiw_database`.`learning_streaks` (`date`);

-- 5. Optimasi tabel progress materi (lesson_progress)
CREATE INDEX IF NOT EXISTS `idx_lesson_progress_student_completed` ON `kaiw_database`.`lesson_progress` (`student_id`, `is_completed`);

-- 6. Optimasi tabel profil pengguna (profiles)
CREATE INDEX IF NOT EXISTS `idx_profiles_role` ON `kaiw_database`.`profiles` (`role`);
CREATE INDEX IF NOT EXISTS `idx_profiles_status` ON `kaiw_database`.`profiles` (`status`(191));
CREATE INDEX IF NOT EXISTS `idx_profiles_group_name` ON `kaiw_database`.`profiles` (`group_name`(191));
CREATE INDEX IF NOT EXISTS `idx_profiles_last_active` ON `kaiw_database`.`profiles` (`last_active_at`);

-- 7. Optimasi kuis & pertanyaan (quiz_attempts & quiz_questions)
CREATE INDEX IF NOT EXISTS `idx_quiz_attempts_student` ON `kaiw_database`.`quiz_attempts` (`student_id`);
CREATE INDEX IF NOT EXISTS `idx_quiz_attempts_student_lesson` ON `kaiw_database`.`quiz_attempts` (`student_id`, `lesson_id`);
CREATE INDEX IF NOT EXISTS `idx_quiz_questions_lesson` ON `kaiw_database`.`quiz_questions` (`lesson_id`, `order_index`);

-- 8. Optimasi log perubahan realtime (change_log)
CREATE INDEX IF NOT EXISTS `idx_change_log_id_created` ON `kaiw_database`.`change_log` (`id`, `created_at`);

-- 9. Optimasi komentar materi (comments)
CREATE INDEX IF NOT EXISTS `idx_comments_lesson_created` ON `kaiw_database`.`comments` (`lesson_id`, `created_at`);

-- 10. Optimasi tabel setoran kosakata (user_kotoba_submissions)
CREATE INDEX IF NOT EXISTS `idx_user_kotoba_submissions_user_created` ON `kaiw_database`.`user_kotoba_submissions` (`user_id`, `created_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_user_kotoba_submissions_user_id` ON `kaiw_database`.`user_kotoba_submissions` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_user_kotoba_submissions_mastered` ON `kaiw_database`.`user_kotoba_submissions` (`is_mastered`);
CREATE INDEX IF NOT EXISTS `idx_user_kotoba_submissions_user_mastered` ON `kaiw_database`.`user_kotoba_submissions` (`user_id`, `is_mastered`);
