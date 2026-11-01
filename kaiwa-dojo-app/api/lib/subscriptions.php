<?php
// api/lib/subscriptions.php - Logika langganan (integrasi website pendaftaran bangunnegeri)
//
// Alur:
//  1. Website pendaftaran mengirim data langganan (server-ke-server) → tabel `subscriptions`,
//     kaiwadojo membuat `referral_code` unik untuk dikirim ke pelanggan.
//  2. Pelanggan mendaftar di kaiwadojo dengan email + kode referral yang sama.
//  3. Akun dibuat berstatus `pending` (tetap menunggu persetujuan admin), ditautkan ke langganan,
//     dan grup kelasnya diambil dari paket (`subscription_plans.group_name`).

require_once __DIR__ . '/db.php';

class Subscriptions {
    public const PAYMENT_STATUSES = ['paid', 'pending', 'rejected', 'cancelled', 'refunded', 'expired'];
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I agar tidak tertukar

    /** Pendaftaran wajib memakai kode langganan? (atur di config.local.php) */
    public static function isRequired(): bool {
        return defined('REQUIRE_SUBSCRIPTION') && REQUIRE_SUBSCRIPTION === true;
    }

    public static function normalizeCode(?string $code): string {
        return substr(preg_replace('/[^A-Z0-9_-]/', '', strtoupper(trim((string)$code))), 0, 32);
    }

    public static function normalizeEmail(?string $email): string {
        return strtolower(trim((string)$email));
    }

    public static function generateCode(PDO $db): string {
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = 'KD-';
            for ($i = 0; $i < 6; $i++) {
                $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
            $stmt = $db->prepare("SELECT 1 FROM subscriptions WHERE referral_code = ? LIMIT 1");
            $stmt->execute([$code]);
            if (!$stmt->fetchColumn()) return $code;
        }
        throw new Exception('Gagal membuat kode referral unik, coba lagi');
    }

    public static function findPlan(PDO $db, string $planCode): ?array {
        $stmt = $db->prepare("SELECT * FROM subscription_plans WHERE code = ? LIMIT 1");
        $stmt->execute([$planCode]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Cari langganan yang boleh dipakai untuk mendaftar.
     * @return array{ok: bool, subscription?: array, reason?: string}
     */
    public static function checkUsable(PDO $db, string $email, string $code, bool $forUpdate = false): array {
        $email = self::normalizeEmail($email);
        $code = self::normalizeCode($code);
        if ($email === '' || $code === '') {
            return ['ok' => false, 'reason' => 'Email dan kode referral wajib diisi.'];
        }

        $sql = "SELECT * FROM subscriptions WHERE referral_code = ? LIMIT 1" . ($forUpdate ? " FOR UPDATE" : "");
        $stmt = $db->prepare($sql);
        $stmt->execute([$code]);
        $sub = $stmt->fetch();

        // Pesan sengaja disamakan agar kode tidak bisa ditebak dengan mencoba-coba email
        if (!$sub || self::normalizeEmail($sub['email']) !== $email) {
            return ['ok' => false, 'reason' => 'Kode referral tidak ditemukan atau tidak cocok dengan email ini.'];
        }
        if (!empty($sub['user_id'])) {
            return ['ok' => false, 'reason' => 'Kode referral ini sudah dipakai untuk mendaftar. Silakan login.'];
        }
        if ($sub['payment_status'] !== 'paid') {
            return ['ok' => false, 'reason' => 'Pembayaran langganan belum terkonfirmasi.'];
        }
        if (!empty($sub['ends_at']) && strtotime($sub['ends_at']) < time()) {
            return ['ok' => false, 'reason' => 'Masa langganan untuk kode ini sudah berakhir.'];
        }
        return ['ok' => true, 'subscription' => $sub];
    }

    /** Tautkan langganan ke akun & terapkan paket ke profil (dipanggil di dalam transaksi). */
    public static function linkToUser(PDO $db, array $sub, string $userId): void {
        $db->prepare("UPDATE subscriptions SET user_id = ?, registered_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?")
            ->execute([$userId, $sub['id']]);
        self::applyPlanToProfile($db, $userId, $sub['plan_code'], $sub['payment_status'] ?? 'paid', $sub['ends_at'] ?? null);
    }

    /** Paket menentukan akses: simpan plan_code, payment_status, subscription_ends_at & set grup kelas sesuai paket. */
    public static function applyPlanToProfile(PDO $db, string $userId, string $planCode, string $paymentStatus = 'paid', ?string $endsAt = null): void {
        $plan = self::findPlan($db, $planCode);
        $group = $plan && !empty($plan['group_name']) ? $plan['group_name'] : null;

        $sql = "UPDATE profiles SET plan_code = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP(3)";
        $params = [$planCode, $paymentStatus];

        if ($endsAt !== null) {
            $sql .= ", subscription_ends_at = ?";
            $params[] = $endsAt;
        }

        if ($group !== null) {
            $sql .= ", group_name = ?";
            $params[] = $group;
        }

        $sql .= " WHERE id = ?";
        $params[] = $userId;

        $db->prepare($sql)->execute($params);
    }

    /** Cocokkan instansi dengan nama/kata kunci kaiwa_groups (sama seperti logika pendaftaran lama). */
    public static function resolveGroupFromInstitution(PDO $db, ?string $institution): ?string {
        $inst = strtolower(trim((string)$institution));
        if ($inst === '') return null;
        $groups = $db->query("SELECT name, keywords FROM kaiwa_groups")->fetchAll();
        foreach ($groups as $g) {
            $name = strtolower(trim($g['name']));
            if ($name !== '' && strpos($inst, $name) !== false) return $g['name'];
            if (!empty($g['keywords'])) {
                foreach (array_map('trim', explode(',', $g['keywords'])) as $kw) {
                    if ($kw !== '' && strpos($inst, strtolower($kw)) !== false) return $g['name'];
                }
            }
        }
        return null;
    }

    /** Ubah tanggal masukan (YYYY-MM-DD atau ISO 8601) menjadi DATETIME MariaDB; null jika kosong. */
    public static function toDateTime($value): ?string {
        if ($value === null || $value === '') return null;
        $ts = strtotime((string)$value);
        if ($ts === false) throw new InvalidArgumentException("Format tanggal tidak valid: $value");
        return date('Y-m-d H:i:s', $ts);
    }

    /** Bentuk respons yang dikirim balik ke website pendaftaran. */
    public static function present(PDO $db, array $sub): array {
        $account = null;
        if (!empty($sub['user_id'])) {
            $stmt = $db->prepare("SELECT status, access_level, payment_status, subscription_ends_at FROM profiles WHERE id = ? LIMIT 1");
            $stmt->execute([$sub['user_id']]);
            $account = $stmt->fetch() ?: null;
        }
        return [
            'id'                     => $sub['id'],
            'external_id'            => $sub['external_id'],
            'referral_code'          => $sub['referral_code'],
            'email'                  => $sub['email'],
            'plan_code'              => $sub['plan_code'],
            'payment_status'         => $sub['payment_status'],
            'starts_at'              => $sub['starts_at'],
            'ends_at'                => $sub['ends_at'],
            'registered'             => !empty($sub['user_id']),
            'registered_at'          => $sub['registered_at'],
            'account_status'         => $account['status'] ?? null,               // pending / approved / rejected
            'account_payment_status' => $account['payment_status'] ?? null,       // paid / unpaid / pending / expired
            'access_level'           => $account['access_level'] ?? null,         // full / view_only
        ];
    }
}
