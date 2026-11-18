# Tridhata Ops V2

Dashboard Operasional PPIC (Produksi, Perencanaan, dan Pengendalian Inventaris) untuk fasilitas Bogor dan Nganjuk.

## Ringkasan Arsitektur

- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`, `infra`)
- **Backend**: NestJS dengan adapter Fastify, PostgreSQL 16 via Prisma ORM
- **Frontend**: React 19 + Vite + TypeScript, antarmuka shadcn/ui + Tailwind CSS (Apple-style design tokens), font Inter hosting mandiri
- **Autentikasi**: JWT Access Token (in-memory) + Refresh Token rotasi sha256 (cookie httpOnly)
- **Otorisasi**: 3 peran (ADMIN, FINANCE, STAFF) + izin modular + batasan akses lokasi
- **Audit**: Log append-only untuk seluruh aksi mutasi (POST/PATCH/PUT/DELETE)
- **Integrasi**: Sinkronisasi Google Sheets API v4 via Service Account (advisory lock per lokasi)

## Panduan Memulai Cepat (Local Development)

### Prasyarat
- Node.js LTS (v22 atau v24)
- pnpm (v10+)
- Docker & Docker Compose

### Instalasi & Menjalankan

1. Salin berkas environment:
   ```bash
   cp .env.example .env
   ```

2. Jalankan database PostgreSQL lokal:
   ```bash
   docker compose -f infra/compose.dev.yml up -d
   ```

3. Pasang dependensi & bangun paket shared:
   ```bash
   pnpm install
   pnpm build
   ```

4. Jalankan migrasi & seed database:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. Jalankan server pengembangan:
   ```bash
   # Terminal 1: Backend API (port 3000)
   pnpm dev:api

   # Terminal 2: Frontend Web (port 5173)
   pnpm dev:web
   ```

## Skrip Utama

- `pnpm dev:api`: Menjalankan NestJS API dalam mode watch
- `pnpm dev:web`: Menjalankan Vite React web dalam mode dev
- `pnpm build`: Membangun `packages/shared`, `apps/api`, dan `apps/web`
- `pnpm lint`: Menjalankan linter ESLint
- `pnpm typecheck`: Memeriksa tipe TypeScript di seluruh workspace
- `pnpm test`: Menjalankan tes unit dan integrasi
