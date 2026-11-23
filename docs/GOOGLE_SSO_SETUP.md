# Panduan Konfigurasi Google SSO (Single Sign-On) - Tridhata Agro ERP (Laravel)

Dokumen ini menjelaskan langkah demi langkah untuk mengonfigurasi kredensial Google OAuth 2.0 di Google Cloud Console untuk aplikasi Laravel ERP di folder `laravel/`.

Lihat panduan visual dan terperinci di: 👉 [docs/GCP_GOOGLE_SSO_SETUP.md](file:///d:/Document%20Backup/website-aryo/tridhata/docs/GCP_GOOGLE_SSO_SETUP.md)

---

## Ringkasan Konfigurasi Google Cloud Console

1. **OAuth Consent Screen:**
   - User Type: **Internal** (jika Google Workspace) atau **External** (jika `@gmail.com`).
   - Scopes: `openid`, `email`, `profile`.
2. **Authorized JavaScript Origins:**
   - Lokal: `http://localhost:8000`, `http://127.0.0.1:8000`
   - Produksi: `https://erp.tridhata.com` (sesuaikan domain VPS)
3. **Authorized Redirect URIs (Wajib Tepat):**
   - Lokal: `http://localhost:8000/auth/google/callback`, `http://127.0.0.1:8000/auth/google/callback`
   - Produksi: `https://erp.tridhata.com/auth/google/callback`

---

## Konfigurasi di `laravel/.env`

```ini
APP_URL=http://127.0.0.1:8000

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI="${APP_URL}/auth/google/callback"
```

---

## Kebijakan Pre-Provisioned User (Gerbang Keamanan)

Sistem menerapkan proteksi whitelist:
- Hanya email yang **sudah didaftarkan sebelumnya oleh Admin** pada tabel `users` yang diizinkan masuk.
- Akun Google asing yang belum terdaftar otomatis ditolak dan diarahkan ke halaman login dengan peringatan Bahasa Indonesia.
