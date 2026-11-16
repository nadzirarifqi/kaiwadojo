<?php
// api/rpc.php - Stored Functions / RPC Handler

require_once __DIR__ . '/config.php';
handle_cors();

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth_guard.php';
require_once __DIR__ . '/lib/attendance.php';

header('Content-Type: application/json');

$fn = $_GET['fn'] ?? '';
$rawInput = file_get_contents('php://input');
$args = json_decode($rawInput, true) ?: [];

$db = DB::get();

switch ($fn) {
    case 'check_user_duplicates':
        handleCheckDuplicates($db, $args);
        break;
    case 'delete_auth_user':
        handleDeleteAuthUser($db, $args);
        break;
    case 'admin_create_instructor':
        handleAdminCreateInstructor($db, $args);
        break;
    case 'admin_update_instructor':
        handleAdminUpdateInstructor($db, $args);
        break;
    case 'touch_attendance':
        $u = AuthGuard::requireUser();
        Attendance::record($db, $u['id'], false);
        echo json_encode(['data' => true, 'error' => null]);
        break;
    case 'admin_compile_attendance':
        handleAdminCompileAttendance($db, $args, false);
        break;
    case 'admin_push_attendance_sheet':
        handleAdminCompileAttendance($db, $args, true);
        break;
    default:
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => "Fungsi RPC tidak dikenal: $fn"]]);
        break;
}

