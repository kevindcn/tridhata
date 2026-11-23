# Panduan Konfigurasi Google SSO (Single Sign-On) - Tridhata Agro

Dokumen ini menjelaskan langkah demi langkah untuk membuat kredensial Google OAuth 2.0 di Google Cloud Console dan mengintegrasikannya ke dalam sistem Tridhata.

---

## 1. Persiapan di Google Cloud Console

1. Kunjungi [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru atau pilih proyek yang sudah ada (misal: `tridhata-ops`).
3. Pastikan API yang dibutuhkan aktif:
   - Buka **APIs & Services** > **Library**.
   - Cari dan pastikan **Google Identity Services** / **Google People API** dapat diakses.

---

## 2. Mengatur OAuth Consent Screen (Layar Persetujuan OAuth)

1. Buka **APIs & Services** > **OAuth consent screen**.
2. Pilih jenis pengguna:
   - **Internal** (Sangat disarankan jika menggunakan Google Workspace Tridhata Agro, sehingga hanya akun `@tridhata.com` yang bisa mengakses).
   - **External** (Jika menggunakan akun Google publik/campuran).
3. Isi informasi aplikasi:
   - **App name**: `Tridhata Agro Internal System`
   - **User support email**: Email admin/IT Tridhata
   - **Developer contact information**: Email developer/IT
4. Tentukan Scope:
   - Klik **Add or Remove Scopes**.
   - Pilih scope standar:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
5. Simpan dan lanjutkan (**Save and Continue**).

---

## 3. Membuat Kredensial OAuth 2.0 Client ID

1. Buka **APIs & Services** > **Credentials**.
2. Klik **+ Create Credentials** > pilih **OAuth client ID**.
3. Pilih **Application type**: **Web application**.
4. Beri nama: `Tridhata Web & API Client`.
5. Pada bagian **Authorized JavaScript origins**:
   - Pengembangan lokal:
     - `http://localhost:5173`
     - `http://localhost:3000`
   - Produksi (Domain Server):
     - `https://app.tridhata.com` (sesuai domain Anda)
6. Pada bagian **Authorized redirect URIs** (Sangat Penting):
   - Pengembangan lokal:
     - `http://localhost:3000/auth/google/callback`
   - Produksi:
     - `https://api.tridhata.com/auth/google/callback` (atau `https://app.tridhata.com/api/auth/google/callback`)
7. Klik **Create**.
8. Salin **Client ID** dan **Client Secret** yang diberikan.

---

## 4. Mengonfigurasi Environment Variable (`.env`)

Masukkan nilai yang diperoleh ke dalam file `.env` di server backend (`apps/api`):

```ini
# --- Google OAuth 2.0 SSO Configuration
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

Jika di lingkungan produksi:
```ini
GOOGLE_CALLBACK_URL=https://api.tridhata.com/auth/google/callback
CORS_ORIGIN=https://app.tridhata.com
```

---

## 5. Kebijakan Hak Akses Akun (Pre-Provisioned Policy)

Sistem Tridhata menerapkan kebijakan keamanan **Pre-provisioned Only**:
1. Akun pengguna Google **wajib didaftarkan terlebih dahulu** oleh Administrator melalui menu **Manajemen Pengguna** (`/admin/pengguna`) dengan email yang sama.
2. Peran (*Role*), divisi, dan hak akses lokasi (*Location Access*) ditentukan oleh Administrator saat pendaftaran.
3. Saat pengguna login dengan Google:
   - Jika email terdaftar & aktif: pengguna langsung masuk tanpa harus mengubah password manual.
   - Jika email belum didaftarkan: login ditolak dengan notifikasi *"Akun Google (email) belum terdaftar dalam sistem Tridhata. Silakan hubungi Administrator."*
   - Jika akun berstatus nonaktif: login ditolak dengan notifikasi *"Akun Anda sedang dinonaktifkan."*

