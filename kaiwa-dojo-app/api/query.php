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
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['data' => null, 'error' => ['message' => $e->getMessage()]]);
}
