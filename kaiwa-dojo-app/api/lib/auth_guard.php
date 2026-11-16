<?php
// api/lib/auth_guard.php - Auth Header & User Resolver

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';

class AuthGuard {
    /** ID akun admin utama (login via MASTER_ADMIN_USERNAME / MASTER_ADMIN_PASSWORD_HASH di config.local.php) */
    public const MASTER_ADMIN_ID = '00000000-0000-0000-0000-000000000099';

    private static ?array $currentUser = null;

    public static function isMasterAdminEnabled(): bool {
        return defined('MASTER_ADMIN_USERNAME') && MASTER_ADMIN_USERNAME !== ''
            && defined('MASTER_ADMIN_PASSWORD_HASH') && MASTER_ADMIN_PASSWORD_HASH !== '';
    }
    private static bool $evaluated = false;

    public static function getUser(): ?array {
        if (self::$evaluated) {
            return self::$currentUser;
        }
        self::$evaluated = true;

        $token = null;

        // 1. Cek dari HTTP Headers
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTHORIZATION'] ?? '';
        if (!$authHeader && function_exists('getallheaders')) {
            $headers = getallheaders();
            if (is_array($headers)) {
                foreach ($headers as $k => $v) {
                    if (strcasecmp($k, 'Authorization') === 0 || strcasecmp($k, 'X-Authorization') === 0) {
                        $authHeader = $v;
                        break;
                    }
                }
            }
        }
        if (!$authHeader && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (is_array($headers)) {
                foreach ($headers as $k => $v) {
                    if (strcasecmp($k, 'Authorization') === 0 || strcasecmp($k, 'X-Authorization') === 0) {
                        $authHeader = $v;
                        break;
                    }
                }
            }
        }

        if ($authHeader && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            $token = $matches[1];
        }

        // 2. Cek dari GET Query String
        if (!$token && !empty($_GET['access_token'])) {
            $token = $_GET['access_token'];
        }

        // 3. Cek dari POST Body / Raw JSON Input
        if (!$token && !empty($_POST['access_token'])) {
            $token = $_POST['access_token'];
        }
        if (!$token) {
            $rawBody = file_get_contents('php://input');
            if ($rawBody) {
                $bodyJson = json_decode($rawBody, true);
                if (is_array($bodyJson)) {
                    $token = $bodyJson['_token'] ?? $bodyJson['access_token'] ?? null;
                }
            }
        }

        if (!$token) {
            return null;
        }

        $payload = JWT::decode($token);
        if (!$payload || empty($payload['sub'])) {
            return null;
        }

        $userId = $payload['sub'];
        $db = DB::get();

        // Ambil data profile terbaru untuk memastikan role & status valid
        $stmt = $db->prepare("SELECT p.*, u.email as auth_email, u.raw_user_meta_data FROM users u LEFT JOIN profiles p ON u.id = p.id WHERE u.id = ? OR p.id = ? LIMIT 1");
        $stmt->execute([$userId, $userId]);
        $row = $stmt->fetch();

        $isMasterAdmin = $userId === self::MASTER_ADMIN_ID && self::isMasterAdminEnabled();

        if (!$row) {
            // Admin utama boleh tidak punya baris di tabel users/profiles
            if ($isMasterAdmin) {
                self::$currentUser = [
                    'id'       => $userId,
                    'email'    => 'admin@kaiwadojo.com',
                    'username' => MASTER_ADMIN_USERNAME,
                    'role'     => 'admin',
                    'status'   => 'approved',
                    'profile'  => ['id' => $userId, 'role' => 'admin', 'status' => 'approved', 'username' => MASTER_ADMIN_USERNAME]
                ];
                return self::$currentUser;
            }
            // Akun sudah dihapus → token tidak berlaku lagi (role TIDAK diambil dari isi token)
            return null;
        }

        $rawMeta = $row['raw_user_meta_data'] ?? null;
        $meta = is_string($rawMeta) ? (json_decode($rawMeta, true) ?: []) : (is_array($rawMeta) ? $rawMeta : []);
        if ($isMasterAdmin) {
            $role = 'admin';
            $status = 'approved';
        } else {
            // Role & status hanya dari tabel profiles (dikelola server/admin).
            // raw_user_meta_data diisi pendaftar sendiri, jadi tidak boleh menentukan role.
            $role = $row['role'] ?? 'pelajar';
            $status = $row['status'] ?? 'approved';
        }

        self::$currentUser = [
            'id'       => $row['id'] ?? $userId,
            'email'    => $row['email'] ?? $row['auth_email'] ?? $payload['email'] ?? '',
            'username' => $row['username'] ?? $meta['username'] ?? 'User',
            'role'     => $role,
            'status'   => $status,
            'profile'  => $row
        ];

        return self::$currentUser;
    }

    public static function requireUser(): array {
        $user = self::getUser();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized: Invalid or missing token']);
            exit;
        }
        return $user;
    }

    public static function requireAdmin(): array {
        $user = self::requireUser();
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden: Admin privilege required']);
            exit;
        }
        return $user;
    }
}
