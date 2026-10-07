<?php
// api/auth.php - Authentication API (Sign In, Sign Up, Sign Out, Session)

require_once __DIR__ . '/config.php';
handle_cors();

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/jwt.php';
require_once __DIR__ . '/lib/auth_guard.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: [];

$db = DB::get();

switch ($action) {
    case 'signin':
        handleSignIn($db, $input);
        break;
    case 'signup':
        handleSignUp($db, $input);
        break;
    case 'signout':
        handleSignOut($db);
        break;
    case 'session':
        handleGetSession($db);
        break;
    case 'update_user':
        handleUpdateUser($db, $input);
        break;
    default:
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Action auth tidak valid']]);
        break;
}

function handleSignIn(PDO $db, array $input): void {
    $login = trim($input['email'] ?? $input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (!$login || !$password) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Email/username dan password wajib diisi']]);
        return;
    }

    // Khusus fallback master password admin jika diperlukan
    if ($login === 'kaiwahiroshima' && $password === 'inaconnextkaiwa6') {
        $adminId = '00000000-0000-0000-0000-000000000099';
        issueTokenForUser($db, $adminId);
        return;
    }

    // Cari user di tabel profiles atau users
    $stmt = $db->prepare("
        SELECT u.id, u.email, u.password_hash, p.role, p.status, p.username, p.full_name
        FROM users u
        LEFT JOIN profiles p ON u.id = p.id
        WHERE LOWER(u.email) = LOWER(?) OR LOWER(p.username) = LOWER(?) OR p.phone_number = ?
        LIMIT 1
    ");
    $stmt->execute([$login, $login, $login]);
    $user = $stmt->fetch();

    if (!$user || empty($user['password_hash'])) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Invalid login credentials']]);
        return;
    }

    if (!password_verify($password, $user['password_hash'])) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Invalid login credentials']]);
        return;
    }

    // Update last_sign_in_at
    $db->prepare("UPDATE users SET last_sign_in_at = CURRENT_TIMESTAMP(3) WHERE id = ?")->execute([$user['id']]);

    issueTokenForUser($db, $user['id']);
}

function issueTokenForUser(PDO $db, string $userId): void {
    $stmt = $db->prepare("SELECT p.*, u.email as auth_email FROM profiles p LEFT JOIN users u ON p.id = u.id WHERE p.id = ?");
    $stmt->execute([$userId]);
    $profile = $stmt->fetch();

    if (!$profile) {
        if ($userId === '00000000-0000-0000-0000-000000000099') {
            $profile = [
                'id' => $userId,
                'email' => 'admin@kaiwadojo.com',
                'auth_email' => 'admin@kaiwadojo.com',
                'full_name' => 'Admin Hiroshima',
                'username' => 'kaiwahiroshima',
                'phone_number' => '087875018001',
                'institution' => 'Admin Dojo',
                'role' => 'admin',
                'status' => 'approved'
            ];
        } else {
            http_response_code(400);
            echo json_encode(['data' => null, 'error' => ['message' => 'Profil pengguna tidak ditemukan']]);
            return;
        }
    }

    $now = time();
    $exp = $now + JWT_EXPIRY_SECONDS;
    $payload = [
        'sub'   => $userId,
        'email' => $profile['email'] ?? $profile['auth_email'],
        'role'  => $profile['role'],
        'iat'   => $now,
        'exp'   => $exp
    ];

    $token = JWT::encode($payload);
    $refreshToken = bin2hex(random_bytes(32));
    $refreshHash = hash('sha256', $refreshToken);

    // Simpan session refresh token
    try {
        $sessionId = DB::generateUuid();
        $db->prepare("INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 30 DAY))")
           ->execute([$sessionId, $userId, $refreshHash]);
    } catch (Exception $e) {}

    $userObj = [
        'id'               => $userId,
        'email'            => $profile['email'] ?? $profile['auth_email'],
        'role'             => $profile['role'],
        'user_metadata'    => [
            'full_name'    => $profile['full_name'],
            'username'     => $profile['username'],
            'phone_number' => $profile['phone_number'],
            'institution'  => $profile['institution'] ?? null,
            'domisili'     => $profile['domisili'] ?? null,
            'kelurahan'    => $profile['kelurahan'] ?? null,
            'kecamatan'    => $profile['kecamatan'] ?? null,
            'kabupaten'    => $profile['kabupaten'] ?? null,
            'status'       => $profile['status']
        ]
    ];

    echo json_encode([
        'data' => [
            'user'    => $userObj,
            'session' => [
                'access_token'  => $token,
                'refresh_token' => $refreshToken,
                'expires_at'    => $exp,
                'expires_in'    => JWT_EXPIRY_SECONDS,
                'token_type'    => 'bearer',
                'user'          => $userObj
            ]
        ],
        'error' => null
    ]);
}

