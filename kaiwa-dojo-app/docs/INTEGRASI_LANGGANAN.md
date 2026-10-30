# Integrasi Langganan: bangunnegeri → kaiwadojo

Dokumen ini adalah panduan teknis bagi tim pengembang website pendaftaran **bangunnegeri.inaconnext.it.com**.
Kaiwa Dojo (`kaiwadojo.inaconnext.it.com`) adalah server utama tempat materi pembelajaran dan akses kelas berlangsung. Website pendaftaran mengirimkan data transaksi langganan ke API Kaiwa Dojo, dan Kaiwa Dojo secara otomatis mengatur hak akses pengguna.

---

## 1. Daftar 8 Paket Resmi & Harga (Pricing List)

Daftar paket telah dikonfigurasi di database Kaiwa Dojo (`subscription_plans`). Gunakan kolom `code` di bawah sebagai nilai `plan_code` saat memanggil API.

| Kategori | Paket & Durasi | `plan_code` | Harga (IDR) | Durasi (Hari) |
|---|---|---|---|---|
| **Minna 1 Mandiri Online** | Per Bulan | `minna1-mandiri-1bln` | Rp 200.000 | 30 |
| **Minna 1 Mandiri Online** | Per 6 Bulan | `minna1-mandiri-6bln` | Rp 1.000.000 | 180 |
| **Minna 1 Mandiri Online** | Per Tahun | `minna1-mandiri-1thn` | Rp 1.500.000 | 365 |
| **Minna 1 Kaiwa Online** | Per Bulan | `minna1-kaiwa-1bln` | Rp 250.000 | 30 |
| **Minna 1 Kaiwa Online** | Per 6 Bulan | `minna1-kaiwa-6bln` | Rp 1.400.000 | 180 |
| **Minna 1 Kaiwa Online** | Per Tahun | `minna1-kaiwa-1thn` | Rp 1.800.000 | 365 |
| **Minna 1&2 Mandiri Online** | Per Tahun | `minna1-2-mandiri-1thn` | Rp 2.500.000 | 365 |
| **Minna 1&2 Kaiwa Online** | Per Tahun | `minna1-2-kaiwa-1thn` | Rp 3.500.000 | 365 |

> **Catatan Grup Akses:**
> - Siswa dengan paket **Mandiri** dimasukkan ke grup materi mandiri.
> - Siswa dengan paket **Kaiwa** mendapatkan akses kelas live interaktif sesuai paketnya.

---

## 2. Koneksi & Keamanan API

| Parameter | Nilai |
|---|---|
| **Base Endpoint** | `https://kaiwadojo.inaconnext.it.com/api/subscriptions.php` |
| **Header Autentikasi** | `X-Api-Key: <SUBSCRIPTION_API_KEY>` |
| **Content-Type** | `application/json` |
| **Klien Pemanggil** | **Backend Server bangunnegeri** (PHP/Node.js/Laravel, dll.). Kunci API tidak boleh dibocorkan ke frontend JavaScript. |

Kunci `SUBSCRIPTION_API_KEY` diset di file server `api/config.local.php` Kaiwa Dojo.

---

## 3. Sinkronisasi Pembayaran: `POST ?action=upsert`

Panggil webhook ini ketika user selesai mengisi formulir pendaftaran / menyelesaikan pembayaran di `bangunnegeri.inaconnext.it.com`.

### Parameter Body JSON

| Field | Tipe | Wajib | Keterangan |
|---|---|:---:|---|
| `external_id` | string | ✅ | ID transaksi/invoice unik dari bangunnegeri (maks. 100 char) |
| `email` | string | ✅ | Email user (harus valid) |
| `full_name` | string | ✅ | Nama lengkap pendaftar |
| `phone_number` | string | ✅ | Nomor WhatsApp pendaftar (contoh: `081234567890`) |
| `plan_code` | string | ✅ | Salah satu dari 8 kode paket di atas |
| `payment_status` | string | ✅ | `paid` (lunas), `pending` (menunggu), `unpaid` (belum bayar), `expired`, atau `cancelled` |
| `password` | string | 🔘 | *(Opsional)* Jika dikirimkan dan user belum ada di Kaiwa Dojo, akun user dan profile langsung dibuatkan otomatis. |
| `starts_at` | string | 🔘 | Tanggal mulai (`YYYY-MM-DD`). Default: hari ini |
| `ends_at` | string | 🔘 | Tanggal kedaluwarsa (`YYYY-MM-DD`). Jika kosong, otomatis dihitung berdasarkan `duration_days` paket |
| `referral_code`| string | 🔘 | *(Opsional)* Jika ingin menentukan kode referral custom |

### Contoh Request (User Selesai Bayar Lunas)

```bash
curl -X POST -H "X-Api-Key: YOUR_SECRET_API_KEY" \
  -H "Content-Type: application/json" \
  https://kaiwadojo.inaconnext.it.com/api/subscriptions.php?action=upsert \
  -d '{
    "external_id": "BN-INV-2026103001",
    "email": "santoso@gmail.com",
    "full_name": "Santoso Pratama",
    "phone_number": "081234567890",
    "plan_code": "minna1-kaiwa-1bln",
    "payment_status": "paid",
    "password": "PasswordUser123!"
  }'
```

### Contoh Response Sukses (`200 OK` / `201 Created`)

```json
{
  "data": {
    "id": 14,
    "external_id": "BN-INV-2026103001",
    "referral_code": "KD-9X4A7B",
    "email": "santoso@gmail.com",
    "plan_code": "minna1-kaiwa-1bln",
    "plan_name": "Minna 1 Kaiwa Online (1 Bulan)",
    "price": 250000,
    "payment_status": "paid",
    "starts_at": "2026-10-30 00:00:00",
    "ends_at": "2026-11-29 23:59:59",
    "registered": true,
    "account_status": "approved",
    "access_level": "full"
  },
  "error": null
}
```

---

## 4. Mekanisme Akses & Subscription Wall di Kaiwa Dojo

1. **User Lunas (`payment_status = 'paid'` & `subscription_ends_at >= NOW()`):**
   - User dapat mengakses seluruh modul materi, bab kotoba, dan sesi pembelajaran sesuai kelasnya.
2. **User Belum Bayar / Expired (`payment_status = 'unpaid'` / `expired`):**
   - Saat login ke Kaiwa Dojo, user otomatis dihadang oleh **Subscription Blocked Screen** (Subscription Wall).
   - Layar menampilkan informasi paket, status kedaluwarsa, tombol untuk menyelesaikan pembayaran ke `bangunnegeri.inaconnext.it.com`, serta kontak WhatsApp Admin.
3. **Kontrol Admin Manual:**
   - Admin dapat membuka menu **Manajemen Siswa** di dashboard Kaiwa Dojo.
   - Admin memiliki tombol **Bayar** pada setiap siswa untuk mengubah status pembayaran (`paid`, `pending`, `unpaid`, `expired`), memilih 8 paket langganan, dan memperpanjang masa aktif secara langsung (`+1 Bulan`, `+6 Bulan`, `+1 Tahun`).
