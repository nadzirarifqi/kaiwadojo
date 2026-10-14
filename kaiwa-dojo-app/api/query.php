<?php
// api/query.php - Generic Database Query Endpoint

require_once __DIR__ . '/config.php';
handle_cors();

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth_guard.php';
require_once __DIR__ . '/lib/query_builder.php';

header('Content-Type: application/json');

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

if (!$payload || !isset($payload['table'])) {
    http_response_code(400);
    echo json_encode(['data' => null, 'error' => ['message' => 'Payload query tidak valid']]);
    exit;
}

$user = AuthGuard::getUser();

try {
    $result = QueryBuilder::execute($payload, $user);
    echo json_encode($result);
} catch (Throwable $e) {
    $msg = $e->getMessage();
    // Jika koneksi MySQL terputus atau timeout di server FastCGI, reset koneksi dan coba lagi 1x
    if (str_contains($msg, 'server has gone away') || str_contains($msg, 'Lost connection') || $e->getCode() == 2006 || $e->getCode() == 2013) {
        try {
            DB::reset();
            $result = QueryBuilder::execute($payload, $user);
            echo json_encode($result);
            exit;
        } catch (Throwable $retryErr) {
            http_response_code(400);
            echo json_encode(['data' => null, 'error' => ['message' => $retryErr->getMessage()]]);
            exit;
        }
    }
    http_response_code(400);
    echo json_encode(['data' => null, 'error' => ['message' => $e->getMessage()]]);
}
