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
        $stmt = $db->prepare("SELECT p.*, u.email as auth_email FROM profiles p LEFT JOIN users u ON p.id = u.id WHERE p.id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $profile = $stmt->fetch();

        if (!$profile) {
            return null;
        }

        self::$currentUser = [
            'id'       => $profile['id'],
            'email'    => $profile['email'] ?? $profile['auth_email'],
            'username' => $profile['username'],
            'role'     => $profile['role'],
            'status'   => $profile['status'],
            'profile'  => $profile
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
