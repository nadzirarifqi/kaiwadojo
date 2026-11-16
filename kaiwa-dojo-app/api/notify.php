<?php
// api/notify.php - Server-side Notification Proxy (Resend & Fonnte)

require_once __DIR__ . '/config.php';
handle_cors();

require_once __DIR__ . '/lib/auth_guard.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: [];

switch ($action) {
    case 'whatsapp':
        sendWhatsApp($input);
        break;
    case 'email':
        sendEmail($input);
        break;
    case 'validate_whatsapp':
        validateWhatsApp($input);
        break;
    default:
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Action notify tidak valid']]);
        break;
}

function sendWhatsApp(array $input): void {
    $target  = trim($input['target'] ?? '');
    $message = trim($input['message'] ?? '');

    if (!$target || !$message) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Target nomor WA dan pesan wajib diisi']]);
        return;
    }

    $ch = curl_init('https://api.fonnte.com/send');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => [
            'target'  => $target,
            'message' => $message,
        ],
        CURLOPT_HTTPHEADER     => [
            'Authorization: ' . FONNTE_TOKEN,
        ],
        CURLOPT_TIMEOUT        => 15,
    ]);

    $response = curl_exec($ch);
    $err = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        http_response_code(500);
        echo json_encode(['data' => null, 'error' => ['message' => "Gagal menghubungi Fonnte: $err"]]);
        return;
    }

    echo $response ?: json_encode(['status' => $httpCode === 200]);
}

function sendEmail(array $input): void {
    $to      = $input['to'] ?? [];
    $subject = $input['subject'] ?? '';
    $html    = $input['html'] ?? '';

    if (empty($to) || !$subject || !$html) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Penerima, subject, dan isi email wajib diisi']]);
        return;
    }

    if (is_string($to)) {
        $to = [$to];
    }

    $payload = [
        'from'    => 'Kaiwa Dojo <onboarding@resend.dev>',
        'to'      => $to,
        'subject' => $subject,
        'html'    => $html,
    ];

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . RESEND_API_KEY,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT        => 15,
    ]);

    $response = curl_exec($ch);
    $err = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        http_response_code(500);
        echo json_encode(['data' => null, 'error' => ['message' => "Gagal menghubungi Resend: $err"]]);
        return;
    }

    echo $response ?: json_encode(['id' => 'sent', 'status' => $httpCode]);
}

/**
 * Cek apakah nomor terdaftar di WhatsApp (Fonnte /validate).
 * Dipanggil dari halaman daftar; token Fonnte tetap di server.
 */
function validateWhatsApp(array $input): void {
    $target = preg_replace('/[^0-9]/', '', (string)($input['target'] ?? ''));
    if (strlen($target) < 9 || strlen($target) > 16) {
        http_response_code(400);
        echo json_encode(['data' => null, 'error' => ['message' => 'Nomor WhatsApp tidak valid']]);
        return;
    }
    if (FONNTE_TOKEN === '') {
        // Tanpa token, jangan blokir pendaftaran
        echo json_encode(['data' => ['registered' => null], 'error' => null]);
        return;
    }

    $ch = curl_init('https://api.fonnte.com/validate');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => ['target' => $target],
        CURLOPT_HTTPHEADER     => ['Authorization: ' . FONNTE_TOKEN],
        CURLOPT_TIMEOUT        => 15,
    ]);
    $response = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err || $response === false) {
        echo json_encode(['data' => ['registered' => null], 'error' => null]);
        return;
    }
    $json = json_decode((string)$response, true) ?: [];
    $registered = null;
    if (!empty($json['registered']) && is_array($json['registered'])) {
        $registered = true;
    } elseif (!empty($json['not_registered']) && is_array($json['not_registered'])) {
        $registered = false;
    }
    echo json_encode(['data' => ['registered' => $registered], 'error' => null]);
}
