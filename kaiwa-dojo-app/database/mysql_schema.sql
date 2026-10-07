-- Kaiwa Dojo — skema MariaDB 10.3+ (hasil konversi otomatis dari Supabase)
-- Dibuat: 2026-10-03T16:38:27.498Z
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Pengganti auth.users ─────────────────────────────────────
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `raw_user_meta_data` LONGTEXT NULL,
  `email_confirmed_at` DATETIME(3) NULL,
  `last_sign_in_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sesi login (refresh token) ───────────────────────────────
DROP TABLE IF EXISTS `auth_sessions`;
CREATE TABLE `auth_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `refresh_token_hash` CHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) NULL,
  `ip` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_sessions_token` (`refresh_token_hash`),
  KEY `auth_sessions_user` (`user_id`),
  CONSTRAINT `auth_sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Rate limit login ─────────────────────────────────────────
DROP TABLE IF EXISTS `login_attempts`;
CREATE TABLE `login_attempts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `identifier` VARCHAR(255) NOT NULL,
  `ip` VARCHAR(64) NOT NULL,
  `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `login_attempts_lookup` (`identifier`, `attempted_at`),
  KEY `login_attempts_ip` (`ip`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Log perubahan untuk realtime (polling) ───────────────────
DROP TABLE IF EXISTS `change_log`;
CREATE TABLE `change_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `table_name` VARCHAR(64) NOT NULL,
  `event` VARCHAR(10) NOT NULL,
  `new_row` LONGTEXT NULL,
  `old_row` LONGTEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `change_log_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── announcements ───────────────────────────────────────
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `content` TEXT NOT NULL,
  `category` VARCHAR(255) NOT NULL DEFAULT 'info',
  `target_audience` VARCHAR(255) NOT NULL DEFAULT 'all',
  `target_group` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `author_id` CHAR(36) NULL,
  `author_name` TEXT NOT NULL DEFAULT 'Admin Dojo',
  `action_url` TEXT NULL,
  `action_text` TEXT NULL,
  `expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_announcements_active` (`is_active`, `is_pinned`, `created_at`),
  KEY `idx_announcements_category` (`category`),
  KEY `idx_announcements_created_at` (`created_at`),
  KEY `idx_announcements_target_audience` (`target_audience`),
  CONSTRAINT `announcements_fk1` FOREIGN KEY (`author_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── broadcast_logs ──────────────────────────────────────
DROP TABLE IF EXISTS `broadcast_logs`;
CREATE TABLE `broadcast_logs` (
  `id` CHAR(36) NOT NULL,
  `sent_by_id` TEXT NOT NULL,
  `sent_by_name` TEXT NOT NULL,
  `message` TEXT NOT NULL,
  `filter_label` TEXT NOT NULL DEFAULT 'Semua Pelajar',
  `target_count` INT NOT NULL DEFAULT 0,
  `sent_count` INT NOT NULL DEFAULT 0,
  `skipped_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── chapter_settings ────────────────────────────────────
DROP TABLE IF EXISTS `chapter_settings`;
CREATE TABLE `chapter_settings` (
  `bab_number` INT NOT NULL,
  `title` TEXT NOT NULL,
  `subtitle` TEXT NOT NULL DEFAULT '',
  `is_hidden` TINYINT(1) NOT NULL DEFAULT 0,
  `has_video` TINYINT(1) NOT NULL DEFAULT 0,
  `duration_s1` TEXT NOT NULL DEFAULT '15',
  `duration_s2` TEXT NOT NULL DEFAULT '15',
  `duration_s3` TEXT NOT NULL DEFAULT '12',
  `custom_video_s1` TEXT NULL,
  `custom_video_s2` TEXT NULL,
  `custom_video_s3` TEXT NULL,
  `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `target_group` TEXT NULL,
  PRIMARY KEY (`bab_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── class_reservations ──────────────────────────────────
DROP TABLE IF EXISTS `class_reservations`;
CREATE TABLE `class_reservations` (
  `id` CHAR(36) NOT NULL,
  `schedule_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `user_name` TEXT NOT NULL,
  `user_email` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_reservations_schedule_id_user_id_key` (`schedule_id`, `user_id`),
  KEY `idx_class_reservations_schedule_id` (`schedule_id`),
  KEY `idx_class_reservations_user_id` (`user_id`),
  KEY `idx_class_reservations_user_created` (`user_id`, `created_at`),
  CONSTRAINT `class_reservations_fk1` FOREIGN KEY (`schedule_id`) REFERENCES `class_schedules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `class_reservations_fk2` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── class_schedules ─────────────────────────────────────
DROP TABLE IF EXISTS `class_schedules`;
CREATE TABLE `class_schedules` (
  `id` CHAR(36) NOT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'online',
  `title` TEXT NOT NULL,
  `subtitle_chapter` TEXT NOT NULL,
  `instructor_id` CHAR(36) NOT NULL,
  `instructor_name` TEXT NOT NULL,
  `date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `week_range_id` TEXT NOT NULL,
  `month_range_id` TEXT NOT NULL,
  `meet_url` TEXT NULL,
  `location` TEXT NULL,
  `max_quota` INT NOT NULL DEFAULT 10,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `target_group` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_class_schedules_date` (`date`),
  KEY `idx_class_schedules_start_date` (`start_date`),
  KEY `idx_class_schedules_instructor` (`instructor_id`),
  KEY `idx_class_schedules_type` (`type`),
  KEY `idx_class_schedules_created` (`created_at`),
  CONSTRAINT `class_schedules_fk1` FOREIGN KEY (`instructor_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── comments ────────────────────────────────────────────
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` CHAR(36) NOT NULL,
  `lesson_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `parent_id` CHAR(36) NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_comments_lesson` (`lesson_id`),
  CONSTRAINT `comments_fk1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_fk2` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_fk3` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── course_sections ─────────────────────────────────────
DROP TABLE IF EXISTS `course_sections`;
CREATE TABLE `course_sections` (
  `id` CHAR(36) NOT NULL,
  `course_id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `course_sections_fk1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── courses ─────────────────────────────────────────────
DROP TABLE IF EXISTS `courses`;
CREATE TABLE `courses` (
  `id` CHAR(36) NOT NULL,
  `instructor_id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `thumbnail_url` TEXT NULL,
  `level` VARCHAR(32) NOT NULL DEFAULT 'pemula',
  `language` TEXT NOT NULL DEFAULT 'Bahasa Indonesia',
  `category` TEXT NULL,
  `tags` LONGTEXT NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `total_duration_minutes` INT NOT NULL DEFAULT 0,
  `total_lessons` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `courses_slug_key` (`slug`),
  KEY `idx_courses_instructor` (`instructor_id`),
  KEY `idx_courses_published` (`is_published`),
  CONSTRAINT `courses_fk1` FOREIGN KEY (`instructor_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── daily_missions ──────────────────────────────────────
DROP TABLE IF EXISTS `daily_missions`;
CREATE TABLE `daily_missions` (
  `id` VARCHAR(255) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `selected_videos` LONGTEXT NOT NULL,
  `target_replay_count` INT NOT NULL DEFAULT 3,
  `target_quiz_count` INT NOT NULL DEFAULT 1,
  `target_kotoba_count` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `baseline_snapshot` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_missions_student_id_date_key` (`student_id`, `date`),
  KEY `idx_daily_missions_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── enrollments ─────────────────────────────────────────
DROP TABLE IF EXISTS `enrollments`;
CREATE TABLE `enrollments` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `course_id` CHAR(36) NOT NULL,
  `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  `progress_pct` DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `enrollments_student_id_course_id_key` (`student_id`, `course_id`),
  KEY `idx_enrollments_course` (`course_id`),
  KEY `idx_enrollments_student` (`student_id`),
  CONSTRAINT `enrollments_fk1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `enrollments_fk2` FOREIGN KEY (`student_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── feedback_suggestions ────────────────────────────────
DROP TABLE IF EXISTS `feedback_suggestions`;
CREATE TABLE `feedback_suggestions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `name` TEXT NOT NULL DEFAULT 'Anonim',
  `email` TEXT NULL,
  `phone_number` TEXT NULL,
  `role` TEXT NOT NULL DEFAULT 'tamu',
  `category` VARCHAR(255) NOT NULL DEFAULT 'saran_fitur',
  `rating` INT NULL DEFAULT 5,
  `title` TEXT NULL,
  `message` TEXT NOT NULL,
  `page_url` TEXT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'unread',
  `admin_notes` TEXT NULL,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_feedback_category` (`category`),
  KEY `idx_feedback_created_at` (`created_at`),
  KEY `idx_feedback_status` (`status`),
  KEY `idx_feedback_user_id` (`user_id`),
  CONSTRAINT `feedback_suggestions_fk1` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── instructor_profiles ─────────────────────────────────
DROP TABLE IF EXISTS `instructor_profiles`;
CREATE TABLE `instructor_profiles` (
  `id` CHAR(36) NOT NULL,
  `expertise` LONGTEXT NULL,
  `total_students` INT NOT NULL DEFAULT 0,
  `rating_avg` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `instructor_profiles_fk1` FOREIGN KEY (`id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── kaiwa_groups ────────────────────────────────────────
DROP TABLE IF EXISTS `kaiwa_groups`;
CREATE TABLE `kaiwa_groups` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `keywords` TEXT NULL DEFAULT '',
  `description` TEXT NULL DEFAULT '',
  `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `kaiwa_groups_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── learning_streaks ────────────────────────────────────
DROP TABLE IF EXISTS `learning_streaks`;
CREATE TABLE `learning_streaks` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `learning_streaks_student_id_date_key` (`student_id`, `date`),
  KEY `idx_learning_streaks_student` (`student_id`),
  KEY `idx_learning_streaks_date` (`date`),
  CONSTRAINT `learning_streaks_fk1` FOREIGN KEY (`student_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── lesson_kotoba ───────────────────────────────────────
DROP TABLE IF EXISTS `lesson_kotoba`;
CREATE TABLE `lesson_kotoba` (
  `id` CHAR(36) NOT NULL,
  `lesson_id` CHAR(36) NOT NULL,
  `kanji_kana` TEXT NOT NULL,
  `romaji` TEXT NULL,
  `meaning` TEXT NOT NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_lesson_kotoba_lesson_id` (`lesson_id`),
  CONSTRAINT `lesson_kotoba_fk1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── lesson_progress ─────────────────────────────────────
DROP TABLE IF EXISTS `lesson_progress`;
CREATE TABLE `lesson_progress` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `lesson_id` VARCHAR(255) NOT NULL,
  `course_id` CHAR(36) NULL,
  `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `last_watched_at` DATETIME(3) NULL,
  `watch_duration_seconds` INT NOT NULL DEFAULT 0,
  `replay_count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lesson_progress_student_id_lesson_id_key` (`student_id`, `lesson_id`),
  KEY `idx_lesson_progress_course` (`course_id`),
  KEY `idx_lesson_progress_lesson_id` (`lesson_id`),
  KEY `idx_lesson_progress_student` (`student_id`),
  KEY `idx_lesson_progress_student_id` (`student_id`),
  CONSTRAINT `lesson_progress_fk1` FOREIGN KEY (`student_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── lessons ─────────────────────────────────────────────
DROP TABLE IF EXISTS `lessons`;
CREATE TABLE `lessons` (
  `id` CHAR(36) NOT NULL,
  `section_id` CHAR(36) NOT NULL,
  `course_id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `content_type` VARCHAR(32) NOT NULL DEFAULT 'video',
  `video_provider` VARCHAR(32) NULL,
  `video_id` TEXT NULL,
  `content_body` TEXT NULL,
  `duration_minutes` INT NOT NULL DEFAULT 0,
  `order_index` INT NOT NULL DEFAULT 0,
  `is_free_preview` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_lessons_course` (`course_id`),
  KEY `idx_lessons_section` (`section_id`),
  CONSTRAINT `lessons_fk1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lessons_fk2` FOREIGN KEY (`section_id`) REFERENCES `course_sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── profiles ────────────────────────────────────────────
DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `id` CHAR(36) NOT NULL,
  `full_name` TEXT NOT NULL,
  `username` VARCHAR(255) NOT NULL,
  `avatar_url` TEXT NULL,
  `bio` TEXT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'pelajar',
  `streak_days` INT NOT NULL DEFAULT 0,
  `last_active_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `email` TEXT NULL,
  `phone_number` TEXT NULL,
  `status` TEXT NULL DEFAULT 'pending',
  `institution` TEXT NULL,
  `group_name` TEXT NULL,
  `domisili` TEXT NULL,
  `kelurahan` TEXT NULL,
  `kecamatan` TEXT NULL,
  `kabupaten` TEXT NULL,
  `current_session_id` TEXT NULL,
  `current_device_info` TEXT NULL,
  `last_session_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `profiles_username_key` (`username`),
  KEY `idx_profiles_role` (`role`),
  KEY `idx_profiles_status` (`status`(191)),
  KEY `idx_profiles_group_name` (`group_name`(191)),
  KEY `idx_profiles_last_active` (`last_active_at`),
  CONSTRAINT `profiles_fk1` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── quiz_attempts ───────────────────────────────────────
DROP TABLE IF EXISTS `quiz_attempts`;
CREATE TABLE `quiz_attempts` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `lesson_id` CHAR(36) NOT NULL,
  `answers` LONGTEXT NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `passed` TINYINT(1) NOT NULL DEFAULT 0,
  `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_quiz_attempts_student` (`student_id`),
  KEY `idx_quiz_attempts_student_lesson` (`student_id`, `lesson_id`),
  CONSTRAINT `quiz_attempts_fk1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quiz_attempts_fk2` FOREIGN KEY (`student_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── quiz_questions ──────────────────────────────────────
DROP TABLE IF EXISTS `quiz_questions`;
CREATE TABLE `quiz_questions` (
  `id` CHAR(36) NOT NULL,
  `lesson_id` CHAR(36) NOT NULL,
  `question` TEXT NOT NULL,
  `options` LONGTEXT NOT NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_quiz_questions_lesson` (`lesson_id`, `order_index`),
  CONSTRAINT `quiz_questions_fk1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ratings ─────────────────────────────────────────────
DROP TABLE IF EXISTS `ratings`;
CREATE TABLE `ratings` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `course_id` CHAR(36) NOT NULL,
  `rating` INT NOT NULL,
  `comment` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ratings_student_id_course_id_key` (`student_id`, `course_id`),
  CONSTRAINT `ratings_fk1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ratings_fk2` FOREIGN KEY (`student_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── user_announcement_reads ─────────────────────────────
DROP TABLE IF EXISTS `user_announcement_reads`;
CREATE TABLE `user_announcement_reads` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `announcement_id` CHAR(36) NOT NULL,
  `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_announcement_reads_user_id_announcement_id_key` (`user_id`, `announcement_id`),
  KEY `idx_user_announcement_reads_announcement` (`announcement_id`),
  KEY `idx_user_announcement_reads_user` (`user_id`),
  CONSTRAINT `user_announcement_reads_fk1` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_announcement_reads_fk2` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── user_kotoba_submissions ─────────────────────────────
DROP TABLE IF EXISTS `user_kotoba_submissions`;
CREATE TABLE `user_kotoba_submissions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `japanese` TEXT NOT NULL,
  `romaji` TEXT NOT NULL,
  `meaning` TEXT NOT NULL,
  `image_url` TEXT NULL,
  `is_mastered` TINYINT(1) NULL DEFAULT 0,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_user_kotoba_submissions_mastered` (`is_mastered`),
  KEY `idx_user_kotoba_submissions_user_created` (`user_id`, `created_at`),
  KEY `idx_user_kotoba_submissions_user_id` (`user_id`),
  CONSTRAINT `user_kotoba_submissions_fk1` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
