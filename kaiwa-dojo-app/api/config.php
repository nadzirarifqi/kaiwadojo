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
// Nilai rahasia (password, kunci, token) WAJIB diisi di config.local.php — file ini masuk git.
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', 'kaiw_database');
if (!defined('DB_USER')) define('DB_USER', 'kaiw_hiroshima6');
if (!defined('DB_PASS')) define('DB_PASS', '');
if (!defined('DB_PORT')) define('DB_PORT', 3306);

// ── JWT Secret Key (isi di config.local.php; kosong = server menolak login) ──
if (!defined('JWT_SECRET')) define('JWT_SECRET', '');
if (!defined('JWT_EXPIRY_SECONDS')) define('JWT_EXPIRY_SECONDS', 86400 * 7); // 7 hari

// ── Third Party Tokens (Disimpan aman di server, tidak bocor ke browser) ──
if (!defined('RESEND_API_KEY')) define('RESEND_API_KEY', '');
if (!defined('FONNTE_TOKEN'))   define('FONNTE_TOKEN', '');
// ── Admin utama: isi MASTER_ADMIN_USERNAME & MASTER_ADMIN_PASSWORD_HASH (bcrypt) di config.local.php ──
if (!defined('MASTER_ADMIN_USERNAME')) define('MASTER_ADMIN_USERNAME', '');
if (!defined('MASTER_ADMIN_PASSWORD_HASH')) define('MASTER_ADMIN_PASSWORD_HASH', '');
if (!defined('ADMIN_WA_NUMBER')) define('ADMIN_WA_NUMBER', '087875018001');

// ── Integrasi website pendaftaran langganan (bangunnegeri) ──
// Isi nilai sebenarnya di config.local.php (JANGAN di file ini, karena file ini masuk git).
if (!defined('SUBSCRIPTION_API_KEY')) define('SUBSCRIPTION_API_KEY', ''); // kosong = endpoint integrasi nonaktif
if (!defined('REQUIRE_SUBSCRIPTION')) define('REQUIRE_SUBSCRIPTION', false); // true = daftar wajib pakai kode langganan
// ── Rekap kehadiran → Google Sheets (tab "Compile Absence") ──
// Isi URL web app Apps Script & kunci rahasianya di config.local.php (lihat docs/REKAP_KEHADIRAN.md).
if (!defined('ATTENDANCE_TIMEZONE')) define('ATTENDANCE_TIMEZONE', 'Asia/Jakarta');
if (!defined('ATTENDANCE_SHEET_NAME')) define('ATTENDANCE_SHEET_NAME', 'Compile Absence');
if (!defined('ATTENDANCE_SHEET_WEBHOOK_URL')) define('ATTENDANCE_SHEET_WEBHOOK_URL', ''); // https://script.google.com/macros/s/.../exec
if (!defined('ATTENDANCE_SHEET_SECRET')) define('ATTENDANCE_SHEET_SECRET', '');           // sama dengan Script Property SECRET
if (!defined('ATTENDANCE_SHEET_URL')) define('ATTENDANCE_SHEET_URL', '');                 // link spreadsheet untuk tombol "Buka Sheets"

// ── Diagnostik api/test_db.php?key=... (kosong = nonaktif) ──
if (!defined('DIAGNOSTICS_KEY')) define('DIAGNOSTICS_KEY', '');

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
