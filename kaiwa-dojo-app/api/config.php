<?php
// api/config.php - Konfigurasi Database & Keamanan Kaiwa Dojo

ini_set('display_errors', '0');
error_reporting(E_ALL);

// Global Exception Handler agar selalu merespons format JSON jika terjadi crash
set_exception_handler(function(Throwable $e) {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    echo json_encode([
        'data' => null,
        'error' => [
            'message' => $e->getMessage(),
            'file' => basename($e->getFile()),
            'line' => $e->getLine()
        ]
    ]);
    exit;
});

// Jika ada config lokal/server khusus di luar git, utamakan itu
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

// ── Database Credentials ──
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', 'kaiw_database');
if (!defined('DB_USER')) define('DB_USER', 'kaiw_hiroshima6');
if (!defined('DB_PASS')) define('DB_PASS', 'kaiwahiroshima55');
if (!defined('DB_PORT')) define('DB_PORT', 3306);

// ── JWT Secret Key (Ganti dengan string random kuat di server produksi) ──
if (!defined('JWT_SECRET')) define('JWT_SECRET', 'kaiwa_dojo_jwt_secret_key_2026_super_secure_node_migration_!#');
if (!defined('JWT_EXPIRY_SECONDS')) define('JWT_EXPIRY_SECONDS', 86400 * 7); // 7 hari

// ── Third Party Tokens (Disimpan aman di server, tidak bocor ke browser) ──
if (!defined('RESEND_API_KEY')) define('RESEND_API_KEY', 're_LmrWY7Zx_CBbpo6jtbLaMZxNepNozHxjE');
if (!defined('FONNTE_TOKEN'))   define('FONNTE_TOKEN', 'zhrUJEgA6bNS8EH3P2bb');
if (!defined('ADMIN_WA_NUMBER')) define('ADMIN_WA_NUMBER', '087875018001');

// ── Integrasi website pendaftaran langganan (bangunnegeri) ──
// Isi nilai sebenarnya di config.local.php (JANGAN di file ini, karena file ini masuk git).
if (!defined('SUBSCRIPTION_API_KEY')) define('SUBSCRIPTION_API_KEY', 'kaiwa_bn_database_integration_x531'); // kosong = endpoint integrasi nonaktif
if (!defined('REQUIRE_SUBSCRIPTION')) define('REQUIRE_SUBSCRIPTION', false); // true = daftar wajib pakai kode langganan
// ── CORS & Environment ──
function handle_cors() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, x-app-version,  X-Api-Key");
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
