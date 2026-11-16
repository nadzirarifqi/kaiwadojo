# Rekap Kehadiran → Google Sheets

Halaman admin **Rekap Kehadiran** (`/rekap-kehadiran`, menu *Aktivitas*) merekap kehadiran pelajar
berdasarkan login, lalu bisa mengirim hasilnya ke tab **Compile Absence** di spreadsheet absensi.

## Cara kehadiran dihitung

- Pelajar dihitung **hadir** pada suatu tanggal jika hari itu ia login, memulihkan sesi saat membuka aplikasi,
  atau aktif di aplikasi (heartbeat, maks. 1x per 10 menit).
- Tercatat di tabel `student_daily_logins` (1 baris per pelajar per hari): jam pertama masuk, terakhir aktif,
  jumlah login dengan password. Tanggal memakai zona `ATTENDANCE_TIMEZONE` (default `Asia/Jakarta`).
- Tabel dibuat otomatis oleh server saat request pertama. Saat dibuat, riwayat lama diisi dari
  `auth_sessions`, `users.last_sign_in_at`, dan `profiles.last_active_at` — hanya sebagian, karena sebelumnya
  aplikasi tidak menyimpan riwayat login. Rekap yang lengkap berlaku sejak fitur ini di-deploy.
  Jika user DB tidak punya hak `CREATE`, jalankan `database/attendance.sql` manual.
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
