<?php
// api/lib/attendance.php - Pencatatan & rekap kehadiran pelajar berdasarkan login / aktivitas harian
//
// Satu baris per pengguna per hari di `student_daily_logins`:
//   first_seen_at : pertama kali login / membuka aplikasi hari itu  → dipakai sebagai "jam hadir"
//   last_seen_at  : terakhir terlihat aktif hari itu
//   sign_in_count : berapa kali login dengan password hari itu
// Tanggal & jam memakai zona waktu ATTENDANCE_TIMEZONE (default Asia/Jakarta).

require_once __DIR__ . '/db.php';

class Attendance {
    /** Batas maksimum rentang rekap (hari) */
    public const MAX_RANGE_DAYS = 366;

    public static function tz(): DateTimeZone {
        $name = defined('ATTENDANCE_TIMEZONE') ? ATTENDANCE_TIMEZONE : 'Asia/Jakarta';
        try {
            return new DateTimeZone($name);
        } catch (Throwable $e) {
            return new DateTimeZone('Asia/Jakarta');
        }
    }

    /**
     * Catat kehadiran hari ini. Aman dipanggil berkali-kali (upsert).
     * Kegagalan tidak boleh mengganggu login, jadi semua error ditelan.
     */
    public static function record(PDO $db, string $userId, bool $isSignIn = false): void {
        if ($userId === '') return;
        try {
            $now = new DateTime('now', self::tz());
            $date = $now->format('Y-m-d');
            $ts = $now->format('Y-m-d H:i:s.v');
            $db->prepare("
                INSERT INTO student_daily_logins (user_id, login_date, first_seen_at, last_seen_at, sign_in_count)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at)),
                  sign_in_count = sign_in_count + VALUES(sign_in_count)
            ")->execute([$userId, $date, $ts, $ts, $isSignIn ? 1 : 0]);
        } catch (Throwable $e) {
            // abaikan: rekap kehadiran bukan bagian kritis dari login
        }
    }

    /** Kategori keaktifan berdasarkan persentase hadir (sama dengan istilah di sheet absensi). */
    public static function category(float $pct): string {
        if ($pct >= 80) return 'Sangat Aktif';
        if ($pct >= 60) return 'Aktif';
        if ($pct >= 40) return 'Kurang Aktif';
        return 'Pasif';
    }

    /**
     * Validasi rentang tanggal. Mengembalikan [DateTime start, DateTime end, error].
     */
    public static function parseRange(string $start, string $end): array {
        $tz = self::tz();
        $s = DateTime::createFromFormat('!Y-m-d', $start, $tz);
        $e = DateTime::createFromFormat('!Y-m-d', $end, $tz);
        if (!$s || !$e || $s->format('Y-m-d') !== $start || $e->format('Y-m-d') !== $end) {
            return [null, null, 'Format tanggal harus YYYY-MM-DD'];
        }
        if ($e < $s) {
            return [null, null, 'Tanggal akhir tidak boleh sebelum tanggal mulai'];
        }
        $days = (int)$s->diff($e)->days + 1;
        if ($days > self::MAX_RANGE_DAYS) {
            return [null, null, 'Rentang maksimal ' . self::MAX_RANGE_DAYS . ' hari'];
        }
        return [$s, $e, null];
    }

    /**
     * Rekap kehadiran pelajar dalam rentang tanggal.
     *
     * @param string|null $group  nama grup, '__no_group__' untuk siswa tanpa grup, null = semua
     * @param bool $includeUnapproved sertakan akun pending/rejected
     */
    public static function compile(PDO $db, DateTime $start, DateTime $end, ?string $group = null, bool $includeUnapproved = false): array {
        // Daftar tanggal
        $dates = [];
        $cursor = clone $start;
        while ($cursor <= $end) {
            $dates[] = $cursor->format('Y-m-d');
            $cursor->modify('+1 day');
        }
        $totalDays = count($dates);

        // Pelajar
        $where = ["p.role = 'pelajar'"];
        $params = [];
        if (!$includeUnapproved) {
            $where[] = "p.status = 'approved'";
        }
        if ($group === '__no_group__') {
            $where[] = "(p.group_name IS NULL OR p.group_name = '')";
        } elseif ($group !== null && $group !== '') {
            $where[] = 'p.group_name = ?';
            $params[] = $group;
        }
        $stmt = $db->prepare("
            SELECT p.id, p.full_name, p.username, p.email, p.phone_number, p.group_name, p.institution, p.status
            FROM profiles p
            WHERE " . implode(' AND ', $where) . "
            ORDER BY p.group_name IS NULL, p.group_name, p.full_name
        ");
        $stmt->execute($params);
        $students = $stmt->fetchAll();

        // Log harian dalam rentang
        $byUser = [];
        if ($students) {
            $stmt = $db->prepare("
                SELECT l.user_id, l.login_date, l.first_seen_at, l.last_seen_at, l.sign_in_count
                FROM student_daily_logins l
                JOIN profiles p ON p.id = l.user_id AND p.role = 'pelajar'
                WHERE l.login_date BETWEEN ? AND ?
            ");
            $stmt->execute([$dates[0], $dates[$totalDays - 1]]);
            foreach ($stmt->fetchAll() as $row) {
                $byUser[$row['user_id']][$row['login_date']] = $row;
            }
        }

        $rows = [];
        $presentPerDate = array_fill_keys($dates, 0);
        foreach ($students as $s) {
            $logs = $byUser[$s['id']] ?? [];
            $days = [];
            $present = 0;
            $lastSeen = null;
            foreach ($dates as $d) {
                if (isset($logs[$d])) {
                    $first = $logs[$d]['first_seen_at'];
                    $days[$d] = substr((string)$first, 11, 5); // HH:MM
                    $present++;
                    $presentPerDate[$d]++;
                    if ($lastSeen === null || $logs[$d]['last_seen_at'] > $lastSeen) {
                        $lastSeen = $logs[$d]['last_seen_at'];
                    }
                } else {
                    $days[$d] = null;
                }
            }
            $pct = $totalDays > 0 ? round($present / $totalDays * 100, 1) : 0;
            $rows[] = [
                'id'           => $s['id'],
                'full_name'    => $s['full_name'],
                'username'     => $s['username'],
                'email'        => $s['email'],
                'phone_number' => $s['phone_number'],
                'group_name'   => $s['group_name'],
                'institution'  => $s['institution'],
                'status'       => $s['status'],
                'present_days' => $present,
                'percentage'   => $pct,
                'category'     => self::category($pct),
                'last_seen_at' => $lastSeen ? substr((string)$lastSeen, 0, 16) : null,
                'days'         => $days,
            ];
        }

        return [
            'start'            => $dates[0],
            'end'              => $dates[$totalDays - 1],
            'timezone'         => self::tz()->getName(),
            'total_days'       => $totalDays,
            'dates'            => $dates,
            'present_per_date' => $presentPerDate,
            'students'         => $rows,
        ];
    }

    /** Nama hari singkat Indonesia + tanggal, mis. "Sen\n(2 Nov)" */
    public static function dayLabel(string $date): string {
        static $days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        static $months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $d = DateTime::createFromFormat('!Y-m-d', $date);
        return $days[(int)$d->format('w')] . "\n(" . (int)$d->format('j') . ' ' . $months[(int)$d->format('n') - 1] . ')';
    }

    public static function longDate(string $date): string {
        static $months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        $d = DateTime::createFromFormat('!Y-m-d', $date);
        return (int)$d->format('j') . ' ' . $months[(int)$d->format('n') - 1] . ' ' . $d->format('Y');
    }

    /**
     * Susun hasil rekap menjadi tabel 2D untuk tab "Compile Absence".
     * Sel tanggal berisi jam masuk pertama (HH:MM) atau kosong bila tidak hadir.
     */
    public static function toSheetPayload(array $report, string $groupLabel): array {
        $now = new DateTime('now', self::tz());
        $title = 'REKAP KEHADIRAN SISWA (BERDASARKAN LOGIN) — '
            . strtoupper(self::longDate($report['start'])) . ' s/d ' . strtoupper(self::longDate($report['end']));

        $fixedHeader = ['No', 'Nama Siswa', 'Username', 'Grup', 'Hadir (hari)', '% Hadir', 'Kategori', 'Terakhir Aktif'];
        $header = array_merge($fixedHeader, array_map([self::class, 'dayLabel'], $report['dates']));

        $values = [
            [$title],
            ['Periode:', self::longDate($report['start']) . ' – ' . self::longDate($report['end']), 'Jumlah hari:', $report['total_days'], 'Grup:', $groupLabel],
            ['Dibuat:', $now->format('d-m-Y H:i') . ' (' . $report['timezone'] . ')', 'Jumlah siswa:', count($report['students']), 'Isi sel tanggal:', 'jam masuk pertama hari itu; kosong = tidak hadir'],
            [],
            $header,
        ];

        $no = 1;
        foreach ($report['students'] as $s) {
            $row = [
                $no++,
                $s['full_name'],
                $s['username'],
                $s['group_name'] ?: 'Siswa Biasa',
                $s['present_days'],
                $s['percentage'] / 100,
                $s['category'],
                $s['last_seen_at'] ? str_replace('T', ' ', $s['last_seen_at']) : '',
            ];
            foreach ($report['dates'] as $d) {
                $row[] = $s['days'][$d] ?? '';
            }
            $values[] = $row;
        }

        // Baris total hadir per tanggal
        $totalRow = ['', 'TOTAL HADIR PER HARI', '', '', '', '', '', ''];
        foreach ($report['dates'] as $d) {
            $totalRow[] = $report['present_per_date'][$d];
        }
        $values[] = $totalRow;

        return [
            'sheet_name'       => defined('ATTENDANCE_SHEET_NAME') ? ATTENDANCE_SHEET_NAME : 'Compile Absence',
            'values'           => $values,
            'header_row'       => 5,                         // baris (1-based) judul kolom
            'first_date_col'   => count($fixedHeader) + 1,   // kolom (1-based) tanggal pertama
            'date_count'       => count($report['dates']),
            'student_count'    => count($report['students']),
            'percent_col'      => 6,
        ];
    }

    /** Kirim payload ke Google Apps Script web app yang terpasang di spreadsheet. */
    public static function pushToSheet(array $payload): array {
        $url = defined('ATTENDANCE_SHEET_WEBHOOK_URL') ? ATTENDANCE_SHEET_WEBHOOK_URL : '';
        $secret = defined('ATTENDANCE_SHEET_SECRET') ? ATTENDANCE_SHEET_SECRET : '';
        if ($url === '' || $secret === '') {
            return ['ok' => false, 'message' => 'Integrasi Google Sheets belum dikonfigurasi (ATTENDANCE_SHEET_WEBHOOK_URL / ATTENDANCE_SHEET_SECRET di config.local.php).'];
        }
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'message' => 'Ekstensi PHP cURL tidak tersedia di server.'];
        }

        $body = json_encode(['secret' => $secret] + $payload, JSON_UNESCAPED_UNICODE);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            // Apps Script membalas 302 ke googleusercontent.com; ikuti dengan GET untuk membaca hasilnya
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT        => 60,
        ]);
        $response = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            return ['ok' => false, 'message' => 'Gagal menghubungi Google Apps Script: ' . $err];
        }
        $json = json_decode((string)$response, true);
        if (!is_array($json)) {
            return ['ok' => false, 'message' => "Respons Apps Script tidak valid (HTTP $code). Pastikan web app di-deploy dengan akses \"Anyone\"."];
        }
        if (empty($json['ok'])) {
            return ['ok' => false, 'message' => 'Apps Script: ' . ($json['error'] ?? 'gagal menulis ke sheet')];
        }
        return ['ok' => true, 'message' => 'Berhasil', 'rows' => $json['rows'] ?? null, 'sheet_url' => $json['url'] ?? null];
    }
}
