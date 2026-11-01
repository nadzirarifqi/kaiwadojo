<?php
// api/lib/policies.php - Rule Engine / RLS Policy Porting dari Supabase

class Policies {
    /**
     * Tabel berisi data milik pribadi pelajar => kolom pemiliknya.
     * Pelajar hanya boleh mengubah/menghapus baris miliknya sendiri.
     */
    private const OWNER_COLUMNS = [
        'user_kotoba_submissions' => 'user_id',
        'lesson_progress'         => 'student_id',
        'learning_streaks'        => 'student_id',
        'daily_missions'          => 'student_id',
        'profiles'                => 'id',
    ];

    /**
     * Tabel yang barisnya diarsipkan ke deleted_rows_archive sebelum dihapus,
     * agar data pelajar selalu bisa dipulihkan.
     */
    public const ARCHIVE_ON_DELETE = ['user_kotoba_submissions'];

    /**
     * Kolom pemilik yang wajib dipakai sebagai filter untuk user ini,
     * atau null jika user bebas (admin/pemateri) atau tabel tidak dimiliki per-user.
     */
    public static function ownerColumn(string $table, ?array $user): ?string {
        $role = $user['role'] ?? 'guest';
        if ($role === 'admin' || $role === 'pemateri') {
            return null;
        }
        return self::OWNER_COLUMNS[$table] ?? null;
    }

    /**
     * Menambahkan filter kepemilikan pada UPDATE/DELETE agar pelajar
     * tidak dapat menyentuh data akun lain.
     */
    public static function scopeFiltersToOwner(string $table, array $filters, ?array $user): array {
        $ownerCol = self::ownerColumn($table, $user);
        if ($ownerCol === null) {
            return $filters;
        }
        $userId = $user['id'] ?? null;
        if (!$userId) {
            throw new Exception("Forbidden: Silakan login untuk mengubah data $table");
        }
        $filters[] = ['column' => $ownerCol, 'op' => 'eq', 'value' => $userId];
        return $filters;
    }

    /**
     * Memeriksa apakah user berhak melakukan SELECT pada tabel
     */
    public static function canSelect(string $table, ?array $user): bool {
        $role = $user['role'] ?? 'guest';
        // Data langganan berisi email & nomor HP pelanggan → hanya admin/pemateri
        if ($table === 'subscriptions' && $role !== 'admin' && $role !== 'pemateri') {
            throw new Exception("Forbidden: Data langganan hanya dapat dilihat admin");
        }
        // Tabel lain di Kaiwa Dojo dapat dibaca oleh client terautentikasi / publik
        return true;
    }

