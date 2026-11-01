-- Kaiwa Dojo — integrasi langganan (website pendaftaran bangunnegeri)
-- Tabel & kolom ini juga dibuat otomatis oleh api/lib/db.php (ensureSubscriptionSchema).
-- Jalankan file ini manual hanya jika user database tidak punya hak CREATE / ALTER.
SET NAMES utf8mb4;

-- ── Paket langganan (dikelola kaiwadojo, dibaca website pendaftaran) ──
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `code` VARCHAR(64) NOT NULL,                 -- kode paket, dipakai website pendaftaran (plan_code)
  `name` VARCHAR(255) NOT NULL,                -- nama tampil
  `description` TEXT NULL,
  `group_name` VARCHAR(255) NULL,              -- grup kaiwa_groups yang didapat pelanggan → menentukan akses bab & kelas
  `duration_days` INT NULL,                    -- dipakai bila website pendaftaran tidak mengirim ends_at
  `price` DECIMAL(12,2) NULL DEFAULT 0,        -- harga paket dalam rupiah (IDR)
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Langganan yang dikirim website pendaftaran ──
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` CHAR(36) NOT NULL,
  `external_id` VARCHAR(100) NOT NULL,         -- ID order/transaksi di website pendaftaran (unik)
  `referral_code` VARCHAR(32) NOT NULL,        -- kode yang dipakai pelanggan saat mendaftar di kaiwadojo
  `email` VARCHAR(255) NOT NULL,               -- harus sama dengan email saat mendaftar
  `full_name` VARCHAR(255) NULL,
  `phone_number` VARCHAR(32) NULL,
  `plan_code` VARCHAR(64) NOT NULL,
  `payment_status` VARCHAR(16) NOT NULL DEFAULT 'pending',  -- paid / pending / unpaid / rejected / cancelled / refunded / expired
  `starts_at` DATETIME NULL,
  `ends_at` DATETIME NULL,
  `user_id` CHAR(36) NULL,                     -- terisi setelah pelanggan mendaftar akun kaiwadojo
  `registered_at` DATETIME(3) NULL,
  `source` VARCHAR(64) NOT NULL DEFAULT 'bangunnegeri',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscriptions_external_id` (`external_id`),
  UNIQUE KEY `subscriptions_referral_code` (`referral_code`),
  KEY `subscriptions_email` (`email`),
  KEY `subscriptions_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Kolom tambahan di profiles ──
-- plan_code            : paket langganan aktif pelajar
-- payment_status       : status pembayaran ('paid', 'unpaid', 'pending', 'rejected', 'expired')
-- payment_note         : alasan admin menolak pembayaran (bukti tidak valid, nominal salah, dll.)
-- subscription_ends_at : tanggal kedaluwarsa masa aktif langganan
-- access_level         : 'full' (akses penuh) / 'view_only' (langganan habis — diubah manual admin)
ALTER TABLE `profiles` ADD COLUMN IF NOT EXISTS `plan_code` VARCHAR(64) NULL DEFAULT NULL;
ALTER TABLE `profiles` ADD COLUMN IF NOT EXISTS `payment_status` VARCHAR(32) NOT NULL DEFAULT 'unpaid';
ALTER TABLE `profiles` ADD COLUMN IF NOT EXISTS `subscription_ends_at` DATETIME NULL DEFAULT NULL;
ALTER TABLE `profiles` ADD COLUMN IF NOT EXISTS `access_level` VARCHAR(16) NOT NULL DEFAULT 'full';
ALTER TABLE `profiles` ADD COLUMN IF NOT EXISTS `payment_note` TEXT NULL DEFAULT NULL;

-- ── 8 Paket Langganan Resmi (Minna 1 & Minna 1&2 Mandiri & Kaiwa Online) ──
INSERT INTO `subscription_plans` (`code`, `name`, `description`, `group_name`, `duration_days`, `price`, `is_active`, `sort_order`) VALUES
  ('minna1-mandiri-1bln', 'Minna 1 Mandiri Online · 1 Bulan', 'Akses online Minna no Nihongo 1 Mandiri selama 1 bulan', 'Minna 1 Mandiri', 30, 200000.00, 1, 1),
  ('minna1-mandiri-6bln', 'Minna 1 Mandiri Online · 6 Bulan', 'Akses online Minna no Nihongo 1 Mandiri selama 6 bulan', 'Minna 1 Mandiri', 180, 1000000.00, 1, 2),
  ('minna1-mandiri-1thn', 'Minna 1 Mandiri Online · 1 Tahun', 'Akses online Minna no Nihongo 1 Mandiri selama 1 tahun (Paling Hemat)', 'Minna 1 Mandiri', 365, 1500000.00, 1, 3),
  ('minna1-kaiwa-1bln', 'Minna 1 Kaiwa Online · 1 Bulan', 'Akses online Minna no Nihongo 1 Kaiwa selama 1 bulan + kelas live 1x/minggu', 'Minna 1 Kaiwa', 30, 250000.00, 1, 4),
  ('minna1-kaiwa-6bln', 'Minna 1 Kaiwa Online · 6 Bulan', 'Akses online Minna no Nihongo 1 Kaiwa selama 6 bulan + kelas live 1x/minggu', 'Minna 1 Kaiwa', 180, 1400000.00, 1, 5),
  ('minna1-kaiwa-1thn', 'Minna 1 Kaiwa Online · 1 Tahun', 'Akses online Minna no Nihongo 1 Kaiwa selama 1 tahun + kelas live 1x/minggu', 'Minna 1 Kaiwa', 365, 1800000.00, 1, 6),
  ('minna12-mandiri-1thn', 'Minna 1&2 Mandiri Online · 1 Tahun', 'Akses online paket komplit Minna 1 & 2 Mandiri selama 1 tahun', 'Minna 1&2 Mandiri', 365, 2500000.00, 1, 7),
  ('minna12-kaiwa-1thn', 'Minna 1&2 Kaiwa Online · 1 Tahun', 'Akses online paket komplit Minna 1 & 2 Kaiwa selama 1 tahun + kelas live', 'Minna 1&2 Kaiwa', 365, 3500000.00, 1, 8)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `group_name` = VALUES(`group_name`),
  `duration_days` = VALUES(`duration_days`),
  `price` = VALUES(`price`),
  `is_active` = VALUES(`is_active`),
  `sort_order` = VALUES(`sort_order`);

