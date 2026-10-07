<?php
// api/lib/query_builder.php - SQL Translation Engine & Change Logger

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/policies.php';

class QueryBuilder {
    private static ?array $schema = null;

    public static function getSchema(): array {
        if (self::$schema === null) {
            $cachePhp = __DIR__ . '/schema.cache.php';
            if (file_exists($cachePhp)) {
                self::$schema = require $cachePhp;
            } else {
                $json = file_get_contents(__DIR__ . '/schema.json');
                self::$schema = json_decode($json, true) ?: [];
                if (!empty(self::$schema)) {
                    @file_put_contents($cachePhp, '<?php return ' . var_export(self::$schema, true) . ';');
                }
            }
        }
        return self::$schema;
    }

    public static function validateTable(string $table): array {
        $schema = self::getSchema();
        if (!isset($schema['tables'][$table])) {
            throw new Exception("Tabel tidak valid: $table");
        }
        return $schema['tables'][$table];
    }

    public static function logChange(string $table, string $event, ?array $newRow, ?array $oldRow = null): void {
        try {
            $db = DB::get();
            $stmt = $db->prepare("INSERT INTO change_log (table_name, event, new_row, old_row, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))");
            $stmt->execute([
                $table,
                $event,
                $newRow !== null ? json_encode($newRow, JSON_UNESCAPED_UNICODE) : null,
                $oldRow !== null ? json_encode($oldRow, JSON_UNESCAPED_UNICODE) : null
            ]);
        } catch (Throwable $e) {
            // Non-blocking logger
        }
    }

    private static function formatRowOutput(array $row, array $tableMeta): array {
        $out = [];
        foreach ($row as $k => $v) {
            if ($v === null) {
                $out[$k] = null;
                continue;
            }
            $colMeta = $tableMeta['columns'][$k] ?? null;
            $type = $colMeta['type'] ?? 'text';
            switch ($type) {
                case 'bool':
                    $out[$k] = (bool)$v;
                    break;
                case 'int':
                    $out[$k] = (int)$v;
                    break;
                case 'bigint':
                case 'decimal':
                    $out[$k] = is_numeric($v) ? (float)$v : $v;
                    break;
                case 'json':
                    if (is_string($v)) {
                        $decoded = json_decode($v, true);
                        $out[$k] = $decoded !== null ? $decoded : $v;
                    } else {
                        $out[$k] = $v;
                    }
                    break;
                case 'datetime':
                    // Ubah datetime database ke format ISO-8601 UTC
                    if (is_string($v)) {
                        $ts = strtotime($v . ' UTC');
                        $out[$k] = $ts ? gmdate('Y-m-d\TH:i:s.000\Z', $ts) : $v;
                    } else {
                        $out[$k] = $v;
                    }
                    break;
                default:
                    $out[$k] = $v;
            }
        }
        return $out;
    }

