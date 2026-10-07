<?php
// api/changes.php - Realtime Polling Endpoint for change_log

require_once __DIR__ . '/config.php';
handle_cors();

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth_guard.php';

header('Content-Type: application/json');

$since = (int)($_GET['since'] ?? 0);
$tablesStr = trim($_GET['tables'] ?? '');

$db = DB::get();

// Pembersihan berkala change_log lebih lama dari 2 jam (dijalankan maksimal setiap 15 menit, bukan di tiap polling)
$cleanFlag = sys_get_temp_dir() . '/kaiwa_changelog_clean.ts';
$lastClean = file_exists($cleanFlag) ? (int)@file_get_contents($cleanFlag) : 0;
if (time() - $lastClean > 900) {
    try {
        $db->query("DELETE FROM change_log WHERE created_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 2 HOUR)");
        @file_put_contents($cleanFlag, (string)time());
    } catch (Exception $e) {}
}

$where = ["id > ?"];
$params = [$since];

if ($tablesStr !== '') {
    $tableList = array_map('trim', explode(',', $tablesStr));
    $validTables = [];
    foreach ($tableList as $t) {
        if (preg_match('/^[a-zA-Z0-9_]+$/', $t)) {
            $validTables[] = $t;
        }
    }
    if ($validTables) {
        $inPlaceholders = implode(',', array_fill(0, count($validTables), '?'));
        $where[] = "table_name IN ($inPlaceholders)";
        $params = array_merge($params, $validTables);
    }
}

$sql = "SELECT id, table_name, event, new_row, old_row, created_at FROM change_log WHERE " . implode(' AND ', $where) . " ORDER BY id ASC LIMIT 100";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$formatted = [];
$maxId = $since;

foreach ($rows as $r) {
    $id = (int)$r['id'];
    if ($id > $maxId) {
        $maxId = $id;
    }
    $formatted[] = [
        'id'         => $id,
        'table'      => $r['table_name'],
        'event'      => $r['event'],
        'new'        => !empty($r['new_row']) && is_string($r['new_row']) ? json_decode($r['new_row'], true) : $r['new_row'],
        'old'        => !empty($r['old_row']) && is_string($r['old_row']) ? json_decode($r['old_row'], true) : $r['old_row'],
        'created_at' => $r['created_at']
    ];
}

// Jika request pertama kali (since=0), ambil ID tertinggi saat ini agar tidak mendownload riwayat lama
if ($since === 0 && count($formatted) === 0) {
    $maxId = (int)$db->query("SELECT IFNULL(MAX(id), 0) FROM change_log")->fetchColumn();
}

echo json_encode([
    'data'    => $formatted,
    'last_id' => $maxId,
    'error'   => null
]);
