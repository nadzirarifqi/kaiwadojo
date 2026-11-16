# Rekap Kehadiran → Google Sheets

Halaman admin **Rekap Kehadiran** (`/rekap-kehadiran`, menu *Aktivitas*) merekap kehadiran pelajar
berdasarkan login, lalu bisa mengirim hasilnya ke tab **Compile Absence** di spreadsheet absensi.

## Cara kehadiran dihitung

Pelajar dihitung **hadir** pada suatu tanggal jika hari itu ia melakukan salah satu dari:

| Sumber | Tabel | Catatan |
|---|---|---|
| Login, buka aplikasi, aktif (heartbeat maks. 1x/10 menit) | `student_daily_logins` | dicatat langsung sejak fitur ini aktif |
| Login / pulihkan sesi | `auth_sessions.created_at`, `users.last_sign_in_at` | sesi terhapus saat logout; login terakhir saja |
| Terakhir aktif | `profiles.last_active_at` | hanya waktu terakhir |
| Setor kotoba | `user_kotoba_submissions.created_at` | |
| Kuis | `quiz_attempts.attempted_at` | |
| Reservasi kelas | `class_reservations.created_at` | |
| Membuat / mengubah rencana harian | `daily_missions.created_at`, `updated_at` | waktu dibuat, bukan tanggal rencananya |
| Menonton video materi | `lesson_progress.last_watched_at` | hanya tontonan terakhir per video |

- Jam di sel = **jam pertama aktif** hari itu, dalam zona `ATTENDANCE_TIMEZONE` (default `Asia/Jakarta`).
  Jam di database (UTC / zona MySQL) dikonversi otomatis, jadi aktivitas 00:00–07:00 WIB masuk tanggal yang benar.
- Riwayat **sebelum** fitur ini aktif hanya selengkap jejak aktivitas di atas. Pelajar yang hanya membuka aplikasi
  tanpa setor/kuis/rencana/video pada hari itu baru terdeteksi sejak fitur ini di-deploy.
- Tabel `student_daily_logins` dibuat otomatis oleh server. Jika user DB tidak punya hak `CREATE`,
  jalankan `database/attendance.sql` manual.
- Kategori: **Sangat Aktif** ≥ 80%, **Aktif** 60–79%, **Kurang Aktif** 40–59%, **Pasif** < 40%
  (ubah di `Attendance::category()` di `api/lib/attendance.php`).
- Yang direkap: akun `pelajar` berstatus `approved` (opsi di halaman untuk menyertakan akun belum diverifikasi).

## Isi tab "Compile Absence"

Setiap pengiriman **mengosongkan lalu menulis ulang** tab tersebut:

| Baris | Isi |
|---|---|
| 1–3 | Judul, periode, grup, waktu dibuat, jumlah siswa |
| 5 | Header: No, Nama Siswa, Username, Grup, Hadir (hari), % Hadir, Kategori, Terakhir Aktif, lalu satu kolom per tanggal (`Sen\n(2 Nov)`) |
| 6… | Satu baris per siswa. Sel tanggal berisi **jam masuk pertama** (mis. `07:42`, hijau) atau kosong = tidak hadir |
| terakhir | Total hadir per tanggal |

Tab lain di spreadsheet tidak disentuh.

## Pemasangan (sekali saja)

1. **Buat kunci rahasia** (string acak), mis. `php -r "echo bin2hex(random_bytes(24));"`.
2. Buka spreadsheet absensi → **Extensions → Apps Script**.
3. Hapus isi `Code.gs`, tempel seluruh isi [`docs/apps-script/compile-absence.gs`](apps-script/compile-absence.gs), simpan.
4. **Project Settings (ikon roda gigi) → Script properties → Add script property**:
   `SECRET` = kunci dari langkah 1.
5. **Deploy → New deployment** → tipe **Web app**:
   - *Execute as*: **Me** (akun pemilik spreadsheet)
   - *Who has access*: **Anyone**
   Izinkan akses saat diminta, lalu salin **Web app URL** (`https://script.google.com/macros/s/…/exec`).
   Akses "Anyone" aman karena setiap request wajib membawa `SECRET`.
6. Cek URL itu di browser — harus tampil `{"ok":true,"service":"kaiwadojo-compile-absence",...}`.
7. Di server, tambahkan ke `api/config.local.php` (file ini tidak masuk git):

   ```php
   define('ATTENDANCE_SHEET_WEBHOOK_URL', 'https://script.google.com/macros/s/XXXX/exec');
   define('ATTENDANCE_SHEET_SECRET', 'kunci-dari-langkah-1');
   define('ATTENDANCE_SHEET_URL', 'https://docs.google.com/spreadsheets/d/ID_SPREADSHEET/edit');
   ```

8. Buka **Rekap Kehadiran** di aplikasi → pilih rentang → **Kirim ke Google Sheets**.

Jika skrip Apps Script diubah, buat versi baru lewat **Deploy → Manage deployments → Edit → Version: New version**
agar URL tetap sama.

## Endpoint

| RPC (`api/rpc.php?fn=…`) | Akses | Fungsi |
|---|---|---|
| `admin_compile_attendance` | admin | `{start, end, group, include_unapproved}` → data rekap (JSON) |
| `admin_push_attendance_sheet` | admin | sama, lalu ditulis ke Google Sheets |
| `touch_attendance` | pengguna login | tandai hadir hari ini (dipanggil heartbeat aplikasi) |

Rentang maksimal 366 hari.
