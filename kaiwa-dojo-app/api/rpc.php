<?php
// api/rpc.php - Stored Functions / RPC Handler

require_once __DIR__ . '/config.php';
handle_cors();

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth_guard.php';

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
