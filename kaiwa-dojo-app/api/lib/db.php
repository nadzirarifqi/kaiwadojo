<?php
// api/lib/db.php - Database Singleton & PDO Helper (Optimized for MariaDB)

require_once __DIR__ . '/../config.php';

class DB {
    private static ?PDO $instance = null;
    private static ?string $verifiedHost = null;

    public static function get(): PDO {
        if (self::$instance === null) {
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
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

            // Urutan prioritas host: host terverifikasi -> DB_HOST -> 127.0.0.1 -> localhost
            $hosts = array_filter(array_unique([
                self::$verifiedHost,
                $cachedHost,
                DB_HOST,
                '127.0.0.1',
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
        }
        return self::$instance;
    }

    /**
     * Memastikan kolom domisili profiles ada di MariaDB.
     * Menggunakan flag file agar hanya diperiksa 1x dan tidak membebani query SHOW COLUMNS di setiap request.
     */
    public static function ensureProfileAddressColumns(): void {
        static $checked = false;
        if ($checked || self::$instance === null) return;
        $checked = true;

        $flagFile = sys_get_temp_dir() . '/kaiwa_profile_cols_v2.ok';
        if (file_exists($flagFile)) {
            return;
        }

        try {
            $cols = ['domisili', 'kelurahan', 'kecamatan', 'kabupaten'];
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

        $flagFile = sys_get_temp_dir() . '/kaiwa_indexes_v1.ok';
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
                ['quiz_questions', 'idx_quiz_questions_lesson', '(`lesson_id`, `order_index`)'],
                ['change_log', 'idx_change_log_id_created', '(`id`, `created_at`)'],
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
