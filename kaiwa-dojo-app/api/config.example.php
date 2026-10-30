<?php
/**
 * api/config.example.php - Template Konfigurasi Backend API Kaiwa Dojo
 * 
 * Untuk konfigurasi server produksi, Anda dapat membuat file `api/config.local.php`
 * atau mengedit nilai default di `api/config.php`.
 */

// ── 1. Kredensial Database MariaDB / MySQL ──
define('DB_HOST', 'localhost');
define('DB_NAME', 'kaiw_database');
define('DB_USER', 'kaiw_hiroshima6');
define('DB_PASS', 'kaiwahiroshima55');
define('DB_PORT', 3306);

// ── 2. Kunci Enkripsi JWT (Ganti dengan string acak yang kuat di server) ──
define('JWT_SECRET', 'kaiwa_dojo_jwt_secret_key_2026_super_secure_node_migration_!#');
define('JWT_EXPIRY_SECONDS', 86400 * 7); // Masa berlaku token (7 hari)

// ── 3. Integrasi Pihak Ketiga (Tersimpan aman di server, tidak bocor ke browser) ──
define('RESEND_API_KEY', 're_LmrWY7Zx_CBbpo6jtbLaMZxNepNozHxjE'); // Email approval via Resend
define('FONNTE_TOKEN',   'zhrUJEgA6bNS8EH3P2bb');                  // WhatsApp Gateway via Fonnte
define('ADMIN_WA_NUMBER', '087875018001');                          // Nomor WhatsApp Admin

// ── 4. Integrasi website pendaftaran langganan (bangunnegeri.inaconnext.it.com) ──
// Taruh di config.local.php. Buat kunci acak panjang, mis.: php -r "echo bin2hex(random_bytes(32));"
define('SUBSCRIPTION_API_KEY', 'GANTI_DENGAN_KUNCI_ACAK_64_KARAKTER'); // sama persis dengan yang dipakai server bangunnegeri
define('REQUIRE_SUBSCRIPTION', false); // ubah ke true setelah bangunnegeri sudah mengirim data langganan