function handleCheckDuplicates(PDO $db, array $args): void {
    $rawUser  = strtolower(trim($args['p_username'] ?? ''));
    $rawEmail = strtolower(trim($args['p_email'] ?? ''));
    $rawPhone = trim($args['p_phone'] ?? '');

    $cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
    $formattedPhone = $cleanPhone;
    if (str_starts_with($cleanPhone, '0')) {
        $formattedPhone = '62' . substr($cleanPhone, 1);
    }

    $userDupe = false;
    $emailDupe = false;
    $phoneDupe = false;

    if ($rawUser !== '') {
        $stmt = $db->prepare("SELECT 1 FROM profiles WHERE LOWER(username) = ? LIMIT 1");
        $stmt->execute([$rawUser]);
        $userDupe = (bool)$stmt->fetchColumn();
    }

    if ($rawEmail !== '') {
        $stmt = $db->prepare("SELECT 1 FROM profiles WHERE LOWER(email) = ? UNION SELECT 1 FROM users WHERE LOWER(email) = ? LIMIT 1");
        $stmt->execute([$rawEmail, $rawEmail]);
        $emailDupe = (bool)$stmt->fetchColumn();
    }

    if ($cleanPhone !== '') {
        $stmt = $db->prepare("
            SELECT 1 FROM profiles
            WHERE (phone_number IS NOT NULL AND phone_number != '')
              AND (
                phone_number = ?
                OR REGEXP_REPLACE(phone_number, '[^0-9]', '') = ?
                OR REGEXP_REPLACE(phone_number, '[^0-9]', '') = ?
              )
            LIMIT 1
        ");
        $stmt->execute([$rawPhone, $cleanPhone, $formattedPhone]);
        $phoneDupe = (bool)$stmt->fetchColumn();
    }

    echo json_encode([
        'data' => [
            [
                'username_exists' => $userDupe,
                'email_exists'    => $emailDupe,
                'phone_exists'    => $phoneDupe
            ]
        ],
        'error' => null
    ]);
}

function handleDeleteAuthUser(PDO $db, array $args): void {
    $user = AuthGuard::requireAdmin();

    $userId = $args['user_id'] ?? null;
    $userEmail = strtolower(trim($args['user_email'] ?? ''));

    if (!$userId && !$userEmail) {
        http_response_code(400);
        echo json_encode(['data' => false, 'error' => ['message' => 'User ID atau Email wajib diisi']]);
        return;
    }

    $db->beginTransaction();
    try {
        if ($userId) {
            $db->prepare("DELETE FROM daily_missions WHERE student_id = ?")->execute([$userId]);
            $db->prepare("DELETE FROM learning_streaks WHERE student_id = ?")->execute([$userId]);
            // Arsipkan kotoba sebelum dihapus agar tetap bisa dipulihkan
            $db->prepare("
                INSERT INTO deleted_rows_archive (table_name, row_id, owner_id, row_data, deleted_by, deleted_at)
                SELECT 'user_kotoba_submissions', k.id, k.user_id,
                       JSON_OBJECT('id', k.id, 'user_id', k.user_id, 'japanese', k.japanese, 'romaji', k.romaji,
                                   'meaning', k.meaning, 'image_url', k.image_url, 'is_mastered', k.is_mastered,
                                   'created_at', k.created_at),
                       ?, CURRENT_TIMESTAMP(3)
                FROM user_kotoba_submissions k WHERE k.user_id = ?
            ")->execute([$user['id'] ?? null, $userId]);
            $db->prepare("DELETE FROM user_kotoba_submissions WHERE user_id = ?")->execute([$userId]);
            $db->prepare("DELETE FROM lesson_progress WHERE student_id = ?")->execute([$userId]);
            $db->prepare("DELETE FROM class_reservations WHERE user_id = ?")->execute([$userId]);
            $db->prepare("DELETE FROM enrollments WHERE student_id = ?")->execute([$userId]);
            $db->prepare("DELETE FROM profiles WHERE id = ?")->execute([$userId]);
            $db->prepare("DELETE FROM users WHERE id = ?")->execute([$userId]);
        }

        if ($userEmail) {
            $db->prepare("DELETE FROM profiles WHERE LOWER(email) = ?")->execute([$userEmail]);
            $db->prepare("DELETE FROM users WHERE LOWER(email) = ?")->execute([$userEmail]);
        }

        $db->commit();
        echo json_encode(['data' => true, 'error' => null]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['data' => false, 'error' => ['message' => $e->getMessage()]]);
    }
}

/**
 * Validasi & normalisasi input akun pemateri dari admin.
 * Mengembalikan [data, errorMessage].
 */
function normalizeInstructorInput(array $args, bool $requirePassword): array {
    $fullName = trim((string)($args['full_name'] ?? ''));
    $username = strtolower(trim((string)($args['username'] ?? '')));
    $email    = strtolower(trim((string)($args['email'] ?? '')));
    $phone    = preg_replace('/[^0-9+]/', '', trim((string)($args['phone_number'] ?? '')));
    $password = (string)($args['password'] ?? '');
    $bio      = trim((string)($args['bio'] ?? ''));
    $expertise = $args['expertise'] ?? [];
    if (!is_array($expertise)) $expertise = [];
    $expertise = array_values(array_filter(array_map(fn($e) => mb_substr(trim((string)$e), 0, 40), $expertise)));

    if ($fullName === '' || $username === '' || $email === '') {
        return [null, 'Nama lengkap, username, dan email wajib diisi'];
    }
    if (!preg_match('/^[a-z0-9._]{3,30}$/', $username)) {
        return [null, 'Username hanya boleh huruf kecil, angka, titik, atau garis bawah (3-30 karakter)'];
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return [null, 'Format email tidak valid'];
    }
    if (($requirePassword || $password !== '') && strlen($password) < 8) {
        return [null, 'Password minimal 8 karakter'];
    }

    return [[
        'full_name'    => mb_substr($fullName, 0, 120),
        'username'     => $username,
        'email'        => $email,
        'phone_number' => $phone !== '' ? $phone : null,
        'password'     => $password,
        'bio'          => $bio !== '' ? mb_substr($bio, 0, 300) : null,
        'expertise'    => $expertise ?: ['Kaiwa', 'Japanese'],
    ], null];
}

/** Cek apakah email / username / no. HP sudah dipakai akun lain (kecuali $exceptId). */
function findInstructorConflict(PDO $db, array $d, ?string $exceptId = null): ?string {
    $except = $exceptId ?? '';

    $stmt = $db->prepare("SELECT 1 FROM profiles WHERE LOWER(username) = ? AND id <> ? LIMIT 1");
    $stmt->execute([$d['username'], $except]);
    if ($stmt->fetchColumn()) return 'Username sudah dipakai akun lain';

    $stmt = $db->prepare("
        SELECT 1 FROM users WHERE LOWER(email) = ? AND id <> ?
        UNION SELECT 1 FROM profiles WHERE LOWER(email) = ? AND id <> ?
        LIMIT 1
    ");
    $stmt->execute([$d['email'], $except, $d['email'], $except]);
    if ($stmt->fetchColumn()) return 'Email sudah dipakai akun lain';

    if ($d['phone_number']) {
        $stmt = $db->prepare("SELECT 1 FROM profiles WHERE phone_number = ? AND id <> ? LIMIT 1");
        $stmt->execute([$d['phone_number'], $except]);
        if ($stmt->fetchColumn()) return 'Nomor WhatsApp sudah dipakai akun lain';
    }
    return null;
}

/**
 * Admin membuat akun pemateri baru (satu-satunya jalur selain input manual di database).
 * Tidak mengeluarkan token, jadi sesi admin tetap utuh.
 */
function handleAdminCreateInstructor(PDO $db, array $args): void {
    AuthGuard::requireAdmin();

    [$d, $err] = normalizeInstructorInput($args, true);
    if ($err) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => $err]]);
        return;
    }

    $conflict = findInstructorConflict($db, $d);
    if ($conflict) {
        http_response_code(409);
        echo json_encode(['data' => null, 'error' => ['message' => $conflict]]);
        return;
    }

    $userId = DB::generateUuid();
    $avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' . rawurlencode($d['username']);
    $meta = [
        'full_name'    => $d['full_name'],
        'username'     => $d['username'],
        'phone_number' => $d['phone_number'],
        'role'         => 'pemateri',
        'created_by'   => 'admin',
    ];

    $db->beginTransaction();
    try {
        $db->prepare("
            INSERT INTO users (id, email, password_hash, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
        ")->execute([
            $userId,
            $d['email'],
            password_hash($d['password'], PASSWORD_BCRYPT),
            json_encode($meta, JSON_UNESCAPED_UNICODE),
        ]);

        $db->prepare("
            INSERT INTO profiles (id, full_name, username, email, phone_number, avatar_url, bio, role, status, streak_days, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pemateri', 'approved', 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
        ")->execute([
            $userId,
            $d['full_name'],
            $d['username'],
            $d['email'],
            $d['phone_number'],
            $avatar,
            $d['bio'],
        ]);

        $db->prepare("
            INSERT INTO instructor_profiles (id, expertise, total_students, verified)
            VALUES (?, ?, 0, 1)
        ")->execute([$userId, json_encode($d['expertise'], JSON_UNESCAPED_UNICODE)]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['data' => null, 'error' => ['message' => 'Gagal membuat akun pemateri: ' . $e->getMessage()]]);
        return;
    }

    echo json_encode([
        'data' => [
            'id'           => $userId,
            'full_name'    => $d['full_name'],
            'username'     => $d['username'],
            'email'        => $d['email'],
            'phone_number' => $d['phone_number'],
            'avatar_url'   => $avatar,
            'bio'          => $d['bio'],
            'expertise'    => $d['expertise'],
            'role'         => 'pemateri',
        ],
        'error' => null,
    ]);
}