    private static function prepareValueInput($v, string $type) {
        if ($v === null) return null;
        if (is_bool($v)) {
            return $v ? 1 : 0;
        }
        switch ($type) {
            case 'bool':
                return $v ? 1 : 0;
            case 'int':
                return (int)$v;
            case 'bigint':
            case 'decimal':
                return is_numeric($v) ? $v : 0;
            case 'json':
                return is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE);
            case 'datetime':
                if (is_string($v)) {
                    $ts = strtotime($v);
                    return $ts ? gmdate('Y-m-d H:i:s', $ts) : $v;
                }
                return $v;
            default:
                if (is_array($v) || is_object($v)) {
                    return json_encode($v, JSON_UNESCAPED_UNICODE);
                }
                return $v;
        }
    }

    public static function execute(array $payload, ?array $user): array {
        $table  = $payload['table'] ?? '';
        $action = $payload['action'] ?? 'select';
        $meta   = self::validateTable($table);
        $db     = DB::get();

        switch ($action) {
            case 'select':
                Policies::canSelect($table, $user);
                return self::handleSelect($db, $table, $meta, $payload);

            case 'insert':
                $rows = isset($payload['rows']) ? $payload['rows'] : (isset($payload['row']) ? [$payload['row']] : []);
                if (empty($rows)) return ['data' => [], 'error' => null];
                return self::handleInsert($db, $table, $meta, $rows, $user, $payload);

            case 'update':
                $updates = $payload['updates'] ?? [];
                Policies::enforceUpdate($table, $updates, $user);
                $payload['updates'] = $updates;
                return self::handleUpdate($db, $table, $meta, $payload);

            case 'upsert':
                $rows = isset($payload['rows']) ? $payload['rows'] : (isset($payload['row']) ? [$payload['row']] : []);
                $onConflict = $payload['onConflict'] ?? ($meta['pk'][0] ?? 'id');
                return self::handleUpsert($db, $table, $meta, $rows, $onConflict, $user, $payload);

            case 'delete':
                Policies::enforceDelete($table, $user);
                $filters = $payload['filters'] ?? [];
                return self::handleDelete($db, $table, $meta, $filters);

            default:
                throw new Exception("Aksi tidak didukung: $action");
        }
    }

    private static function handleSelect(PDO $db, string $table, array $meta, array $payload): array {
        $columnsReq = $payload['columns'] ?? '*';
        $isCountHead = !empty($payload['count']) && !empty($payload['head']);
        $isCountOnly = !empty($payload['count']);
        
        $whereClauses = [];
        $params = [];
        self::buildWhere($meta, $payload['filters'] ?? [], $whereClauses, $params);
        $whereSql = $whereClauses ? ' WHERE ' . implode(' AND ', $whereClauses) : '';

        // Handle count query
        $totalCount = null;
        if ($isCountOnly || $isCountHead) {
            $stmtCount = $db->prepare("SELECT COUNT(*) as cnt FROM `$table`" . $whereSql);
            $stmtCount->execute($params);
            $totalCount = (int)$stmtCount->fetchColumn();
            if ($isCountHead) {
                return ['data' => null, 'count' => $totalCount, 'error' => null];
            }
        }

        // Deteksi ekspresi relasi: alias:table!fk(cols) atau table(cols) atau alias:table(cols)
        $relations = [];
        $cleanColumnsReq = $columnsReq;

        if (is_string($columnsReq) && $columnsReq !== '*') {
            $pattern = '/(?:([a-zA-Z0-9_]+):)?([a-zA-Z0-9_]+)(?:!([a-zA-Z0-9_]+))?\(([^)]*)\)/';
            if (preg_match_all($pattern, $columnsReq, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $m) {
                    $fullMatch   = $m[0];
                    $alias       = !empty($m[1]) ? $m[1] : $m[2];
                    $targetTable = $m[2];
                    $fkHint      = $m[3] ?? '';
                    $subCols     = trim($m[4] ?? '*');

                    // Cari foreign key column di tabel utama:
                    $fkCol = null;
                    if ($fkHint && preg_match('/_([a-zA-Z0-9_]+_id)_fkey/', $fkHint, $fkMatch)) {
                        $candidate = $fkMatch[1];
                        if (isset($meta['columns'][$candidate])) {
                            $fkCol = $candidate;
                        }
                    }

                    if (!$fkCol) {
                        $candidates = [
                            $alias . '_id',
                            rtrim($targetTable, 's') . '_id',
                            'user_id',
                            'student_id',
                            'instructor_id',
                            'course_id',
                            'schedule_id',
                            'lesson_id',
                            'section_id',
                        ];
                        foreach ($candidates as $cand) {
                            if (isset($meta['columns'][$cand])) {
                                $fkCol = $cand;
                                break;
                            }
                        }
                    }

                    if ($fkCol) {
                        $relations[] = [
                            'alias'       => $alias,
                            'targetTable' => $targetTable,
                            'subCols'     => $subCols,
                            'fkCol'       => $fkCol,
                        ];
                    }

                    // Hapus token relasi dari string columns utama
                    $cleanColumnsReq = str_replace($fullMatch, '', $cleanColumnsReq);
                }
            }
        }

        // Columns select
        $selectCols = '*';
        if ($cleanColumnsReq !== '*' && is_string($cleanColumnsReq)) {
            $reqList = array_filter(array_map('trim', explode(',', $cleanColumnsReq)));
            $validList = [];
            foreach ($reqList as $c) {
                if ($c === '*') {
                    $validList = ['*'];
                    break;
                }
                if (isset($meta['columns'][$c])) {
                    $validList[] = "`$c`";
                }
            }
            // Pastikan foreign key column relasi ikut diselect
            foreach ($relations as $rel) {
                if ($validList !== ['*'] && !in_array("`{$rel['fkCol']}`", $validList)) {
                    $validList[] = "`{$rel['fkCol']}`";
                }
            }
            if ($validList && $validList !== ['*']) {
                $selectCols = implode(', ', $validList);
            }
        }

        $sql = "SELECT $selectCols FROM `$table`" . $whereSql;

        // Order
        if (!empty($payload['order'])) {
            $orderParts = [];
            foreach ($payload['order'] as $o) {
                $col = $o['column'] ?? '';
                if (isset($meta['columns'][$col])) {
                    $dir = (!empty($o['ascending']) && $o['ascending'] === true) ? 'ASC' : 'DESC';
                    $orderParts[] = "`$col` $dir";
                }
            }
            if ($orderParts) {
                $sql .= ' ORDER BY ' . implode(', ', $orderParts);
            }
        }

        // Limit & Range
        if (!empty($payload['range']) && is_array($payload['range'])) {
            $from = (int)$payload['range'][0];
            $to   = (int)$payload['range'][1];
            $limit = max(1, $to - $from + 1);
            $sql .= " LIMIT $limit OFFSET $from";
        } elseif (!empty($payload['limit'])) {
            $limit = (int)$payload['limit'];
            $sql .= " LIMIT $limit";
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $formatted = array_map(fn($r) => self::formatRowOutput($r, $meta), $rows);

        // Hydrate relations jika diminta
        if (!empty($relations) && !empty($formatted)) {
            $schema = self::getSchema();
            foreach ($relations as $rel) {
                $targetTable = $rel['targetTable'];
                $alias       = $rel['alias'];
                $fkCol       = $rel['fkCol'];
                $subColsReq  = $rel['subCols'];

                $targetMeta  = $schema['tables'][$targetTable] ?? null;
                if (!$targetMeta) continue;

                $fkValues = array_values(array_unique(array_filter(array_column($formatted, $fkCol))));
                if (empty($fkValues)) {
                    foreach ($formatted as &$row) {
                        $row[$alias] = null;
                    }
                    unset($row);
                    continue;
                }

                $targetSelect = '*';
                if ($subColsReq !== '*' && !empty($subColsReq)) {
                    $subList = array_map('trim', explode(',', $subColsReq));
                    $validSub = ["`id`"];
                    foreach ($subList as $sc) {
                        if (isset($targetMeta['columns'][$sc])) {
                            $validSub[] = "`$sc`";
                        }
                    }
                    $targetSelect = implode(', ', array_unique($validSub));
                }

                $placeholders = implode(',', array_fill(0, count($fkValues), '?'));
                $targetStmt = $db->prepare("SELECT $targetSelect FROM `$targetTable` WHERE `id` IN ($placeholders)");
                $targetStmt->execute($fkValues);
                $targetRows = $targetStmt->fetchAll();

                $targetMap = [];
                foreach ($targetRows as $tr) {
                    $targetMap[$tr['id']] = self::formatRowOutput($tr, $targetMeta);
                }

                foreach ($formatted as &$row) {
                    $fkVal = $row[$fkCol] ?? null;
                    $row[$alias] = ($fkVal && isset($targetMap[$fkVal])) ? $targetMap[$fkVal] : null;
                }
                unset($row);
            }
        }

        if (!empty($payload['single'])) {
            if (count($formatted) === 0) {
                return ['data' => null, 'error' => ['message' => 'JSON object requested, multiple (or no) rows returned', 'code' => 'PGRST116']];
            }
            return ['data' => $formatted[0], 'count' => $totalCount, 'error' => null];
        }

        if (!empty($payload['maybeSingle'])) {
            return ['data' => $formatted[0] ?? null, 'count' => $totalCount, 'error' => null];
        }

        return ['data' => $formatted, 'count' => $totalCount, 'error' => null];
    }

    private static function handleInsert(PDO $db, string $table, array $meta, array $rows, ?array $user, array $payload = []): array {
        $insertedRows = [];
        $db->beginTransaction();
        try {
            foreach ($rows as $row) {
                Policies::enforceInsert($table, $row, $user);

                // Auto-generate UUID if primary key is uuid and not set
                foreach ($meta['columns'] as $colName => $colDef) {
                    if ($colDef['type'] === 'uuid' && empty($row[$colName])) {
                        $row[$colName] = DB::generateUuid();
                    }
                }

                $cols = [];
                $placeholders = [];
                $vals = [];
                foreach ($row as $k => $v) {
                    if (isset($meta['columns'][$k])) {
                        $cols[] = "`$k`";
                        $placeholders[] = "?";
                        $vals[] = self::prepareValueInput($v, $meta['columns'][$k]['type']);
                    }
                }

                if (empty($cols)) continue;

                $sql = "INSERT INTO `$table` (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $placeholders) . ")";
                $stmt = $db->prepare($sql);
                $stmt->execute($vals);

                // Trigger Streak update logic port if table is learning_streaks
                if ($table === 'learning_streaks' && !empty($row['student_id']) && !empty($row['date'])) {
                    self::triggerStreakUpdate($db, $row['student_id'], $row['date']);
                }

                self::logChange($table, 'INSERT', $row);
                $insertedRows[] = self::formatRowOutput($row, $meta);
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        if (!empty($payload['single'])) {
            return ['data' => $insertedRows[0] ?? null, 'error' => null];
        }
        if (!empty($payload['maybeSingle'])) {
            return ['data' => $insertedRows[0] ?? null, 'error' => null];
        }

        return ['data' => $insertedRows, 'error' => null];
    }

    private static function handleUpdate(PDO $db, string $table, array $meta, array $payload): array {
        $updates = $payload['updates'] ?? [];
        $filters = $payload['filters'] ?? [];
        if (empty($updates)) {
            return ['data' => [], 'error' => null];
        }

        $setClauses = [];
        $params = [];
        foreach ($updates as $k => $v) {
            if (isset($meta['columns'][$k])) {
                $setClauses[] = "`$k` = ?";
                $params[] = self::prepareValueInput($v, $meta['columns'][$k]['type']);
            }
        }

        if (empty($setClauses)) {
            return ['data' => [], 'error' => null];
        }

        $whereClauses = [];
        self::buildWhere($meta, $filters, $whereClauses, $params);
        $whereSql = $whereClauses ? ' WHERE ' . implode(' AND ', $whereClauses) : '';

        $sql = "UPDATE `$table` SET " . implode(', ', $setClauses) . $whereSql;
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        self::logChange($table, 'UPDATE', $updates);

        // Ambil data yang ter-update jika diminta select() atau single()
        $selectWhere = [];
        $selectParams = [];
        self::buildWhere($meta, $filters, $selectWhere, $selectParams);
        $selectWhereSql = $selectWhere ? ' WHERE ' . implode(' AND ', $selectWhere) : '';

        $stmtSelect = $db->prepare("SELECT * FROM `$table`" . $selectWhereSql);
        $stmtSelect->execute($selectParams);
        $rows = $stmtSelect->fetchAll();
        $formatted = array_map(fn($r) => self::formatRowOutput($r, $meta), $rows);

        if (!empty($payload['single'])) {
            return ['data' => $formatted[0] ?? null, 'error' => null];
        }
        if (!empty($payload['maybeSingle'])) {
            return ['data' => $formatted[0] ?? null, 'error' => null];
        }

        return ['data' => $formatted, 'error' => null];
    }

    private static function handleUpsert(PDO $db, string $table, array $meta, array $rows, string $onConflict, ?array $user, array $payload = []): array {
        $conflictCols = array_map('trim', explode(',', $onConflict));
        $upsertedRows = [];

        $db->beginTransaction();
        try {
            foreach ($rows as $row) {
                Policies::enforceInsert($table, $row, $user);

                foreach ($meta['columns'] as $colName => $colDef) {
                    if ($colDef['type'] === 'uuid' && empty($row[$colName])) {
                        $row[$colName] = DB::generateUuid();
                    }
                }

                $cols = [];
                $placeholders = [];
                $vals = [];
                $updateAssignments = [];

                foreach ($row as $k => $v) {
                    if (isset($meta['columns'][$k])) {
                        $cols[] = "`$k`";
                        $placeholders[] = "?";
                        $vals[] = self::prepareValueInput($v, $meta['columns'][$k]['type']);
                        if (!in_array($k, $conflictCols) && !in_array($k, $meta['pk'] ?? [])) {
                            $updateAssignments[] = "`$k` = VALUES(`$k`)";
                        }
                    }
                }

                if (empty($cols)) continue;

                $updateSql = $updateAssignments ? " ON DUPLICATE KEY UPDATE " . implode(', ', $updateAssignments) : " ON DUPLICATE KEY UPDATE `" . ($conflictCols[0] ?? $cols[0]) . "` = `" . ($conflictCols[0] ?? $cols[0]) . "`";

                $sql = "INSERT INTO `$table` (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $placeholders) . ")" . $updateSql;
                $stmt = $db->prepare($sql);
                $stmt->execute($vals);

                if ($table === 'learning_streaks' && !empty($row['student_id']) && !empty($row['date'])) {
                    self::triggerStreakUpdate($db, $row['student_id'], $row['date']);
                }

                self::logChange($table, 'UPSERT', $row);
                $upsertedRows[] = self::formatRowOutput($row, $meta);
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        if (!empty($payload['single'])) {
            return ['data' => $upsertedRows[0] ?? null, 'error' => null];
        }
        if (!empty($payload['maybeSingle'])) {
            return ['data' => $upsertedRows[0] ?? null, 'error' => null];
        }

        return ['data' => $upsertedRows, 'error' => null];
    }

    private static function handleDelete(PDO $db, string $table, array $meta, array $filters): array {
        $whereClauses = [];
        $params = [];
        self::buildWhere($meta, $filters, $whereClauses, $params);
        $whereSql = $whereClauses ? ' WHERE ' . implode(' AND ', $whereClauses) : '';

        if (!$whereSql) {
            throw new Exception("Pemberitahuan keamanan: DELETE tanpa WHERE dilarang");
        }

        $stmt = $db->prepare("DELETE FROM `$table`" . $whereSql);
        $stmt->execute($params);

        self::logChange($table, 'DELETE', ['filters' => $filters]);

        return ['data' => null, 'error' => null];
    }

    private static function buildWhere(array $meta, array $filters, array &$clauses, array &$params): void {
        foreach ($filters as $f) {
            $col = $f['column'] ?? '';
            $op  = strtolower($f['op'] ?? 'eq');
            $val = $f['value'] ?? null;

            if ($col === 'or' && is_string($val)) {
                // Parse or syntax: (id.eq.1,name.eq.foo)
                continue;
            }

            if (!isset($meta['columns'][$col])) continue;
            $type = $meta['columns'][$col]['type'];

            switch ($op) {
                case 'eq':
                    if ($val === null) {
                        $clauses[] = "`$col` IS NULL";
                    } else {
                        $clauses[] = "`$col` = ?";
                        $params[] = self::prepareValueInput($val, $type);
                    }
                    break;
                case 'neq':
                    if ($val === null) {
                        $clauses[] = "`$col` IS NOT NULL";
                    } else {
                        $clauses[] = "`$col` != ?";
                        $params[] = self::prepareValueInput($val, $type);
                    }
                    break;
                case 'gt':
                    $clauses[] = "`$col` > ?";
                    $params[] = self::prepareValueInput($val, $type);
                    break;
                case 'gte':
                    $clauses[] = "`$col` >= ?";
                    $params[] = self::prepareValueInput($val, $type);
                    break;
                case 'lt':
                    $clauses[] = "`$col` < ?";
                    $params[] = self::prepareValueInput($val, $type);
                    break;
                case 'lte':
                    $clauses[] = "`$col` <= ?";
                    $params[] = self::prepareValueInput($val, $type);
                    break;
                case 'like':
                case 'ilike':
                    $clauses[] = "`$col` LIKE ?";
                    $params[] = $val;
                    break;
                case 'in':
                    if (is_array($val) && count($val) > 0) {
                        $inPlaceholders = implode(',', array_fill(0, count($val), '?'));
                        $clauses[] = "`$col` IN ($inPlaceholders)";
                        foreach ($val as $v) {
                            $params[] = self::prepareValueInput($v, $type);
                        }
                    } else {
                        $clauses[] = "1=0";
                    }
                    break;
                case 'is':
                    if ($val === null) {
                        $clauses[] = "`$col` IS NULL";
                    } else {
                        $clauses[] = "`$col` = ?";
                        $params[] = self::prepareValueInput($val, $type);
                    }
                    break;
            }
        }
    }

    private static function triggerStreakUpdate(PDO $db, string $studentId, string $date): void {
        try {
            $cleanDate = substr($date, 0, 10);
            $stmtPrev = $db->prepare("SELECT date FROM learning_streaks WHERE student_id = ? AND date < ? ORDER BY date DESC LIMIT 1");
            $stmtPrev->execute([$studentId, $cleanDate]);
            $prevDate = $stmtPrev->fetchColumn();

            $isConsecutive = false;
            if ($prevDate) {
                $diff = (strtotime($cleanDate) - strtotime($prevDate)) / 86400;
                if (round($diff) === 1.0) {
                    $isConsecutive = true;
                }
            }

            if ($isConsecutive) {
                $db->prepare("UPDATE profiles SET streak_days = streak_days + 1, last_active_at = CURRENT_TIMESTAMP(3) WHERE id = ?")->execute([$studentId]);
            } else {
                $db->prepare("UPDATE profiles SET streak_days = 1, last_active_at = CURRENT_TIMESTAMP(3) WHERE id = ?")->execute([$studentId]);
            }
        } catch (Throwable $e) {}
    }
}
