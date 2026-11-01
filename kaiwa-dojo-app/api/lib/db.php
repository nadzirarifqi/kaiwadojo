<?php
// api/lib/db.php - Database Singleton & PDO Helper (Optimized for MariaDB)

require_once __DIR__ . '/../config.php';

class DB {
    private static ?PDO $instance = null;
    private static ?string $verifiedHost = null;

    public static function reset(): void {
        self::$instance = null;
    }

    public static function get(): PDO {
        if (self::$instance === null) {
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_TIMEOUT            => 3,
            ];
            if (defined('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY')) {
                $options[PDO::MYSQL_ATTR_USE_BUFFERED_QUERY] = true;
            }

            // Gunakan host yang sudah berhasil sebelumnya jika ada di cache
            $cacheFile = sys_get_temp_dir() . '/kaiwa_db_host.cache';
            $cachedHost = null;
            if (file_exists($cacheFile)) {
                $cachedHost = trim(@file_get_contents($cacheFile) ?: '');
            }

            // Urutan prioritas host: host terverifikasi -> cachedHost -> 127.0.0.1 -> DB_HOST -> localhost
            $hosts = array_filter(array_unique([
                self::$verifiedHost,
                $cachedHost,
                '127.0.0.1',
                DB_HOST,
                'localhost'
            ]));

            $lastException = null;

            foreach ($hosts as $h) {
                try {
                    $dsn = "mysql:host=$h;port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                    self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
                    self::$verifiedHost = $h;
                    @file_put_contents($cacheFile, $h);
                    break;
                } catch (PDOException $e) {
                    $lastException = $e;
                }
            }

            // Jika TCP masih gagal, coba UNIX socket umum MariaDB CyberPanel / OpenLiteSpeed
            if (self::$instance === null) {
                $sockets = ['/var/lib/mysql/mysql.sock', '/tmp/mysql.sock', '/var/run/mysqld/mysqld.sock'];
                foreach ($sockets as $sock) {
                    if (file_exists($sock)) {
                        try {
                            $dsn = "mysql:unix_socket=$sock;dbname=" . DB_NAME . ";charset=utf8mb4";
                            self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
                            break;
                        } catch (PDOException $e) {
                            $lastException = $e;
                        }
                    }
                }
            }

            if (self::$instance === null) {
                http_response_code(500);
                header('Content-Type: application/json');
                echo json_encode([
                    'data'  => null,
                    'error' => [
                        'message' => 'Koneksi MariaDB gagal: ' . ($lastException ? $lastException->getMessage() : 'Gagal menghubungkan ke database'),
                        'code'    => $lastException ? $lastException->getCode() : 500
                    ]
                ]);
                exit;
            }

            self::ensureProfileAddressColumns();
            self::ensureOptimizedIndexes();
            self::ensureDeletedRowsArchive();
            self::ensureSubscriptionSchema();
        }
        return self::$instance;
    }

    /**
     * Tabel & kolom integrasi langganan (website pendaftaran bangunnegeri):
     * - subscription_plans : daftar paket, tiap paket bisa menentukan grup kelas (akses)
     * - subscriptions      : data langganan yang dikirim website pendaftaran + kode referral
     * - profiles.plan_code / profiles.access_level ('full' | 'view_only')
     */
    public static function ensureSubscriptionSchema(): void {
        static $checked = false;
        if ($checked || self::$instance === null) return;
        $checked = true;

        $flagFile = sys_get_temp_dir() . '/kaiwa_subscription_schema_v2.ok';
        if (file_exists($flagFile)) {
            return;
        }

        try {
            self::$instance->exec("
                CREATE TABLE IF NOT EXISTS `subscription_plans` (
                  `code` VARCHAR(64) NOT NULL,
                  `name` VARCHAR(255) NOT NULL,
                  `description` TEXT NULL,
                  `group_name` VARCHAR(255) NULL,
                  `duration_days` INT NULL,
                  `price` DECIMAL(12,2) NULL DEFAULT 0,
                  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                  `sort_order` INT NOT NULL DEFAULT 0,
                  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                  PRIMARY KEY (`code`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            self::$instance->exec("
                CREATE TABLE IF NOT EXISTS `subscriptions` (
                  `id` CHAR(36) NOT NULL,
                  `external_id` VARCHAR(100) NOT NULL,
                  `referral_code` VARCHAR(32) NOT NULL,
                  `email` VARCHAR(255) NOT NULL,
                  `full_name` VARCHAR(255) NULL,
                  `phone_number` VARCHAR(32) NULL,
                  `plan_code` VARCHAR(64) NOT NULL,
                  `payment_status` VARCHAR(16) NOT NULL DEFAULT 'pending',
                  `starts_at` DATETIME NULL,
                  `ends_at` DATETIME NULL,
                  `user_id` CHAR(36) NULL,
                  `registered_at` DATETIME(3) NULL,
                  `source` VARCHAR(64) NOT NULL DEFAULT 'bangunnegeri',
                  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `subscriptions_external_id` (`external_id`),
                  UNIQUE KEY `subscriptions_referral_code` (`referral_code`),
                  KEY `subscriptions_email` (`email`),
                  KEY `subscriptions_user` (`user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Cek kolom profiles
            $existing = [];
            $stmt = self::$instance->query("SHOW COLUMNS FROM `profiles`");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $existing[strtolower($row['Field'])] = true;
            }
            if (!isset($existing['plan_code'])) {
                self::$instance->exec("ALTER TABLE `profiles` ADD COLUMN `plan_code` VARCHAR(64) NULL DEFAULT NULL");
            }
            if (!isset($existing['payment_status'])) {
                self::$instance->exec("ALTER TABLE `profiles` ADD COLUMN `payment_status` VARCHAR(32) NOT NULL DEFAULT 'unpaid'");
            }
            if (!isset($existing['subscription_ends_at'])) {
                self::$instance->exec("ALTER TABLE `profiles` ADD COLUMN `subscription_ends_at` DATETIME NULL DEFAULT NULL");
            }
            if (!isset($existing['access_level'])) {
                self::$instance->exec("ALTER TABLE `profiles` ADD COLUMN `access_level` VARCHAR(16) NOT NULL DEFAULT 'full'");
            }

            // Cek kolom subscription_plans (price)
            $planCols = [];
            $stmtPlans = self::$instance->query("SHOW COLUMNS FROM `subscription_plans`");
            while ($row = $stmtPlans->fetch(PDO::FETCH_ASSOC)) {
                $planCols[strtolower($row['Field'])] = true;
            }
            if (!isset($planCols['price'])) {
                self::$instance->exec("ALTER TABLE `subscription_plans` ADD COLUMN `price` DECIMAL(12,2) NULL DEFAULT 0");
            }

            // Seed 8 paket langganan resmi
            self::$instance->exec("
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
                  `sort_order` = VALUES(`sort_order`)
            ");

            @file_put_contents($flagFile, '1');
        } catch (Throwable $e) {
            // Jika user DB tidak punya hak CREATE/ALTER, jalankan database/subscriptions.sql secara manual
        }
    }

    /**
     * Memastikan tabel arsip penghapusan ada. Setiap baris user_kotoba_submissions yang dihapus
     * disalin ke sini lebih dulu agar dapat dipulihkan.
     */
    public static function ensureDeletedRowsArchive(): void {
        static $checked = false;
        if ($checked || self::$instance === null) return;
        $checked = true;

        $flagFile = sys_get_temp_dir() . '/kaiwa_deleted_rows_archive_v1.ok';
        if (file_exists($flagFile)) {
            return;
        }

        try {
            self::$instance->exec("
                CREATE TABLE IF NOT EXISTS `deleted_rows_archive` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `table_name` VARCHAR(64) NOT NULL,
                  `row_id` CHAR(36) NULL,
                  `owner_id` CHAR(36) NULL,
                  `row_data` LONGTEXT NOT NULL,
                  `deleted_by` CHAR(36) NULL,
                  `deleted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                  PRIMARY KEY (`id`),
                  KEY `idx_deleted_rows_owner` (`table_name`, `owner_id`),
                  KEY `idx_deleted_rows_deleted_at` (`deleted_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            @file_put_contents($flagFile, '1');
        } catch (Throwable $e) {
            // Silently ignore jika DB user tidak punya hak CREATE; jalankan database/mysql_schema.sql manual
        }
    }

    /**
     * Memastikan kolom domisili profiles ada di MariaDB.
     * Menggunakan flag file agar hanya diperiksa 1x dan tidak membebani query SHOW COLUMNS di setiap request.
     */
    public static function ensureProfileAddressColumns(): void {
        static $checked = false;
        if ($checked || self::$instance === null) return;
        $checked = true;

        $flagFile = sys_get_temp_dir() . '/kaiwa_profile_cols_v4_payment_note.ok';
        if (file_exists($flagFile)) {
            return;
        }

        try {
            $cols = ['domisili', 'kelurahan', 'kecamatan', 'kabupaten', 'referral_code', 'payment_note'];
            $stmt = self::$instance->query("SHOW COLUMNS FROM `profiles`");
            $existing = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $existing[strtolower($row['Field'])] = true;
            }
            foreach ($cols as $col) {
                if (!isset($existing[$col])) {
                    self::$instance->exec("ALTER TABLE `profiles` ADD COLUMN `$col` TEXT NULL DEFAULT NULL");
                }
            }
            @file_put_contents($flagFile, '1');
        } catch (Throwable $e) {
            // Silently ignore jika tabel belum siap
        }
    }

    /**
     * Memastikan indeks kunci MariaDB tersedia untuk mempercepat read query
     * Dijalankan hanya 1x (flag file) sehingga 0ms overhead pada request normal.
     */
    public static function ensureOptimizedIndexes(): void {
        static $indexesChecked = false;
        if ($indexesChecked || self::$instance === null) return;
        $indexesChecked = true;

        $flagFile = sys_get_temp_dir() . '/kaiwa_indexes_v2_kotoba.ok';
        if (file_exists($flagFile)) {
            return;
        }

        try {
            $indexDefinitions = [
                ['class_schedules', 'idx_class_schedules_date', '(`date`)'],
                ['class_schedules', 'idx_class_schedules_start_date', '(`start_date`)'],
                ['class_schedules', 'idx_class_schedules_instructor', '(`instructor_id`)'],
                ['class_schedules', 'idx_class_schedules_type', '(`type`)'],
                ['class_schedules', 'idx_class_schedules_created', '(`created_at`)'],
                ['class_reservations', 'idx_class_reservations_user_created', '(`user_id`, `created_at`)'],
                ['daily_missions', 'idx_daily_missions_date', '(`date`)'],
                ['learning_streaks', 'idx_learning_streaks_date', '(`date`)'],
                ['profiles', 'idx_profiles_role', '(`role`)'],
                ['profiles', 'idx_profiles_status', '(`status`(191))'],
                ['profiles', 'idx_profiles_group_name', '(`group_name`(191))'],
                ['profiles', 'idx_profiles_last_active', '(`last_active_at`)'],
                ['quiz_attempts', 'idx_quiz_attempts_student_lesson', '(`student_id`, `lesson_id`)'],
                ['change_log', 'idx_change_log_id_created', '(`id`, `created_at`)'],
                ['user_kotoba_submissions', 'idx_user_kotoba_submissions_user_created', '(`user_id`, `created_at`)'],
                ['user_kotoba_submissions', 'idx_user_kotoba_submissions_user_id', '(`user_id`)'],
                ['user_kotoba_submissions', 'idx_user_kotoba_submissions_mastered', '(`is_mastered`)'],
                ['user_kotoba_submissions', 'idx_user_kotoba_submissions_user_mastered', '(`user_id`, `is_mastered`)'],
            ];

            foreach ($indexDefinitions as [$tbl, $idxName, $colsSql]) {
                try {
                    $checkStmt = self::$instance->prepare("SHOW INDEX FROM `$tbl` WHERE Key_name = ?");
                    $checkStmt->execute([$idxName]);
                    if (!$checkStmt->fetch()) {
                        self::$instance->exec("CREATE INDEX `$idxName` ON `$tbl` $colsSql");
                    }
                } catch (Throwable $e) {
                    // Abaikan jika tabel atau kolom belum tersedia
                }
            }
            @file_put_contents($flagFile, '1');
        } catch (Throwable $e) {}
    }

    public static function generateUuid(): string {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
