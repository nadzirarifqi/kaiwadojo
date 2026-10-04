<?php
// api/lib/auth_guard.php - Auth Header & User Resolver

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';

class AuthGuard {
    private static ?array $currentUser = null;
    private static bool $evaluated = false;

    public static function getUser(): ?array {
        if (self::$evaluated) {
            return self::$currentUser;
        }
        self::$evaluated = true;

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

        if (!preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            // Fallback jika dikirim via query string token saat debugging
            if (!empty($_GET['access_token'])) {
                $token = $_GET['access_token'];
            } else {
                return null;
            }
        } else {
            $token = $matches[1];
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

        if (!$row) {
            // Master admin hardcoded fallback
            if ($userId === '00000000-0000-0000-0000-000000000099') {
                self::$currentUser = [
                    'id'       => $userId,
                    'email'    => 'admin@kaiwadojo.com',
                    'username' => 'kaiwahiroshima',
                    'role'     => 'admin',
                    'status'   => 'approved',
                    'profile'  => ['id' => $userId, 'role' => 'admin', 'status' => 'approved', 'username' => 'kaiwahiroshima']
                ];
                return self::$currentUser;
            }

            // Fallback from JWT payload directly if user was deleted or table desynced
            $jwtRole = $payload['role'] ?? ($payload['user_metadata']['role'] ?? 'pelajar');
            self::$currentUser = [
                'id'       => $userId,
                'email'    => $payload['email'] ?? '',
                'username' => $payload['user_metadata']['username'] ?? 'User',
                'role'     => $jwtRole,
                'status'   => 'approved',
                'profile'  => ['id' => $userId, 'role' => $jwtRole, 'status' => 'approved']
            ];
            return self::$currentUser;
        }

        $meta = !empty($row['raw_user_meta_data']) ? json_decode($row['raw_user_meta_data'], true) : [];
        $role = $row['role'] ?? $meta['role'] ?? ($userId === '00000000-0000-0000-0000-000000000099' ? 'admin' : 'pelajar');
        $status = $row['status'] ?? $meta['status'] ?? 'approved';

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
