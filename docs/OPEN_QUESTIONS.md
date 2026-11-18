# Tridhata Ops V2 - Pertanyaan Terbuka & Catatan Klien

Dokumen ini mencatat hal-hal yang belum diketahui atau masih berupa asumsi dalam spesifikasi implementasi (berdasarkan Bagian 15 `docs/SPEC.md`). Jangan menebak atau membuat implementasi di luar spesifikasi tanpa konfirmasi tertulis.

| # | Pertanyaan / Kebutuhan | Asumsi Sementara di Kode | Status | Tindak Lanjut |
|---|---|---|---|---|
| 1 | Nama tab dan header sheet Bogor dan Nganjuk, apakah strukturnya sama? | Belum diketahui. Mapping awal diisi placeholder `TODO_CONFIRM`. | Menunggu akses sheet | Admin mengisi mapping via UI setelah sheet diberikan klien. |
| 2 | Apakah tab MASTER hanya berisi produk jadi? | Ya, dianggap hanya berisi produk jadi. | Menunggu verifikasi | Jika ada barang setengah jadi/bahan baku, perlu kolom penanda tipe produk. |
| 3 | Dari mana pengajuan persetujuan berasal? | Dibuat manual via form di aplikasi (`POST /approvals`), bukan dari Google Sheets. | Terkonfirmasi di SPEC (Bagian 6.8) | Form input sederhana: tipe, judul, catatan, nominal. |
| 4 | Definisi "Kekurangan stok s.d. akhir bulan" | Formula: $\sum \max(0, (\text{projectedSku} - \text{soldSku}) - \text{stockQty})$. | Asumsi aktif | Diverifikasi saat demo dashboard dengan data nyata. |
| 5 | Perhitungan "Nilai stok produk jadi" memakai HPP atau harga jual? | Formula: $\sum (\text{qty} \times \text{cost})$ (HPP produk). | Asumsi aktif | Ditampilkan hanya untuk role berizin `finance:read`. |
| 6 | Apakah penjualan di sheet punya nomor dokumen / kunci unik per transaksi? | Kunci alami: `date \| sku \| docNo`. Baris duplikat ditolak dengan alasan `DUPLICATE_KEY`. | Perlu konfirmasi | Jika banyak transaksi tanpa no dokumen di tanggal yang sama, klien perlu menambahkan ID unik baris di sheet. |
| 7 | Daftar pengguna awal (nama, email, peran, lokasi awal)? | Admin awal di-seed dari env (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`). Pengguna lain dibuat oleh Admin. | Terkonfirmasi di SPEC | Password sementara ditampilkan 1x saat pembuatan. |
| 8 | Apakah staf operasional boleh melihat omzet dan nilai persediaan? | Tidak. Hak akses finansial dibatasi izin `finance:read`. | Terkonfirmasi di SPEC | Default: hanya ADMIN dan FINANCE yang punya `finance:read`. |
| 9 | Desain dan kebutuhan kolom halaman Capaian Target Produksi v1 | Mengikuti acuan sederhana: Total target, Total aktual, % Capaian, SKU tercapai, SKU kurang, serta tabel per SKU. | Menunggu review klien | Ditinjau bersama klien pada Fase 4. |
| 10 | Spesifikasi server VPS dan nama domain produksi | VPS Ubuntu 24.04 LTS dari klien, domain `app.klien.com` dan `api.klien.com`. | Menunggu info infra klien | Setup Caddy dan Docker Compose disiapkan modular. |
| 11 | Penanganan baris yang dihapus dari Google Sheets | Tidak menghapus baris di PostgreSQL. Sinkronisasi hanya menambah (insert) dan memperbarui (update/upsert). | Terkonfirmasi di SPEC | Penghapusan data dihindari demi jejak audit dan integritas data historis. |
