<?php
/**
 * api/config.example.php - Template Konfigurasi Backend API Kaiwa Dojo
 * 
 * Salin file ini menjadi `api/config.local.php` di server lalu isi nilai aslinya.
 * `config.local.php` sudah di-.gitignore — JANGAN menaruh password/kunci asli di file
 * ini maupun di `api/config.php`, karena keduanya masuk git.
 */

// ── 1. Kredensial Database MariaDB / MySQL ──
define('DB_HOST', 'localhost');
define('DB_NAME', 'kaiw_database');
define('DB_USER', 'kaiw_hiroshima6');
define('DB_PASS', 'GANTI_PASSWORD_DATABASE');
define('DB_PORT', 3306);

// ── 2. Kunci Enkripsi JWT — wajib, min. 16 karakter: php -r "echo bin2hex(random_bytes(32));" ──
define('JWT_SECRET', 'GANTI_DENGAN_STRING_ACAK_MIN_32_KARAKTER');
define('JWT_EXPIRY_SECONDS', 86400 * 7); // Masa berlaku token (7 hari)

// ── 3. Integrasi Pihak Ketiga (Tersimpan aman di server, tidak bocor ke browser) ──
define('RESEND_API_KEY', 're_GANTI_API_KEY_RESEND'); // Email approval via Resend
define('FONNTE_TOKEN',   'GANTI_TOKEN_FONNTE');                  // WhatsApp Gateway via Fonnte
define('ADMIN_WA_NUMBER', '087875018001');                          // Nomor WhatsApp Admin

// ── 4. Integrasi website pendaftaran langganan (bangunnegeri.inaconnext.it.com) ──
// Taruh di config.local.php. Buat kunci acak panjang, mis.: php -r "echo bin2hex(random_bytes(32));"
define('SUBSCRIPTION_API_KEY', 'GANTI_DENGAN_KUNCI_ACAK_64_KARAKTER'); // sama persis dengan yang dipakai server bangunnegeri
define('REQUIRE_SUBSCRIPTION', false); // ubah ke true setelah bangunnegeri sudah mengirim data langganan

// ── 4b. Admin utama (opsional) — login tanpa baris di tabel users ──
// Hash password: php -r "echo password_hash('PASSWORD_ADMIN', PASSWORD_BCRYPT);"
define('MASTER_ADMIN_USERNAME', 'GANTI_USERNAME_ADMIN');
define('MASTER_ADMIN_PASSWORD_HASH', '$2y$10$GANTI_DENGAN_HASH_BCRYPT');

// ── 5. Rekap kehadiran → Google Sheets (lihat docs/REKAP_KEHADIRAN.md) ──
define('ATTENDANCE_TIMEZONE', 'Asia/Jakarta');
define('ATTENDANCE_SHEET_NAME', 'Compile Absence');
define('ATTENDANCE_SHEET_WEBHOOK_URL', 'https://script.google.com/macros/s/ID_DEPLOYMENT/exec');
define('ATTENDANCE_SHEET_SECRET', 'GANTI_DENGAN_KUNCI_ACAK');      // php -r "echo bin2hex(random_bytes(24));"
define('ATTENDANCE_SHEET_URL', 'https://docs.google.com/spreadsheets/d/ID_SPREADSHEET/edit');