/** Admin mengubah data akun pemateri, termasuk reset password (opsional). */
function handleAdminUpdateInstructor(PDO $db, array $args): void {
    AuthGuard::requireAdmin();

    $id = trim((string)($args['id'] ?? ''));
    $stmt = $db->prepare("SELECT role FROM profiles WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    if ($id === '' || $stmt->fetchColumn() !== 'pemateri') {
        http_response_code(404);
        echo json_encode(['data' => null, 'error' => ['message' => 'Akun pemateri tidak ditemukan']]);
        return;
    }

    [$d, $err] = normalizeInstructorInput($args, false);
    if ($err) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => $err]]);
        return;
    }

    $conflict = findInstructorConflict($db, $d, $id);
    if ($conflict) {
        http_response_code(409);
        echo json_encode(['data' => null, 'error' => ['message' => $conflict]]);
        return;
    }

    $db->beginTransaction();
    try {
        $db->prepare("
            UPDATE profiles SET full_name = ?, username = ?, email = ?, phone_number = ?, bio = ?, updated_at = CURRENT_TIMESTAMP(3)
            WHERE id = ?
        ")->execute([$d['full_name'], $d['username'], $d['email'], $d['phone_number'], $d['bio'], $id]);

        if ($d['password'] !== '') {
            $db->prepare("UPDATE users SET email = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?")
               ->execute([$d['email'], password_hash($d['password'], PASSWORD_BCRYPT), $id]);
            // Paksa login ulang di semua perangkat setelah password diganti
            $db->prepare("DELETE FROM auth_sessions WHERE user_id = ?")->execute([$id]);
        } else {
            $db->prepare("UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?")
               ->execute([$d['email'], $id]);
        }

        $db->prepare("
            INSERT INTO instructor_profiles (id, expertise, total_students, verified) VALUES (?, ?, 0, 1)
            ON DUPLICATE KEY UPDATE expertise = VALUES(expertise)
        ")->execute([$id, json_encode($d['expertise'], JSON_UNESCAPED_UNICODE)]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['data' => null, 'error' => ['message' => 'Gagal memperbarui akun pemateri: ' . $e->getMessage()]]);
        return;
    }

    echo json_encode(['data' => true, 'error' => null]);
}

/**
 * Rekap kehadiran pelajar (berdasarkan login harian) dalam rentang tanggal.
 * $push = true → hasilnya juga ditulis ke tab "Compile Absence" di Google Sheets.
 */
function handleAdminCompileAttendance(PDO $db, array $args, bool $push): void {
    AuthGuard::requireAdmin();

    [$start, $end, $err] = Attendance::parseRange((string)($args['start'] ?? ''), (string)($args['end'] ?? ''));
    if ($err) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => $err]]);
        return;
    }
    $group = isset($args['group']) && $args['group'] !== 'all' ? (string)$args['group'] : null;
    $includeUnapproved = !empty($args['include_unapproved']);

    $report = Attendance::compile($db, $start, $end, $group, $includeUnapproved);

    if (!$push) {
        echo json_encode(['data' => $report, 'error' => null], JSON_UNESCAPED_UNICODE);
        return;
    }

    $groupLabel = $group === null ? 'Semua grup' : ($group === '__no_group__' ? 'Siswa Biasa (tanpa grup)' : $group);
    $result = Attendance::pushToSheet(Attendance::toSheetPayload($report, $groupLabel));
    if (!$result['ok']) {
        http_response_code(502);
        echo json_encode(['data' => null, 'error' => ['message' => $result['message']]]);
        return;
    }
    echo json_encode([
        'data' => [
            'students'  => count($report['students']),
            'days'      => $report['total_days'],
            'sheet_url' => $result['sheet_url'] ?? (defined('ATTENDANCE_SHEET_URL') ? ATTENDANCE_SHEET_URL : null),
        ],
        'error' => null,
    ]);
}
