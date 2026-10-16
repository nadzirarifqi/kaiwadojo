<?php
// api/lib/policies.php - Rule Engine / RLS Policy Porting dari Supabase

class Policies {
    /**
     * Memeriksa apakah user berhak melakukan SELECT pada tabel
     */
    public static function canSelect(string $table, ?array $user): bool {
        // Semua tabel publik di Kaiwa Dojo dapat dibaca oleh client terautentikasi / publik
        return true;
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

        switch ($table) {
            case 'profiles':
                // Registration allows insert, but forces role='pelajar' and status='pending' unless admin
                if ($role !== 'admin') {
                    $row['role'] = 'pelajar';
                    if (!isset($row['status'])) {
                        $row['status'] = 'pending';
                    }
                }
                break;

            case 'user_kotoba_submissions':
                if ($userId && empty($row['user_id'])) {
                    $row['user_id'] = $userId;
                }
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

        switch ($table) {
            case 'profiles':
                // Port dari postgres trigger: protect_profile_privileges
                // Non-admin dilarang mengubah role atau status mereka sendiri!
                if ($role !== 'admin') {
                    unset($updates['role']);
                    unset($updates['status']);
                    // Kode referral hanya diisi saat pendaftaran
                    unset($updates['referral_code']);
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
                throw new Exception("Forbidden: Hanya admin yang dapat menghapus $table");

            case 'class_schedules':
                if ($role !== 'pemateri') {
                    throw new Exception("Forbidden: Akses hapus jadwal ditolak");
                }
                break;
        }
    }
}
