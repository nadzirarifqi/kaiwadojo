<?php
// api/config.php - Konfigurasi Database & Keamanan Kaiwa Dojo

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

// ── CORS & Environment ──
function handle_cors() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, x-app-version");
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