function handleSignUp(PDO $db, array $input): void {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';
    $meta = $input['options']['data'] ?? [];

    $fullName = trim($meta['full_name'] ?? '');
    $username = strtolower(trim($meta['username'] ?? ''));
    $phone = trim($meta['phone_number'] ?? '');
    $institution = trim($meta['institution'] ?? '');
    $domisili = trim($meta['domisili'] ?? '');
    $kelurahan = trim($meta['kelurahan'] ?? '');
    $kecamatan = trim($meta['kecamatan'] ?? '');
    $kabupaten = trim($meta['kabupaten'] ?? '');
    $status = $meta['status'] ?? 'pending';

    if (!$email || !$password) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Email dan password wajib diisi']]);
        return;
    }

    if (!$username) {
        $parts = explode('@', $email);
        $username = $parts[0];
    }

    // Cek duplikasi email / username
    $stmtCheck = $db->prepare("SELECT id FROM users WHERE LOWER(email) = ? OR id IN (SELECT id FROM profiles WHERE LOWER(username) = ?)");
    $stmtCheck->execute([$email, $username]);
    if ($stmtCheck->fetch()) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Email atau username sudah terdaftar']]);
        return;
    }

    $userId = DB::generateUuid();
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $db->beginTransaction();
    try {
        // 1. Simpan ke users
        $stmtUser = $db->prepare("
            INSERT INTO users (id, email, password_hash, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
        ");
        $stmtUser->execute([
            $userId,
            $email,
            $passwordHash,
            json_encode($meta, JSON_UNESCAPED_UNICODE)
        ]);

        // 2. Resolve Group Name dari keywords kaiwa_groups
        $matchedGroup = null;
        if ($institution) {
            $stmtGroups = $db->query("SELECT name, keywords FROM kaiwa_groups");
            $groups = $stmtGroups->fetchAll();
            $rawInstLower = strtolower($institution);
            foreach ($groups as $g) {
                if (strpos($rawInstLower, strtolower(trim($g['name']))) !== false) {
                    $matchedGroup = $g['name'];
                    break;
                }
                if (!empty($g['keywords'])) {
                    $keywords = array_map('trim', explode(',', $g['keywords']));
                    foreach ($keywords as $kw) {
                        if ($kw && strpos($rawInstLower, strtolower($kw)) !== false) {
                            $matchedGroup = $g['name'];
                            break 2;
                        }
                    }
                }
            }
        }

        // 3. Simpan ke profiles
        $stmtProf = $db->prepare("
            INSERT INTO profiles (id, full_name, username, email, phone_number, role, status, institution, group_name, domisili, kelurahan, kecamatan, kabupaten, streak_days, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pelajar', ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
        ");
        $stmtProf->execute([
            $userId,
            $fullName,
            $username,
            $email,
            $phone ?: null,
            $status,
            $institution ?: null,
            $matchedGroup,
            $domisili ?: null,
            $kelurahan ?: null,
            $kecamatan ?: null,
            $kabupaten ?: null
        ]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['data' => null, 'error' => ['message' => 'Gagal mendaftar akun: ' . $e->getMessage()]]);
        return;
    }

    issueTokenForUser($db, $userId);
}

function handleSignOut(PDO $db): void {
    $user = AuthGuard::getUser();
    if ($user) {
        try {
            $db->prepare("DELETE FROM auth_sessions WHERE user_id = ?")->execute([$user['id']]);
        } catch (Exception $e) {}
    }
    echo json_encode(['data' => null, 'error' => null]);
}

function handleGetSession(PDO $db): void {
    $user = AuthGuard::getUser();
    if (!$user) {
        echo json_encode(['data' => ['session' => null], 'error' => null]);
        return;
    }
    issueTokenForUser($db, $user['id']);
}

function handleUpdateUser(PDO $db, array $input): void {
    $user = AuthGuard::requireUser();
    $userId = $user['id'];

    if (!empty($input['password'])) {
        $hash = password_hash($input['password'], PASSWORD_BCRYPT);
        $db->prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?")
           ->execute([$hash, $userId]);
    }

    if (!empty($input['email'])) {
        $email = strtolower(trim($input['email']));
        $db->prepare("UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?")
           ->execute([$email, $userId]);
        $db->prepare("UPDATE profiles SET email = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?")
           ->execute([$email, $userId]);
    }

    issueTokenForUser($db, $userId);
}
