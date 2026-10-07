<?php
// api/lib/db.php - Database Singleton & PDO Helper

require_once __DIR__ . '/../config.php';

class DB {
    private static ?PDO $instance = null;

    public static function get(): PDO {
        if (self::$instance === null) {
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
                $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4";
            }

            // Daftar host alternatif (127.0.0.1 vs localhost) untuk MariaDB di Linux / CyberPanel
            $hosts = array_unique([DB_HOST, '127.0.0.1', 'localhost']);
            $lastException = null;

            foreach ($hosts as $h) {
                try {
                    $dsn = "mysql:host=$h;port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                    self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
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
        }
        return self::$instance;
    }

    public static function ensureProfileAddressColumns(): void {
        static $checked = false;
        if ($checked || self::$instance === null) return;
        $checked = true;
        try {
            $cols = ['domisili', 'kelurahan', 'kecamatan', 'kabupaten'];
            $stmt = self::$instance->query("SHOW COLUMNS FROM profiles");
            $existing = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $existing[strtolower($row['Field'])] = true;
            }
            foreach ($cols as $col) {
                if (!isset($existing[$col])) {
                    self::$instance->exec("ALTER TABLE profiles ADD COLUMN `$col` TEXT NULL DEFAULT NULL");
                }
            }
        } catch (Throwable $e) {
            // Silently ignore if table does not exist yet
        }
    }

    public static function generateUuid(): string {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
