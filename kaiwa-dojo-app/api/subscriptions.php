<?php
// api/subscriptions.php - Integrasi website pendaftaran langganan (bangunnegeri)
//
// Endpoint server-ke-server (wajib header X-Api-Key = SUBSCRIPTION_API_KEY):
//   GET  ?action=plans                          → daftar paket aktif
//   POST ?action=upsert                         → buat / perbarui langganan, balikan referral_code
//   GET  ?action=status&external_id=...         → status langganan & akun (atau &referral_code=...)
//
// Endpoint publik (dipakai halaman Register kaiwadojo):
//   GET  ?action=registration_config            → { required: bool }
//   POST ?action=verify  {email, referral_code} → cek kode sebelum mendaftar (dibatasi per IP)
//
// Spesifikasi lengkap: docs/INTEGRASI_LANGGANAN.md

require_once __DIR__ . '/config.php';
handle_cors();

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/subscriptions.php';

header('Content-Type: application/json');

function respond($data, int $status = 200, ?string $error = null): void {
    http_response_code($status);
    echo json_encode(['data' => $data, 'error' => $error ? ['message' => $error] : null], JSON_UNESCAPED_UNICODE);
    exit;
}

function requireApiKey(): void {
    if (!defined('SUBSCRIPTION_API_KEY') || SUBSCRIPTION_API_KEY === '') {
        respond(null, 503, 'Integrasi langganan belum dikonfigurasi di server kaiwadojo');
    }
    $given = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if ($given === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strcasecmp($k, 'X-Api-Key') === 0) { $given = $v; break; }
        }
    }
    if (!is_string($given) || !hash_equals(SUBSCRIPTION_API_KEY, $given)) {
        respond(null, 401, 'API key tidak valid');
    }
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = json_decode(file_get_contents('php://input') ?: '', true) ?: [];
$db = DB::get();

