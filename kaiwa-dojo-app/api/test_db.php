<?php
// api/test_db.php - Diagnostik Database & Sistem MariaDB Kaiwa Dojo

header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', '0');
error_reporting(E_ALL);

$diag = [
    'status'       => 'unknown',
    'timestamp'    => date('Y-m-d H:i:s T'),
    'php_version'  => PHP_VERSION,
    'server_sapi'  => php_sapi_name(),
    'extensions'   => [
        'pdo'        => extension_loaded('pdo'),
        'pdo_mysql'  => extension_loaded('pdo_mysql'),
        'json'       => extension_loaded('json'),
    ],
    'db'           => [],
    'tables'       => [],
    'write_test'   => [],
    'auth_header'  => [],
    'errors'       => [],
];

// 1. Cek Header Authorization
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTHORIZATION'] ?? '';
if (!$authHeader && function_exists('getallheaders')) {
    $h = getallheaders();
    foreach ($h as $k => $v) {
        if (strcasecmp($k, 'Authorization') === 0 || strcasecmp($k, 'X-Authorization') === 0) {
            $authHeader = $v;
            break;
        }
    }
}
$diag['auth_header'] = [
    'received' => !empty($authHeader),
    'preview'  => !empty($authHeader) ? substr($authHeader, 0, 15) . '...' : 'none',
];

// 2. Cek Koneksi Database
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/db.php';

try {
    $pdo = DB::get();
    $diag['db']['connected'] = true;

    $stmt = $pdo->query("SELECT VERSION() as ver, DATABASE() as db, USER() as usr, @@sql_mode as sql_mode");
    $info = $stmt->fetch();
    $diag['db']['version']  = $info['ver'] ?? 'unknown';
    $diag['db']['database'] = $info['db'] ?? 'unknown';
    $diag['db']['user']     = $info['usr'] ?? 'unknown';
    $diag['db']['sql_mode'] = $info['sql_mode'] ?? 'unknown';

    // 3. Cek Tabel & Hitung Baris
    $tablesStmt = $pdo->query("SHOW TABLES");
    $tables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);
    $diag['db']['table_count'] = count($tables);

    $importantTables = [
        'users', 'profiles', 'daily_missions', 'learning_streaks',
        'lesson_progress', 'chapter_settings', 'class_schedules',
        'class_reservations', 'kaiwa_groups', 'change_log'
    ];

    foreach ($importantTables as $tbl) {
        if (in_array($tbl, $tables)) {
            try {
                $count = (int)$pdo->query("SELECT COUNT(*) FROM `$tbl`")->fetchColumn();
                $diag['tables'][$tbl] = ['exists' => true, 'rows' => $count];
            } catch (Exception $e) {
                $diag['tables'][$tbl] = ['exists' => true, 'error' => $e->getMessage()];
            }
        } else {
            $diag['tables'][$tbl] = ['exists' => false, 'rows' => 0];
        }
    }

    // 4. Test Operasi UPDATE / INSERT (Write Test)
    try {
        $pdo->query("INSERT INTO change_log (table_name, event, new_row, created_at) VALUES ('__diag__', 'INSERT', '{\"test\":1}', CURRENT_TIMESTAMP(3))");
        $diag['write_test']['direct_sql_insert'] = 'SUCCESS';
    } catch (Exception $e) {
        $diag['write_test']['direct_sql_insert'] = 'FAILED: ' . $e->getMessage();
    }

    require_once __DIR__ . '/lib/query_builder.php';
    require_once __DIR__ . '/lib/policies.php';

    // Test QueryBuilder UPDATE
    $mockAdmin = [
        'id' => '00000000-0000-0000-0000-000000000099',
        'role' => 'admin',
        'status' => 'approved',
        'username' => 'kaiwahiroshima'
    ];
    try {
        $res = QueryBuilder::execute([
            'table' => 'profiles',
            'action' => 'update',
            'updates' => ['updated_at' => date('Y-m-d H:i:s')],
            'filters' => [['column' => 'id', 'op' => 'eq', 'value' => '00000000-0000-0000-0000-000000000099']]
        ], $mockAdmin);
        $diag['write_test']['query_builder_update_profiles'] = 'SUCCESS';
    } catch (Throwable $e) {
        $diag['write_test']['query_builder_update_profiles'] = 'FAILED: ' . $e->getMessage();
    }

    // Test QueryBuilder UPSERT
    try {
        $res = QueryBuilder::execute([
            'table' => 'chapter_settings',
            'action' => 'upsert',
            'onConflict' => 'bab_number',
            'row' => [
                'bab_number' => 999,
                'title' => '__Test Bab Diagnostik__',
                'is_hidden' => true,
                'has_video' => false,
                'duration_s1' => '10',
                'duration_s2' => '10',
                'duration_s3' => '10',
                'updated_at' => date('Y-m-d H:i:s')
            ]
        ], $mockAdmin);
        $diag['write_test']['query_builder_upsert_chapter'] = 'SUCCESS';
        // Cleanup test bab
        $pdo->query("DELETE FROM chapter_settings WHERE bab_number = 999");
    } catch (Throwable $e) {
        $diag['write_test']['query_builder_upsert_chapter'] = 'FAILED: ' . $e->getMessage();
    }

    // 5. Cek Schema.json
    $schemaPath = __DIR__ . '/lib/schema.json';
    if (file_exists($schemaPath)) {
        $schemaContent = file_get_contents($schemaPath);
        $schemaJson = json_decode($schemaContent, true);
        $diag['schema_json'] = [
            'exists' => true,
            'tables_defined' => count($schemaJson['tables'] ?? []),
            'readable' => !empty($schemaJson),
        ];
    } else {
        $diag['schema_json'] = ['exists' => false];
    }

    $diag['status'] = 'OK';
} catch (Throwable $e) {
    $diag['status'] = 'ERROR';
    $diag['errors'][] = [
        'message' => $e->getMessage(),
        'file'    => basename($e->getFile()),
        'line'    => $e->getLine(),
    ];
}

echo json_encode($diag, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
