# Panduan Lengkap Setup Google Cloud Console (Google Login Gate) - Tridhata Agro ERP

Dokumen ini adalah panduan langkah demi langkah bagi tim PT Tridhata Agro Inovasi untuk mengatur **Google Single Sign-On (SSO)** di Google Cloud Platform (GCP) Console agar fitur **"Masuk dengan Akun Google"** di ERP Laravel dapat berfungsi sempurna, baik di lingkungan lokal (`localhost:8000`) maupun di server VPS produksi.

---

## 1. Masuk ke Google Cloud Console

1. Buka browser dan kunjungi [Google Cloud Console](https://console.cloud.google.com/).
2. Login menggunakan akun Google / Google Workspace resmi perusahaan (`@tridhata.com` atau akun pengelola sistem).
3. Di bilah navigasi atas, klik **Pilih Proyek (Select a project)** > klik **Proyek Baru (New Project)**.
   - **Nama Proyek:** `Tridhata Agro ERP` (atau `tridhata-ops`)
   - **Organization:** Pilih organisasi Tridhata jika ada, atau biarkan `No organization`.
   - Klik **Create**.

---

## 2. Mengaktifkan Google Identity API

1. Buka menu navigasi kiri (hamburger menu ☰) > pilih **APIs & Services** > **Library**.
2. Di kolom pencarian, cari `Google People API` atau `Google Identity Services`.
3. Klik **Google People API** lalu klik tombol **Enable** (Aktifkan).

---

## 3. Konfigurasi OAuth Consent Screen (Layar Persetujuan OAuth)

Sebelum membuat kredensial, Google mewajibkan pengaturan layar persetujuan:

1. Buka menu **APIs & Services** > **OAuth consent screen**.
2. **User Type (Tipe Pengguna):**
   - **Internal** *(Direkomendasikan jika menggunakan Google Workspace Tridhata)*: Hanya akun dengan domain email `@tridhata.com` yang bisa login. Lebih aman dan tidak memerlukan proses verifikasi Google yang rumit.
   - **External**: Pilih ini jika personel menggunakan kombinasi `@tridhata.com` dan `@gmail.com` pribadi.
   - Klik **Create**.
3. **App Information (Informasi Aplikasi):**
   - **App name:** `Tridhata Agro ERP`
   - **User support email:** Masukkan email Anda / IT Support (misal: `admin@tridhata.com`).
   - **App logo:** *(Opsional)* Upload logo PT Tridhata Agro Inovasi.
   - **Developer contact information:** Masukkan email IT / pengelola sistem.
   - Klik **Save and Continue**.
4. **Scopes (Cakupan Izin):**
   - Klik **Add or Remove Scopes**.
   - Centang 3 izin dasar non-sensitif berikut:
     - `.../auth/userinfo.email` (Melihat alamat email utama akun Google Anda)
     - `.../auth/userinfo.profile` (Melihat info profil pribadi Anda, termasuk nama & foto avatar)
     - `openid` (Mengaitkan Anda dengan info pribadi Anda di Google)
   - Klik **Update** > lalu klik **Save and Continue**.
5. **Test Users (Pengguna Uji Coba - Khusus jika memilih External):**
   - Jika status aplikasi masih *Testing*, tambahkan alamat-alamat email personel yang akan mencoba login (misal: email admin, manajer, staf).
   - Klik **Add Users** > ketik email Google mereka > klik **Add**.
   - Klik **Save and Continue**.

---

## 4. Membuat OAuth 2.0 Client ID & Secret

1. Buka menu **APIs & Services** > **Credentials**.
2. Di bagian atas, klik tombol **+ Create Credentials** > pilih **OAuth client ID**.
3. **Application type:** Pilih **Web application**.
4. **Name:** `Tridhata ERP Web Client`.
5. **Authorized JavaScript origins (Asal JavaScript yang Diizinkan):**
   Tambahkan URL dasar tempat ERP diakses:
   - Untuk Pengujian Lokal:
     - `http://localhost:8000`
     - `http://127.0.0.1:8000`
   - Untuk Server VPS / Produksi:
     - `https://erp.tridhata.com` *(sesuaikan dengan subdomain/domain VPS idcloudhost Anda)*
6. **Authorized redirect URIs (URI Pengalihan yang Diizinkan) - SANGAT KRUSIAL:**
   Tambahkan endpoint callback Laravel Socialite yang tepat:
   - Untuk Pengujian Lokal:
     - `http://localhost:8000/auth/google/callback`
     - `http://127.0.0.1:8000/auth/google/callback`
   - Untuk Server VPS / Produksi:
     - `https://erp.tridhata.com/auth/google/callback`
7. Klik tombol **Create**.
8. Dialog pop-up akan menampilkan:
   - **Client ID** (contoh: `1234567890-abcdefg1234567.apps.googleusercontent.com`)
   - **Client Secret** (contoh: `GOCSPX-abc123xyz456_7890`)
9. Salin kedua nilai ini dengan aman.

---

## 5. Memasang Kredensial ke Aplikasi (`.env`)

Buka file `.env` di dalam folder `laravel/`:

```ini
# ==============================================================================
# Google OAuth Single Sign-On (Pre-provisioned Security Gate)
# ==============================================================================
GOOGLE_CLIENT_ID=masukkan_client_id_dari_gcp_di_sini
GOOGLE_CLIENT_SECRET=masukkan_client_secret_dari_gcp_di_sini
GOOGLE_REDIRECT_URI="${APP_URL}/auth/google/callback"
```

> **Catatan Penting `APP_URL`:**
> - Di komputer lokal: `APP_URL=http://127.0.0.1:8000`
> - Di server VPS produksi: `APP_URL=https://erp.tridhata.com`

Setelah memperbarui `.env`, jalankan pembersihan cache konfigurasi:
```bash
php artisan config:clear
```

---

## 6. Cara Kerja Gerbang Keamanan (Pre-Provisioned Security Policy)

Sistem ERP Tridhata mengunci otentikasi Google dengan prinsip **Zero-Trust**:

1. **Bukan Sistem Pendaftaran Bebas:** Akun Google luar **TIDAK BISA** otomatis membuat akun sendiri.
2. **Pendaftaran Awal oleh Admin:**
   - Administrator mendaftarkan staf terlebih dahulu melalui database atau menu admin.
   - Kolom `email` pada tabel `users` diisi dengan email Google resmi yang akan digunakan staf tersebut.
   - Administrator menentukan peran (*Role*) dan cabang yang boleh diakses (*Bogor* atau *Nganjuk*).
3. **Validasi Saat Login:**
   - Pengguna menekan tombol **"Masuk dengan Google"**.
   - Google mengotentikasi pengguna dan mengembalikan email terverifikasi ke `/auth/google/callback`.
   - Sistem mencari apakah email tersebut terdaftar di tabel `users` dan berstatus `active = true`.
   - **Jika Terdaftar:** Avatar dan `google_id` diperbarui, session dibuat ulang (`regenerate`), lalu masuk ke Dashboard Filament (`/admin`).
   - **Jika Tidak Terdaftar / Nonaktif:** Login ditolak seketika dan diarahkan kembali ke layar login dengan pesan penolakan resmi:
     > *"Akun Google Anda belum terdaftar di sistem ERP Tridhata. Silakan hubungi Administrator untuk mendaftarkan akun."*