    /**
     * Pelajar dianggap berlangganan aktif jika payment_status = 'paid' dan belum melewati
     * subscription_ends_at. Akun yang belum bayar tetap bisa masuk dashboard, tetapi fitur
     * berbayar (video materi, setoran kotoba) dikunci.
     */
    public static function hasActiveSubscription(?string $userId): bool {
        if (!$userId) return false;
        $stmt = DB::get()->prepare("SELECT payment_status, subscription_ends_at FROM profiles WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $p = $stmt->fetch();
        if (!$p || ($p['payment_status'] ?? '') !== 'paid') return false;
        if (!empty($p['subscription_ends_at']) && strtotime($p['subscription_ends_at']) < time()) return false;
        return true;
    }

    /** Tabel yang hanya boleh ditulis admin (lewat query API) */
    private const ADMIN_WRITE_ONLY = ['subscriptions', 'subscription_plans'];

    /**
     * Kolom profil yang dikelola server/admin. Pelajar tidak boleh mengubahnya sendiri:
     * status persetujuan, peran, paket langganan, level akses, kode referral, dan grup
     * (grup menentukan akses materi & kelas, jadi dihitung server dari paket / instansi).
     */
    private static function sanitizeStudentProfileWrite(array &$data, ?array $user, bool $isInsert): void {
        $userId = $user['id'] ?? null;
        $targetId = $data['id'] ?? $userId;
        $existing = null;
        if ($targetId) {
            $stmt = DB::get()->prepare("SELECT id, plan_code FROM profiles WHERE id = ? LIMIT 1");
            $stmt->execute([$targetId]);
            $existing = $stmt->fetch() ?: null;
        }

        unset(
            $data['access_level'],
            $data['plan_code'],
            $data['group_name'],
            $data['payment_status'],
            $data['subscription_ends_at']
        );

        if ($existing) {
            // Baris sudah ada (upsert / update) → jangan sentuh kolom yang dikelola admin
            unset($data['role'], $data['status'], $data['referral_code']);
        } elseif ($isInsert) {
            $data['role'] = 'pelajar';
            $data['status'] = 'pending';
        }

        // Grup ikut instansi hanya untuk pelajar tanpa paket langganan
        if (empty($existing['plan_code']) && array_key_exists('institution', $data)) {
            require_once __DIR__ . '/subscriptions.php';
            $data['group_name'] = Subscriptions::resolveGroupFromInstitution(DB::get(), $data['institution']);
        }
    }

    /**
     * Memeriksa & memfilter kolom saat INSERT
     */
    public static function enforceInsert(string $table, array &$row, ?array $user): void {
        $role = $user['role'] ?? 'guest';
        $userId = $user['id'] ?? null;

        if ($role === 'admin') {
            return; // Admin bebas
        }

        if (in_array($table, self::ADMIN_WRITE_ONLY, true)) {
            throw new Exception("Forbidden: Hanya admin yang dapat mengubah $table");
        }

        switch ($table) {
            case 'profiles':
                if ($role === 'pemateri') {
                    // Pemateri boleh membuat akun pelajar, tetapi tidak boleh membuat admin
                    if (($row['role'] ?? 'pelajar') === 'admin') $row['role'] = 'pelajar';
                    break;
                }
                self::sanitizeStudentProfileWrite($row, $user, true);
                break;

            case 'user_kotoba_submissions':
                if ($userId && empty($row['user_id'])) {
                    $row['user_id'] = $userId;
                }
                if (($row['user_id'] ?? '') !== $userId) {
                    throw new Exception("Forbidden: Tidak dapat menyetor kotoba untuk akun lain");
                }
                if ($role === 'pelajar' && !self::hasActiveSubscription($userId)) {
                    throw new Exception("Forbidden: Fitur setoran kotoba memerlukan langganan aktif. Silakan lakukan pembayaran terlebih dahulu.");
                }
                self::validateKotobaFields($row, true);
                break;

            case 'lesson_progress':
            case 'learning_streaks':
            case 'daily_missions':
                if ($userId && empty($row['student_id'])) {
                    $row['student_id'] = $userId;
                }
                if ($role !== 'admin' && ($row['student_id'] ?? '') !== $userId) {
                    throw new Exception("Forbidden: Tidak dapat mengisi progress untuk akun lain");
                }
                break;

            case 'class_reservations':
                if ($userId && empty($row['user_id'])) {
                    $row['user_id'] = $userId;
                }
                if ($role !== 'admin' && ($row['user_id'] ?? '') !== $userId) {
                    throw new Exception("Forbidden: Tidak dapat membuat reservasi untuk akun lain");
                }
                if ($role === 'pelajar' && !self::hasActiveSubscription($userId)) {
                    throw new Exception("Forbidden: Reservasi kelas memerlukan langganan aktif. Silakan lakukan pembayaran terlebih dahulu.");
                }
                break;

            case 'feedback_suggestions':
                if ($userId && empty($row['user_id'])) {
                    $row['user_id'] = $userId;
                }
                break;

            case 'announcements':
            case 'chapter_settings':
            case 'kaiwa_groups':
            case 'broadcast_logs':
                if ($role !== 'admin' && $role !== 'pemateri') {
                    throw new Exception("Forbidden: Akses ditolak untuk tabel $table");
                }
                break;

            case 'class_schedules':
                if ($role !== 'admin' && $role !== 'pemateri') {
                    throw new Exception("Forbidden: Hanya admin/pemateri yang dapat membuat jadwal");
                }
                if ($role === 'pemateri' && empty($row['instructor_id'])) {
                    $row['instructor_id'] = $userId;
                }
                break;
        }
    }

    /**
     * Memeriksa & memfilter payload saat UPDATE
     */
    public static function enforceUpdate(string $table, array &$updates, ?array $user): void {
        $role = $user['role'] ?? 'guest';
        $userId = $user['id'] ?? null;

        if ($role === 'admin') {
            return; // Admin bebas
        }

        if (in_array($table, self::ADMIN_WRITE_ONLY, true)) {
            throw new Exception("Forbidden: Hanya admin yang dapat mengubah $table");
        }

        switch ($table) {
            case 'user_kotoba_submissions':
                self::validateKotobaFields($updates, false);
                break;

            case 'profiles':
                // Port dari postgres trigger: protect_profile_privileges
                // Non-admin dilarang mengubah role, status, kode referral, paket, dan level akses
                unset($updates['role'], $updates['status'], $updates['referral_code'], $updates['plan_code'], $updates['access_level']);
                if ($role !== 'pemateri') {
                    self::sanitizeStudentProfileWrite($updates, $user, false);
                }
                break;

            case 'announcements':
            case 'chapter_settings':
            case 'kaiwa_groups':
            case 'broadcast_logs':
            case 'feedback_suggestions':
                if ($role !== 'admin' && $role !== 'pemateri') {
                    throw new Exception("Forbidden: Hanya admin yang dapat mengubah $table");
                }
                break;

            case 'class_schedules':
                if ($role !== 'admin' && $role !== 'pemateri') {
                    throw new Exception("Forbidden: Hanya pemateri/admin yang dapat mengubah jadwal");
                }
                break;
        }
    }

    /**
     * Memeriksa apakah user berhak melakukan DELETE
     */
    public static function enforceDelete(string $table, ?array $user): void {
        $role = $user['role'] ?? 'guest';
        if ($role === 'admin') {
            return;
        }

        switch ($table) {
            case 'announcements':
            case 'chapter_settings':
            case 'kaiwa_groups':
            case 'broadcast_logs':
            case 'feedback_suggestions':
            case 'subscriptions':
            case 'subscription_plans':
                throw new Exception("Forbidden: Hanya admin yang dapat menghapus $table");

            case 'class_schedules':
                if ($role !== 'pemateri') {
                    throw new Exception("Forbidden: Akses hapus jadwal ditolak");
                }
                break;
        }
    }

    /**
     * Validasi dasar isian Setoran Kotoba (lapisan kedua setelah validasi di aplikasi):
     * huruf Jepang hanya kana/kanji, cara baca hanya huruf latin, arti berupa kata.
     * $requireAll = true saat INSERT; saat UPDATE hanya kolom yang dikirim yang diperiksa.
     */
    private static function validateKotobaFields(array &$data, bool $requireAll): void {
        if ($requireAll || array_key_exists('japanese', $data)) {
            $jp = trim((string)($data['japanese'] ?? ''));
            if (class_exists('Normalizer')) {
                $jp = Normalizer::normalize($jp, Normalizer::FORM_KC) ?: $jp;
            }
            $jp = preg_replace('/\s+/u', ' ', $jp);
            $hasJapanese = preg_match('/[\p{Hiragana}\p{Katakana}\p{Han}]/u', $jp);
            $onlyAllowed = preg_match('/^[\p{Hiragana}\p{Katakana}\p{Han}ー々〆〜・、。「」~!?0-9 ]+$/u', $jp);
            if ($jp === '' || !$hasJapanese || !$onlyAllowed || mb_strlen($jp) > 30) {
                throw new Exception("Huruf Jepang tidak valid: hanya boleh hiragana, katakana, atau kanji (maks. 30 karakter).");
            }
            $data['japanese'] = $jp;
        }

        if ($requireAll || array_key_exists('romaji', $data)) {
            $romaji = trim(preg_replace('/\s+/u', ' ', (string)($data['romaji'] ?? '')));
            if ($romaji === '' || !preg_match("/^[a-zA-ZāīūēōâîûêôĀĪŪĒŌ\s'’\-.]+$/u", $romaji) || !preg_match('/[aiueoāīūēōâîûêô]/iu', $romaji) || mb_strlen($romaji) > 60) {
                throw new Exception("Cara baca tidak valid: tulis dengan huruf latin (romaji).");
            }
            $data['romaji'] = $romaji;
        }

        if ($requireAll || array_key_exists('meaning', $data)) {
            $meaning = trim(preg_replace('/\s+/u', ' ', (string)($data['meaning'] ?? '')));
            if ($meaning === '' || !preg_match('/\p{Latin}{2,}/u', $meaning) || mb_strlen($meaning) > 100) {
                throw new Exception("Arti tidak valid: tulis arti kosakata dengan huruf latin (maks. 100 karakter).");
            }
            $data['meaning'] = $meaning;
        }
    }
}