switch ($action) {
    /* ── Publik ─────────────────────────────────────────── */
    case 'registration_config':
        respond(['required' => Subscriptions::isRequired()]);

    case 'verify':
        if ($method !== 'POST') respond(null, 405, 'Gunakan POST');
        // Batasi percobaan per IP (memakai tabel login_attempts yang sudah ada)
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $identifier = 'subscription_verify';
        $stmt = $db->prepare("SELECT COUNT(*) FROM login_attempts WHERE identifier = ? AND ip = ? AND attempted_at > DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 15 MINUTE)");
        $stmt->execute([$identifier, $ip]);
        if ((int)$stmt->fetchColumn() >= 15) {
            respond(null, 429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
        }
        $db->prepare("INSERT INTO login_attempts (identifier, ip) VALUES (?, ?)")->execute([$identifier, $ip]);

        $check = Subscriptions::checkUsable($db, (string)($input['email'] ?? ''), (string)($input['referral_code'] ?? ''));
        if (!$check['ok']) {
            respond(['valid' => false, 'message' => $check['reason']]);
        }
        $plan = Subscriptions::findPlan($db, $check['subscription']['plan_code']);
        respond(['valid' => true, 'plan_name' => $plan['name'] ?? $check['subscription']['plan_code']]);

    /* ── Server-ke-server ───────────────────────────────── */
    case 'plans':
        // Boleh diakses publik atau server-to-server agar website pendaftaran & client bisa melihat paket aktif
        $rows = $db->query("SELECT code, name, description, group_name, duration_days, price FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order, name")->fetchAll();
        respond($rows);

    case 'status':
        requireApiKey();
        if (!empty($_GET['external_id'])) {
            $stmt = $db->prepare("SELECT * FROM subscriptions WHERE external_id = ? LIMIT 1");
            $stmt->execute([(string)$_GET['external_id']]);
        } elseif (!empty($_GET['referral_code'])) {
            $stmt = $db->prepare("SELECT * FROM subscriptions WHERE referral_code = ? LIMIT 1");
            $stmt->execute([Subscriptions::normalizeCode($_GET['referral_code'])]);
        } else {
            respond(null, 400, 'Sertakan external_id atau referral_code');
        }
        $sub = $stmt->fetch();
        if (!$sub) respond(null, 404, 'Langganan tidak ditemukan');
        respond(Subscriptions::present($db, $sub));

    case 'upsert':
        requireApiKey();
        if ($method !== 'POST') respond(null, 405, 'Gunakan POST');
        handleUpsert($db, $input);

    default:
        respond(null, 400, 'Action tidak valid');
}

function handleUpsert(PDO $db, array $in): void {
    $externalId = trim((string)($in['external_id'] ?? ''));
    $email      = Subscriptions::normalizeEmail($in['email'] ?? '');
    $fullName   = trim((string)($in['full_name'] ?? ''));
    $phone      = preg_replace('/[^0-9+]/', '', (string)($in['phone_number'] ?? ''));
    $planCode   = trim((string)($in['plan_code'] ?? ''));
    $payStatus  = strtolower(trim((string)($in['payment_status'] ?? 'pending')));

    $errors = [];
    if ($externalId === '' || strlen($externalId) > 100) $errors[] = 'external_id wajib (maks. 100 karakter)';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'email tidak valid';
    if ($fullName === '') $errors[] = 'full_name wajib';
    if (!in_array($payStatus, Subscriptions::PAYMENT_STATUSES, true)) $errors[] = 'payment_status harus salah satu: ' . implode(', ', Subscriptions::PAYMENT_STATUSES);
    $plan = $planCode !== '' ? Subscriptions::findPlan($db, $planCode) : null;
    if (!$plan) $errors[] = "plan_code '$planCode' tidak terdaftar di kaiwadojo";

    try {
        $startsAt = Subscriptions::toDateTime($in['starts_at'] ?? null) ?? date('Y-m-d H:i:s');
        $endsAt   = Subscriptions::toDateTime($in['ends_at'] ?? null);
    } catch (InvalidArgumentException $e) {
        $errors[] = $e->getMessage();
        $startsAt = $endsAt = null;
    }
    if (!$endsAt && $plan && !empty($plan['duration_days']) && $startsAt) {
        $endsAt = date('Y-m-d H:i:s', strtotime($startsAt . ' +' . (int)$plan['duration_days'] . ' days'));
    }
    if ($startsAt && $endsAt && strtotime($endsAt) < strtotime($startsAt)) $errors[] = 'ends_at tidak boleh sebelum starts_at';

    if ($errors) respond(null, 422, implode('; ', $errors));

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT * FROM subscriptions WHERE external_id = ? LIMIT 1 FOR UPDATE");
        $stmt->execute([$externalId]);
        $existing = $stmt->fetch();

        // Kode referral: pakai milik website pendaftaran jika dikirim, jika tidak buat otomatis
        $requestedCode = Subscriptions::normalizeCode($in['referral_code'] ?? '');
        $code = $existing['referral_code'] ?? null;
        if ($requestedCode !== '' && $requestedCode !== $code) {
            $dup = $db->prepare("SELECT 1 FROM subscriptions WHERE referral_code = ? AND external_id <> ? LIMIT 1");
            $dup->execute([$requestedCode, $externalId]);
            if ($dup->fetchColumn()) {
                $db->rollBack();
                respond(null, 409, "referral_code '$requestedCode' sudah dipakai langganan lain");
            }
            $code = $requestedCode;
        }
        if (!$code) $code = Subscriptions::generateCode($db);

        // Cari apakah email sudah terdaftar di profiles
        $stmtUser = $db->prepare("SELECT id FROM profiles WHERE LOWER(email) = ? AND role = 'pelajar' LIMIT 1");
        $stmtUser->execute([$email]);
        $userId = $stmtUser->fetchColumn() ?: null;

        // Jika user belum ada dan website pendaftaran menyertakan password, buat akun otomatis langsung aktif!
        $password = (string)($in['password'] ?? '');
        if (!$userId && $password !== '') {
            $rawUsername = strtolower(trim((string)($in['username'] ?? '')));
            if ($rawUsername === '') {
                $parts = explode('@', $email);
                $rawUsername = preg_replace('/[^a-z0-9_]/', '', $parts[0]);
            }
            // Pastikan username unik
            $finalUsername = $rawUsername;
            $uAttempt = 1;
            while (true) {
                $dupUser = $db->prepare("SELECT 1 FROM profiles WHERE LOWER(username) = ? LIMIT 1");
                $dupUser->execute([$finalUsername]);
                if (!$dupUser->fetchColumn()) break;
                $finalUsername = $rawUsername . $uAttempt;
                $uAttempt++;
            }

            $userId = DB::generateUuid();
            $passHash = password_hash($password, PASSWORD_BCRYPT);
            $institution = trim((string)($in['institution'] ?? ''));
            $matchedGroup = $plan['group_name'] ?? Subscriptions::resolveGroupFromInstitution($db, $institution);

            $meta = [
                'full_name'     => $fullName,
                'username'      => $finalUsername,
                'phone_number'  => $phone,
                'institution'   => $institution,
                'referral_code' => $code,
                'domisili'      => trim((string)($in['domisili'] ?? '')),
                'kelurahan'     => trim((string)($in['kelurahan'] ?? '')),
                'kecamatan'     => trim((string)($in['kecamatan'] ?? '')),
                'kabupaten'     => trim((string)($in['kabupaten'] ?? '')),
            ];

            $db->prepare("
                INSERT INTO users (id, email, password_hash, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
            ")->execute([$userId, $email, $passHash, json_encode($meta, JSON_UNESCAPED_UNICODE)]);

            $db->prepare("
                INSERT INTO profiles (id, full_name, username, email, phone_number, role, status, institution, group_name, referral_code, plan_code, payment_status, subscription_ends_at, domisili, kelurahan, kecamatan, kabupaten, streak_days, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'pelajar', 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
            ")->execute([
                $userId,
                $fullName,
                $finalUsername,
                $email,
                $phone ?: null,
                $institution ?: null,
                $matchedGroup,
                $code,
                $planCode,
                $payStatus,
                $endsAt,
                $meta['domisili'] ?: null,
                $meta['kelurahan'] ?: null,
                $meta['kecamatan'] ?: null,
                $meta['kabupaten'] ?: null,
            ]);
        }

        if ($existing) {
            $db->prepare("
                UPDATE subscriptions SET referral_code = ?, email = ?, full_name = ?, phone_number = ?, plan_code = ?,
                  payment_status = ?, starts_at = ?, ends_at = ?, user_id = COALESCE(user_id, ?), updated_at = CURRENT_TIMESTAMP(3)
                WHERE id = ?
            ")->execute([$code, $email, $fullName, $phone ?: null, $planCode, $payStatus, $startsAt, $endsAt, $userId, $existing['id']]);
            $id = $existing['id'];
            $activeUserId = $existing['user_id'] ?: $userId;
            if ($activeUserId) {
                Subscriptions::applyPlanToProfile($db, $activeUserId, $planCode, $payStatus, $endsAt);
            }
        } else {
            $id = DB::generateUuid();
            $db->prepare("
                INSERT INTO subscriptions (id, external_id, referral_code, email, full_name, phone_number, plan_code, payment_status, starts_at, ends_at, user_id, registered_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([$id, $externalId, $code, $email, $fullName, $phone ?: null, $planCode, $payStatus, $startsAt, $endsAt, $userId, $userId ? date('Y-m-d H:i:s') : null]);

            if ($userId) {
                Subscriptions::applyPlanToProfile($db, $userId, $planCode, $payStatus, $endsAt);
            }
        }

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        respond(null, 500, 'Gagal menyimpan langganan: ' . $e->getMessage());
    }

    $stmt = $db->prepare("SELECT * FROM subscriptions WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    respond(Subscriptions::present($db, $stmt->fetch()), $existing ? 200 : 201);
}
