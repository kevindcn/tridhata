# TRIDHATA OPS V2: Spesifikasi Implementasi (Opsi 1: Fondasi)

Dokumen ini adalah sumber kebenaran tunggal untuk membangun ulang aplikasi **Tridhata Ops** (dashboard operasional PPIC, lokasi Bogor dan Nganjuk). Dibuat untuk dikerjakan oleh AI coding agent dan dua developer manusia yang me-review hasilnya.

Versi dokumen: 1.0 · Tanggal: 18 November 2026 · Tenggat rilis: 28 Desember 2026

---

## 0. Aturan kerja untuk agent (WAJIB dibaca dulu)

1. **Baca seluruh dokumen sebelum menulis kode.** Kerjakan per fase (bagian 14), satu fase selesai dan lulus kriteria penerimaannya sebelum fase berikutnya.
2. **Jangan menambah fitur di luar cakupan** (bagian 1.2). Jika menemukan kebutuhan yang tampak penting tetapi tidak tertulis, catat di `docs/OPEN_QUESTIONS.md` dan lanjutkan, jangan diimplementasikan diam-diam.
3. **Jangan menebak data klien.** Nama tab dan header Google Sheets BELUM diketahui. Semua yang bergantung padanya wajib lewat tabel `sheet_mapping` (bagian 7), dan seed-nya berisi placeholder bertanda `TODO_CONFIRM`.
4. **TypeScript strict di seluruh repositori.** Tidak ada `any` tanpa komentar alasan. Tidak ada `// @ts-ignore`.
5. **Semua teks yang dilihat pengguna berbahasa Indonesia.** Semua identifier kode, nama file, dan komentar berbahasa Inggris.
6. **Izin dicek di server.** Menyembunyikan tombol di frontend tidak dihitung sebagai pengamanan.
7. **Tidak ada rahasia di repositori atau di build frontend.** Hanya `.env.example` yang boleh di-commit.
8. **Setiap endpoint yang mengubah data wajib menulis `audit_log`** (bagian 6.5), dan ada tes yang membuktikannya.
9. **Ikuti panduan desain di bagian 9 secara ketat**, termasuk daftar periksa anti-slop. Desain generik bawaan templat dianggap cacat.
10. **Commit kecil dan bermakna** dengan format Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
11. Saat versi library yang terpasang berbeda dari contoh di dokumen ini, **ikuti dokumentasi resmi versi terpasang**, dan pertahankan perilaku yang dijelaskan di sini.
12. Zona waktu semua perhitungan tanggal adalah **Asia/Jakarta**. Jangan menghitung "hari ini" dengan UTC.

---

## 1. Konteks dan cakupan

### 1.1 Latar belakang

Aplikasi saat ini adalah web statis (Netlify) yang membaca Google Sheets langsung dari browser. Masalah yang harus diselesaikan:

| # | Masalah v1 | Solusi v2 |
|---|---|---|
| 1 | Berjalan di hosting pihak ketiga, tanpa backend | Backend NestJS + PostgreSQL di VPS klien, frontend dan backend dideploy terpisah |
| 2 | Tidak ada login sungguhan, siapa pun bisa menyetujui keuangan | Akun pribadi, 3 peran, izin dicek di server |
| 3 | Tidak ada log aktivitas | Tabel `audit_log` yang hanya bisa ditambah |
| 4 | Satu file besar, posisi kolom sheet tertanam di kode | Kode modular, pemetaan kolom disimpan di database, pengecekan header sebelum sinkron |
| 5 | Risiko dua pengguna menulis baris yang sama | **Di luar Opsi 1.** Kolom `version` disiapkan, belum dipakai (kecuali proteksi keputusan ganda di bagian 6.8) |
| 6 | Dokumen otomatis | **Di luar Opsi 1** |

### 1.2 Cakupan Opsi 1

**DIKERJAKAN:**

1. Backend NestJS + PostgreSQL, dideploy via Docker di VPS klien.
2. Login email + kata sandi, 3 peran: `ADMIN`, `FINANCE`, `STAFF`.
3. Aksi menyetujui/menolak pengajuan hanya untuk `FINANCE`.
4. Log aktivitas dasar, dapat dilihat `ADMIN`.
5. Tiga halaman dashboard: **Ringkasan Penjualan**, **Capaian Target Produksi**, **Persediaan Barang**, dengan filter tanggal dan unduh data (CSV).
6. Sinkron Google Sheets ke database lewat service account, dengan pemetaan kolom konfigurabel.
7. Halaman admin: Pengguna, Log Aktivitas, Sinkron dan Pemetaan.
8. Halaman Persetujuan (daftar, buat pengajuan sederhana, setujui/tolak).
9. Pencadangan harian, panduan pemasangan, dokumentasi.

**TIDAK DIKERJAKAN (jangan dibangun):** perlindungan penulisan bersamaan penuh, persetujuan berjenjang, perintah kerja dan dokumen PDF, input data lewat form (input tetap lewat Sheets), notifikasi WhatsApp/email, mode gelap (token disiapkan, tampilannya tidak), halaman Finance lain di luar Persetujuan, manajemen peran lewat UI.

---

## 2. Stack teknologi

| Bagian | Pilihan |
|---|---|
| Runtime | Node.js LTS (22 atau 24), pnpm workspaces |
| Bahasa | TypeScript strict |
| Backend | NestJS dengan adapter Fastify |
| ORM, migrasi | Prisma |
| Database | PostgreSQL 16 |
| Validasi | Zod (skema dibagi lewat `packages/shared`) |
| Auth | JWT akses 15 menit + refresh token opaque 7 hari (cookie httpOnly), hash kata sandi argon2id |
| Keamanan HTTP | @fastify/helmet, @nestjs/throttler, CORS satu asal |
| Integrasi Sheets | `googleapis` (Sheets API v4), service account |
| Penjadwalan | `@nestjs/schedule` + `SchedulerRegistry` |
| Log | `nestjs-pino` |
| Frontend | React 19 + Vite + TypeScript |
| Routing | React Router (mode data/library, bukan framework mode) |
| Data fetching | TanStack Query v5 |
| Tabel | TanStack Table v8 |
| UI | shadcn/ui (Radix + Tailwind CSS, ikuti CLI shadcn versi terkini untuk versi Tailwind) |
| Grafik | Recharts lewat komponen `chart` shadcn |
| Form | React Hook Form + `@hookform/resolvers/zod` |
| Ikon | `lucide-react` |
| Notifikasi | Sonner |
| Font | `@fontsource-variable/inter` (hosting sendiri) |
| Tes backend | Jest + Supertest |
| Tes frontend | Vitest + Testing Library; satu skenario Playwright |
| Kontainer | Docker, Docker Compose, Caddy (HTTPS), Nginx (berkas statis) |
| CI/CD | GitHub Actions, dua alur terpisah |

Dilarang menambah dependensi besar tanpa alasan tertulis di PR (misalnya Redux, MUI, Bootstrap, axios, Moment, Lodash penuh).

---

## 3. Struktur repositori

```
tridhata-ops/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed.ts
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ config/            env.ts (validasi Zod)
│  │  │  ├─ common/            guards, decorators, filters, pipes, utils
│  │  │  ├─ prisma/            PrismaModule, PrismaService
│  │  │  └─ modules/
│  │  │     ├─ auth/
│  │  │     ├─ users/
│  │  │     ├─ locations/
│  │  │     ├─ audit/
│  │  │     ├─ sheets-sync/
│  │  │     ├─ dashboard/
│  │  │     ├─ approvals/
│  │  │     └─ health/
│  │  ├─ test/                 tes e2e
│  │  └─ Dockerfile
│  └─ web/
│     ├─ src/
│     │  ├─ main.tsx
│     │  ├─ app/               router.tsx, providers.tsx, layout/
│     │  ├─ features/          auth, sales, production, inventory, approvals, admin
│     │  ├─ components/ui/     hasil shadcn (disesuaikan dengan token)
│     │  ├─ components/        komponen bersama (StatCard, DataTable, EmptyState, ...)
│     │  ├─ lib/               api-client.ts, format.ts, date.ts, cn.ts
│     │  └─ styles/            index.css (token desain)
│     ├─ nginx.conf.template
│     └─ Dockerfile
├─ packages/
│  └─ shared/                  skema Zod, tipe, konstanta izin (di-build ke dist)
├─ infra/
│  ├─ compose.edge.yml  compose.api.yml  compose.web.yml
│  ├─ Caddyfile
│  └─ backup.sh
├─ docs/
│  ├─ DEPLOY.md  OPERATIONS.md  OPEN_QUESTIONS.md
├─ .github/workflows/          api.yml  web.yml
├─ .env.example
├─ package.json  pnpm-workspace.yaml  tsconfig.base.json
├─ eslint.config.js  .prettierrc
└─ README.md
```

Aturan struktur:

1. Satu modul NestJS satu folder: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` atau skema dari `shared`, `*.spec.ts`.
2. Controller hanya: ambil input, panggil service, kembalikan hasil. Logika bisnis di service.
3. Hanya service yang boleh memakai `PrismaService`. Controller tidak.
4. `apps/web` dan `apps/api` tidak boleh saling impor. Keduanya hanya boleh impor dari `packages/shared`.
5. Frontend diorganisasi per **fitur**, bukan per jenis file.

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Skrip akar `package.json`: `dev:api`, `dev:web`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`. `packages/shared` harus di-build lebih dulu (`tsc` ke `dist`, field `main` dan `types` mengarah ke dist), dan `build` akar memastikan urutan itu.

---

## 4. Paket bersama `packages/shared`

### 4.1 Izin dan peran

```ts
// packages/shared/src/permissions.ts
export const PERMISSIONS = [
  'dashboard:read',
  'finance:read',      // melihat omzet dan nilai stok
  'export:run',
  'approval:create',
  'approval:read_all', // tanpa ini hanya melihat pengajuan miliknya
  'approval:decide',
  'user:manage',
  'audit:read',
  'sync:manage',
  'location:all',      // melihat semua lokasi
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type RoleName = 'ADMIN' | 'FINANCE' | 'STAFF';

export const ROLE_DEFAULTS: Record<RoleName, Permission[]> = {
  ADMIN: [
    'dashboard:read', 'finance:read', 'export:run', 'approval:create',
    'approval:read_all', 'user:manage', 'audit:read', 'sync:manage', 'location:all',
  ],
  FINANCE: [
    'dashboard:read', 'finance:read', 'export:run', 'approval:create',
    'approval:read_all', 'approval:decide', 'location:all',
  ],
  STAFF: ['dashboard:read', 'export:run', 'approval:create'],
};
```

Catatan desain yang disengaja: **`ADMIN` tidak punya `approval:decide`** (pemisahan tugas). Izin efektif pengguna = izin peran ∪ `extraPermissions` milik pengguna. `extraPermissions` memungkinkan admin memberi `finance:read` ke staf tertentu tanpa UI manajemen peran.

### 4.2 Skema Zod (minimal)

Definisikan di `packages/shared/src/schemas/`, ekspor skema dan tipe hasil `z.infer`:

| Skema | Isi |
|---|---|
| `loginSchema` | `email` (email, lowercase), `password` (min 1) |
| `changePasswordSchema` | `currentPassword`, `newPassword` (min 10, wajib ada huruf dan angka) |
| `createUserSchema` | `name`, `email`, `role` (`RoleName`), `division?`, `locationIds` (array uuid, min 1), `defaultLocationId`, `extraPermissions` |
| `updateUserSchema` | semua opsional, ditambah `active` |
| `dateRangeSchema` | `from`, `to` format `YYYY-MM-DD`, `from <= to`, rentang maksimum 366 hari |
| `dashboardQuerySchema` | `locationId` (uuid), `from`, `to` |
| `createRequestSchema` | `type` (string pendek), `title` (3..120), `note?` (maks 1000), `amount` (angka >= 0, maks 2 desimal) |
| `decideRequestSchema` | `decision` (`APPROVED` atau `REJECTED`), `note?` (wajib jika `REJECTED`, min 5 karakter) |
| `sheetMappingSchema` | `locationId`, `tab`, `entity`, `sourceHeader`, `targetField`, `fieldType`, `required`, `isKey` |
| `errorResponseSchema` | `{ code, message, details? }` |

Tipe respons API (dashboard, daftar, dll.) juga didefinisikan di sini supaya frontend dan backend memakai bentuk yang sama.

---

## 5. Database (PostgreSQL + Prisma)

Aturan umum: primary key UUID, `createdAt` dan `updatedAt` di semua tabel, uang memakai `Decimal(18,2)`, tanggal tanpa jam memakai `@db.Date`, nama tabel fisik berbahasa Indonesia lewat `@@map`. Konfigurasi `generator` dan `datasource` mengikuti hasil `prisma init` pada versi Prisma yang terpasang (bagian ini hanya menetapkan model).

Catatan perubahan terhadap ringkasan sebelumnya: ambang `minStock` dan `safetyStock` ditaruh di `StockLevel` (per lokasi), bukan di `Product`, karena Bogor dan Nganjuk bisa punya ambang berbeda. Spesifikasi ini yang berlaku.

```prisma
enum SheetEntity { PRODUCT STOCK SALE FORECAST TARGET }
enum FieldType   { STRING INT DECIMAL DATE }
enum RequestStatus { PENDING APPROVED REJECTED }
enum Decision    { APPROVED REJECTED }
enum SyncStatus  { RUNNING SUCCESS PARTIAL FAILED }
enum SyncTrigger { CRON MANUAL }

model Location {
  id            String   @id @default(uuid()) @db.Uuid
  code          String   @unique            // BOGOR, NGANJUK
  name          String
  spreadsheetId String?                     // diisi dari env saat seed
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  users         User[]   @relation("DefaultLocation")
  access        LocationAccess[]
  @@map("lokasi")
}

model Role {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique              // ADMIN | FINANCE | STAFF
  permissions String[]                      // salinan ROLE_DEFAULTS saat seed
  users       User[]
  @@map("peran")
}

model User {
  id                 String    @id @default(uuid()) @db.Uuid
  name               String
  email              String    @unique
  passwordHash       String
  division           String?
  roleId             String    @db.Uuid
  role               Role      @relation(fields: [roleId], references: [id])
  defaultLocationId  String?   @db.Uuid
  defaultLocation    Location? @relation("DefaultLocation", fields: [defaultLocationId], references: [id])
  extraPermissions   String[]  @default([])
  active             Boolean   @default(true)
  mustChangePassword Boolean   @default(true)
  failedLogins       Int       @default(0)
  lockedUntil        DateTime?
  lastLoginAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  access             LocationAccess[]
  refreshTokens      RefreshToken[]
  requests           Request[]
  approvals          Approval[]
  audits             AuditLog[]
  @@map("pengguna")
}

model LocationAccess {
  userId     String   @db.Uuid
  locationId String   @db.Uuid
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  location   Location @relation(fields: [locationId], references: [id], onDelete: Cascade)
  @@id([userId, locationId])
  @@map("akses_lokasi")
}

model RefreshToken {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @db.Uuid
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  familyId     String    @db.Uuid            // satu rantai rotasi
  tokenHash    String    @unique             // sha256 dari token mentah
  expiresAt    DateTime
  revokedAt    DateTime?
  replacedById String?   @db.Uuid
  ip           String?
  userAgent    String?
  createdAt    DateTime  @default(now())
  @@index([userId])
  @@index([familyId])
  @@map("refresh_token")
}

model Product {
  id        String   @id @default(uuid()) @db.Uuid
  sku       String   @unique
  name      String
  unit      String   @default("pcs")
  price     Decimal  @default(0) @db.Decimal(18, 2)   // harga jual
  cost      Decimal  @default(0) @db.Decimal(18, 2)   // HPP
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  stock     StockLevel[]
  sales     Sale[]
  forecasts Forecast[]
  targets   ProductionTarget[]
  @@map("produk")
}

model StockLevel {
  id          String   @id @default(uuid()) @db.Uuid
  productId   String   @db.Uuid
  locationId  String   @db.Uuid
  product     Product  @relation(fields: [productId], references: [id])
  qty         Int      @default(0)
  minStock    Int      @default(0)
  safetyStock Int      @default(0)
  syncedAt    DateTime @default(now())
  version     Int      @default(1)                    // disiapkan untuk Opsi 2
  @@unique([productId, locationId])
  @@index([locationId])
  @@map("stok_produk")
}

model Sale {
  id         String   @id @default(uuid()) @db.Uuid
  locationId String   @db.Uuid
  productId  String   @db.Uuid
  product    Product  @relation(fields: [productId], references: [id])
  date       DateTime @db.Date
  docNo      String?
  qty        Int
  price      Decimal  @db.Decimal(18, 2)
  total      Decimal  @db.Decimal(18, 2)
  sourceKey  String                                   // gabungan field isKey dari sheet
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([locationId, sourceKey])
  @@index([locationId, date])
  @@index([productId])
  @@map("penjualan")
}

model Forecast {
  id         String  @id @default(uuid()) @db.Uuid
  productId  String  @db.Uuid
  locationId String  @db.Uuid
  product    Product @relation(fields: [productId], references: [id])
  period     String                                    // 'YYYY-MM'
  qty        Int
  @@unique([productId, locationId, period])
  @@index([locationId, period])
  @@map("forecast")
}

model ProductionTarget {
  id         String  @id @default(uuid()) @db.Uuid
  productId  String  @db.Uuid
  locationId String  @db.Uuid
  product    Product @relation(fields: [productId], references: [id])
  period     String
  targetQty  Int
  actualQty  Int     @default(0)
  @@unique([productId, locationId, period])
  @@index([locationId, period])
  @@map("target_produksi")
}

model Request {
  id          String        @id @default(uuid()) @db.Uuid
  requesterId String        @db.Uuid
  requester   User          @relation(fields: [requesterId], references: [id])
  locationId  String        @db.Uuid
  type        String
  title       String
  note        String?
  amount      Decimal       @db.Decimal(18, 2)
  status      RequestStatus @default(PENDING)
  version     Int           @default(1)
  decidedAt   DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  approvals   Approval[]
  @@index([status, createdAt])
  @@index([requesterId])
  @@map("pengajuan")
}

model Approval {
  id         String   @id @default(uuid()) @db.Uuid
  requestId  String   @db.Uuid
  request    Request  @relation(fields: [requestId], references: [id])
  approverId String   @db.Uuid
  approver   User     @relation(fields: [approverId], references: [id])
  level      Int      @default(1)                      // disiapkan untuk berjenjang (Opsi 2)
  decision   Decision
  note       String?
  decidedAt  DateTime @default(now())
  @@index([requestId])
  @@map("approval")
}

model SheetMapping {
  id           String      @id @default(uuid()) @db.Uuid
  locationId   String      @db.Uuid
  tab          String                                   // nama tab di spreadsheet
  entity       SheetEntity
  sourceHeader String                                   // teks header di sheet
  targetField  String                                   // field tujuan (bagian 7.2)
  fieldType    FieldType
  required     Boolean     @default(true)
  isKey        Boolean     @default(false)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  @@unique([locationId, entity, targetField])
  @@map("sheet_mapping")
}

model SyncRun {
  id            String      @id @default(uuid()) @db.Uuid
  locationId    String      @db.Uuid
  trigger       SyncTrigger
  triggeredById String?     @db.Uuid
  status        SyncStatus
  startedAt     DateTime    @default(now())
  finishedAt    DateTime?
  rowsAccepted  Int         @default(0)
  rowsRejected  Int         @default(0)
  report        Json?                                   // bagian 7.5
  @@index([locationId, startedAt])
  @@map("sync_run")
}

model AuditLog {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String?  @db.Uuid
  user      User?    @relation(fields: [userId], references: [id])
  action    String
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  @@index([createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_log")
}
```

Seed (`prisma/seed.ts`), idempotent:

1. Dua lokasi: `BOGOR`, `NGANJUK` (spreadsheetId dari env `SHEET_ID_BOGOR`, `SHEET_ID_NGANJUK`).
2. Tiga peran dengan `permissions` dari `ROLE_DEFAULTS`.
3. Satu akun admin dari `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD`, `mustChangePassword = true`. Gagal dengan pesan jelas jika env tidak ada di production.
4. Mapping awal berisi placeholder `TODO_CONFIRM` (bagian 7.2). Jangan mengarang nama header.

Pembatasan database: tabel `audit_log` tidak boleh punya endpoint UPDATE/DELETE. Di production, buat role database khusus aplikasi tanpa hak `UPDATE`/`DELETE` pada `audit_log` (dijelaskan di `docs/DEPLOY.md`).

---

## 6. Backend (NestJS)

### 6.1 Konfigurasi dan bootstrap

`src/config/env.ts` memvalidasi `process.env` dengan Zod saat start. Aplikasi **berhenti** jika ada yang tidak valid.

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  TZ: z.string().default('Asia/Jakarta'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().url(),                 // satu asal saja
  COOKIE_DOMAIN: z.string().optional(),          // contoh: .klien.com
  GOOGLE_SA_EMAIL: z.string().email(),
  GOOGLE_SA_PRIVATE_KEY: z.string().min(1).transform((v) => v.replace(/\\n/g, '\n')),
  SHEET_ID_BOGOR: z.string().optional(),
  SHEET_ID_NGANJUK: z.string().optional(),
  SYNC_ENABLED: z.coerce.boolean().default(true),
  SYNC_CRON: z.string().default('*/15 * * * *'),
  SYNC_STALE_MINUTES: z.coerce.number().default(120),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(10).optional(),
});
export type Env = z.infer<typeof envSchema>;
```

`main.ts` (urutan penting):

```ts
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ trustProxy: true }),   // di belakang Caddy
  { bufferLogs: true },
);
app.useLogger(app.get(Logger));               // nestjs-pino
await app.register(helmet);                   // @fastify/helmet
await app.register(fastifyCookie);            // @fastify/cookie
app.enableCors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
});
app.enableShutdownHooks();
await app.listen(env.PORT, '0.0.0.0');
```

Guard global, urutan eksekusi: `ThrottlerGuard` → `JwtAuthGuard` (lewati jika `@Public()`) → `PermissionsGuard`. Filter global `AllExceptionsFilter`. Throttler global: 120 permintaan per menit per IP. Endpoint login: 5 per 15 menit per IP (`@Throttle`).

### 6.2 Format galat dan validasi

Semua galat berbentuk:

```json
{ "code": "FORBIDDEN", "message": "Anda tidak punya izin untuk aksi ini", "details": null }
```

Kode: `VALIDATION_ERROR` (400, `details` berisi galat per bidang), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500, pesan umum, detail hanya di log). Pesan selalu bahasa Indonesia dan tidak membocorkan detail internal (stack, query).

Validasi memakai pipe Zod:

```ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}
  transform(value: unknown) {
    const r = this.schema.safeParse(value);
    if (!r.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: r.error.flatten() });
    return r.data;
  }
}
// pemakaian: @Body(new ZodValidationPipe(createRequestSchema)) body: CreateRequestDto
```

### 6.3 Auth

Desain token:

| Token | Bentuk | Lokasi | Umur |
|---|---|---|---|
| Access | JWT HS256, payload `{ sub, iat, exp }` | Body respons, disimpan frontend **di memori saja** | 15 menit |
| Refresh | String acak 48 byte (base64url), disimpan di DB sebagai sha256 | Cookie `rt`: `httpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/auth`, `Domain=COOKIE_DOMAIN` | 7 hari |

Alur `POST /auth/login`:

1. Cari user berdasarkan email (lowercase). Jika tidak ada atau `active=false`: jalankan `argon2.verify` ke hash tiruan (menyamakan waktu respons), catat `auth.login_failed`, balas 401 `Email atau kata sandi salah` (pesan sama untuk semua kegagalan).
2. Jika `lockedUntil > now`: balas 429 `Akun dikunci sementara. Coba lagi beberapa menit lagi`.
3. Verifikasi argon2id. Gagal: `failedLogins++`; jika mencapai 5, set `lockedUntil = now + 15 menit` dan reset hitungan. Catat `auth.login_failed`.
4. Berhasil: reset `failedLogins`, set `lastLoginAt`, buat `familyId` baru, buat refresh token, set cookie, balas `{ accessToken, user }`, catat `auth.login`.

Alur `POST /auth/refresh` (rotasi):

```ts
async refresh(rawToken: string, ctx: ReqCtx) {
  const hash = sha256(rawToken);
  const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!row) throw new UnauthorizedException();
  if (row.revokedAt) {
    // token yang sudah dirotasi dipakai lagi: indikasi pencurian, cabut seluruh keluarga
    await this.prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedException();
  }
  if (row.expiresAt < new Date()) throw new UnauthorizedException();
  // terbitkan pengganti dalam satu transaksi, cabut yang lama
  // (user harus masih active; jika tidak, cabut dan tolak)
}
```

`POST /auth/logout`: cabut seluruh `familyId` token yang dikirim, hapus cookie, catat `auth.logout`. `POST /auth/change-password`: verifikasi sandi lama, simpan hash baru, cabut semua refresh token pengguna, set `mustChangePassword=false`, catat `auth.password_changed`. Jika `mustChangePassword=true`, semua endpoint selain `/auth/*` dan `/me` membalas 403 kode `PASSWORD_CHANGE_REQUIRED`, dan frontend mengarahkan ke halaman ganti sandi.

Argon2: `argon2.hash(pw, { type: argon2.argon2id })` dengan parameter bawaan library, kecuali tim memutuskan lain berdasarkan uji performa di VPS.

Proteksi CSRF: cookie refresh hanya dipakai di `/auth/refresh` dan `/auth/logout` (POST, `SameSite=Lax`). Tambahkan pengecekan header `Origin` harus sama dengan `CORS_ORIGIN` pada kedua endpoint itu.

`JwtStrategy.validate` **memuat pengguna dari database di setiap permintaan** (indeks pada primary key, murah) agar penonaktifan akun dan perubahan izin berlaku seketika. Objek yang dilampirkan ke request:

```ts
interface AuthUser {
  id: string; name: string; email: string; role: RoleName;
  permissions: Permission[];     // role.permissions ∪ extraPermissions
  locationIds: string[];         // dari LocationAccess
  defaultLocationId: string | null;
  mustChangePassword: boolean;
}
```

### 6.4 Izin dan lingkup lokasi

```ts
export const PERMS_KEY = 'permissions';
export const RequirePermissions = (...p: Permission[]) => SetMetadata(PERMS_KEY, p);
export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    if (!required.every((p) => user.permissions.includes(p))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Anda tidak punya izin untuk aksi ini' });
    }
    return true;
  }
}
```

Lingkup lokasi, dipanggil **di service** pada setiap query berdata lokasi:

```ts
async assertLocation(user: AuthUser, locationId: string) {
  if (user.permissions.includes('location:all')) {
    const exists = await this.prisma.location.count({ where: { id: locationId } });
    if (!exists) throw new NotFoundException();
    return;
  }
  if (!user.locationIds.includes(locationId)) {
    throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Anda tidak punya akses ke lokasi ini' });
  }
}
```

Masking data keuangan dilakukan **di service**, bukan di frontend: jika pengguna tidak punya `finance:read`, field `revenue`, `price`, `total`, `stockValue`, `cost`, `value` dikembalikan `null`.

### 6.5 Log aktivitas

`AuditService.record(entry, tx?)` menulis satu baris. Dipanggil **eksplisit dari service**, di dalam transaksi yang sama dengan perubahan datanya (jika gagal, keduanya batal).

```ts
interface AuditEntry {
  userId?: string; action: string; entity: string; entityId?: string;
  before?: unknown; after?: unknown; ctx?: { ip?: string; userAgent?: string };
}
```

Aksi baku: `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_changed`, `user.created`, `user.updated`, `request.created`, `request.approved`, `request.rejected`, `sync.run`, `sync.failed`, `sync.mapping_updated`, `export.downloaded`.

Aturan: jangan pernah menyimpan `passwordHash`, token, atau kunci. Gunakan fungsi `redact()` yang menghapus kunci `password*`, `*Hash`, `token*` dari `before`/`after`. Tes e2e wajib membuktikan: setiap endpoint POST/PATCH/PUT/DELETE (kecuali `/auth/refresh`) menambah minimal satu baris `audit_log`.

`GET /audit-logs`: filter `userId`, `action`, `from`, `to`; paginasi kursor (`createdAt` + `id`), 50 baris per halaman, urut terbaru dulu. Hanya izin `audit:read`.

### 6.6 Pengguna

`POST /users` (izin `user:manage`): buat akun dengan kata sandi sementara acak yang dikembalikan **sekali** di respons (ditampilkan sekali di UI, tidak disimpan mentah), `mustChangePassword=true`. `PATCH /users/:id`: ubah nama, divisi, peran, lokasi, `extraPermissions`, `active`. Admin tidak boleh menonaktifkan atau menurunkan peran akunnya sendiri. Sistem harus selalu memiliki minimal satu `ADMIN` aktif. `POST /users/:id/reset-password`: kata sandi sementara baru, cabut semua refresh token. Semua aksi ini tercatat di audit.

### 6.7 Daftar endpoint

| Metode | Jalur | Izin | Catatan |
|---|---|---|---|
| POST | `/auth/login` | publik | throttle ketat |
| POST | `/auth/refresh` | cookie | rotasi, cek Origin |
| POST | `/auth/logout` | cookie | cek Origin |
| POST | `/auth/change-password` | sesi | |
| GET | `/me` | sesi | profil, izin, lokasi yang boleh |
| GET | `/locations` | sesi | hanya lokasi yang boleh diakses |
| GET | `/dashboard/sales` | `dashboard:read` | bagian 8 |
| GET | `/dashboard/production` | `dashboard:read` | bagian 8 |
| GET | `/dashboard/inventory` | `dashboard:read` | bagian 8 |
| GET | `/dashboard/:page/export` | `export:run` | CSV, tercatat di audit |
| GET | `/approvals` | `approval:create` | milik sendiri; semua jika `approval:read_all` |
| GET | `/approvals/:id` | sesi | dengan aturan kepemilikan yang sama |
| POST | `/approvals` | `approval:create` | |
| POST | `/approvals/:id/decide` | `approval:decide` | bagian 6.8 |
| GET, POST, PATCH | `/users`, `/users/:id` | `user:manage` | |
| POST | `/users/:id/reset-password` | `user:manage` | |
| GET | `/audit-logs` | `audit:read` | |
| GET | `/sync/status` | `dashboard:read` | kesegaran data |
| POST | `/sync/run` | `sync:manage` | sinkron manual per lokasi |
| GET, PUT | `/sync/mappings` | `sync:manage` | |
| GET | `/health` | publik | cek DB, tanpa detail internal |

### 6.8 Persetujuan

Pengajuan dibuat di aplikasi (bukan dari Sheets) lewat form sederhana: jenis, judul, catatan, nilai. Ini asumsi yang harus dikonfirmasi klien (bagian 15). Status hanya boleh `PENDING → APPROVED` atau `PENDING → REJECTED`, tidak ada jalur lain.

```ts
async decide(user: AuthUser, id: string, dto: DecideRequestDto, ctx: ReqCtx) {
  return this.prisma.$transaction(async (tx) => {
    const req = await tx.request.findUnique({ where: { id } });
    if (!req) throw new NotFoundException();
    await this.locations.assertLocation(user, req.locationId);
    if (req.requesterId === user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Anda tidak dapat memutuskan pengajuan Anda sendiri' });
    }
    // proteksi keputusan ganda tanpa locking penuh: hanya baris yang masih PENDING yang boleh berubah
    const res = await tx.request.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: dto.decision, decidedAt: new Date(), version: { increment: 1 } },
    });
    if (res.count === 0) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Pengajuan ini sudah diputuskan' });
    }
    await tx.approval.create({ data: { requestId: id, approverId: user.id, decision: dto.decision, note: dto.note } });
    await this.audit.record({
      userId: user.id, action: dto.decision === 'APPROVED' ? 'request.approved' : 'request.rejected',
      entity: 'Request', entityId: id,
      before: { status: 'PENDING' }, after: { status: dto.decision, note: dto.note }, ctx,
    }, tx);
  });
}
```

---

## 7. Sinkron Google Sheets

Tujuan: backend satu-satunya yang membaca Sheets. Sheet dibagikan **hanya** ke email service account dengan akses **Viewer**. Tautan publik dimatikan. Nilai `GOOGLE_SA_*` hanya ada di server.

### 7.1 Prinsip

1. Header dicocokkan berdasarkan **nama**, bukan urutan kolom.
2. Jika header **wajib** hilang atau berganti nama: sinkron entitas itu **dibatalkan**, data lama di database tetap dipakai, `SyncRun` berstatus `FAILED` atau `PARTIAL` dengan pesan yang menyebut nama header dan tab yang bermasalah.
3. Baris tidak valid **dilaporkan dan dilewati**, tidak menghentikan baris lain.
4. Penyimpanan **idempoten** (upsert berdasarkan kunci alami): menjalankan sinkron dua kali tidak menggandakan data.
5. Tidak boleh ada dua sinkron berjalan bersamaan untuk lokasi yang sama (advisory lock Postgres: `pg_try_advisory_lock(hashtext('sync:' || locationId))`; jika gagal mengunci, lewati dan catat).
6. Baca dengan `valueRenderOption: 'UNFORMATTED_VALUE'` dan `dateTimeRenderOption: 'SERIAL_NUMBER'` supaya angka dan tanggal tidak terpengaruh format lokal sheet.

### 7.2 Entitas dan field tujuan

| Entity | Tabel tujuan | Field tujuan (`targetField`) | Kunci (`isKey`) |
|---|---|---|---|
| `PRODUCT` | `produk` | `sku` (STRING), `name` (STRING), `unit` (STRING, opsional), `price` (DECIMAL, opsional), `cost` (DECIMAL, opsional) | `sku` |
| `STOCK` | `stok_produk` | `sku` (STRING), `qty` (INT), `minStock` (INT), `safetyStock` (INT) | `sku` |
| `SALE` | `penjualan` | `date` (DATE), `sku` (STRING), `docNo` (STRING, opsional), `qty` (INT), `price` (DECIMAL), `total` (DECIMAL, opsional: jika kosong = qty × price) | `date`, `sku`, `docNo` (jika ada) |
| `FORECAST` | `forecast` | `sku` (STRING), `period` (STRING `YYYY-MM`), `qty` (INT) | `sku`, `period` |
| `TARGET` | `target_produksi` | `sku` (STRING), `period` (STRING), `targetQty` (INT), `actualQty` (INT, opsional) | `sku`, `period` |

`sourceKey` pada `Sale` = nilai field kunci digabung dengan `|`. **Peringatan:** jika di sheet ada dua baris dengan nilai kunci yang sama (misalnya dua penjualan SKU sama di tanggal sama tanpa nomor dokumen), keduanya akan bertabrakan. Deteksi ini: laporan sinkron harus menandai kunci duplikat sebagai baris ditolak dengan alasan `DUPLICATE_KEY`, dan masalahnya dicatat di `docs/OPEN_QUESTIONS.md` untuk klien.

Nama tab dan header sumber untuk seed awal belum diketahui. Seed mengisi `tab` dan `sourceHeader` dengan nilai literal `TODO_CONFIRM`. Sinkron **menolak berjalan** untuk mapping yang masih berisi `TODO_CONFIRM` dan melaporkannya dengan jelas. Mapping diisi admin lewat halaman Sinkron dan Pemetaan setelah sheet klien dilihat.

### 7.3 Pembantu parsing (acuan implementasi)

```ts
export const normalizeHeader = (s: unknown) =>
  String(s ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

// Sheets menyimpan tanggal sebagai nomor seri sejak 1899-12-30
export function serialToDate(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);       // 'YYYY-MM-DD'
}

export function parseCell(raw: unknown, type: FieldType): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (raw === '' || raw === null || raw === undefined) return { ok: false, reason: 'EMPTY' };
  switch (type) {
    case 'STRING': return { ok: true, value: String(raw).trim() };
    case 'INT': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? { ok: true, value: Math.round(n) } : { ok: false, reason: 'NOT_A_NUMBER' };
    }
    case 'DECIMAL': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, reason: 'NOT_A_NUMBER' };
    }
    case 'DATE': {
      if (typeof raw === 'number') return { ok: true, value: serialToDate(raw) };
      return /^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? { ok: true, value: String(raw) } : { ok: false, reason: 'BAD_DATE' };
    }
  }
}
```

Catatan: format angka berpemisah ribuan titik (`1.250`) tidak ditangani oleh `replace` di atas dan akan salah dibaca. Karena memakai `UNFORMATTED_VALUE`, nilai angka datang sebagai number sehingga kasus ini hanya terjadi jika sel berisi teks. Baris seperti itu harus ditolak dengan `NOT_A_NUMBER`, bukan ditebak. Ganti `replace` dengan pemeriksaan ketat jika menemui kasus nyata.

### 7.4 Algoritma per lokasi

```
syncLocation(locationId, trigger, triggeredById?):
  lock = tryAdvisoryLock(locationId); if (!lock) return skip
  run = create SyncRun(status=RUNNING)
  mappings = load SheetMapping where locationId, group by (tab, entity)
  for each group:
     if any mapping.tab/sourceHeader == 'TODO_CONFIRM' -> report entity FAILED('MAPPING_NOT_CONFIGURED'); continue
     rows = sheets.values.get(spreadsheetId, range = `'${tab}'`, UNFORMATTED_VALUE, SERIAL_NUMBER)
     header = rows[0].map(normalizeHeader)
     missing = mappings.filter(m => required && !header.includes(normalizeHeader(m.sourceHeader)))
     if missing.length -> report entity FAILED('MISSING_HEADERS', missing names); continue   // data lama tetap
     for each data row (index i, nomor baris sheet = i + 1):
        parse tiap field sesuai fieldType; jika wajib gagal -> rejected(rowNumber, field, reason)
        bangun key; jika key sudah ada di batch ini -> rejected('DUPLICATE_KEY')
     upsert accepted rows dalam transaksi per entity (batch 200 baris)
        PRODUCT -> Product by sku
        STOCK   -> StockLevel by (productId, locationId); SKU tak dikenal -> rejected('UNKNOWN_SKU')
        SALE    -> Sale by (locationId, sourceKey)
        FORECAST/TARGET -> by (productId, locationId, period)
  run.status = SUCCESS (semua entity sukses tanpa tolakan fatal) | PARTIAL (ada entity gagal atau baris ditolak) | FAILED (semua gagal)
  run.finishedAt, rowsAccepted, rowsRejected, report
  audit 'sync.run' (atau 'sync.failed')
  release lock
```

Urutan entitas: `PRODUCT` → `STOCK` → `FORECAST` → `TARGET` → `SALE`. Jika `PRODUCT` gagal, `STOCK`, `SALE`, dll. tetap dicoba tetapi baris dengan SKU tak dikenal ditolak.

Catatan performa: upsert per baris dalam transaksi cukup hingga sekitar 20.000 baris penjualan. Jika lebih, ganti ke `INSERT ... ON CONFLICT DO UPDATE` lewat `$executeRaw` dalam batch. Jangan optimasi dini.

Penjadwalan: daftarkan job di `onModuleInit` memakai `SchedulerRegistry` dan `CronJob` dengan ekspresi dari `SYNC_CRON`, zona waktu `Asia/Jakarta`. Jika `SYNC_ENABLED=false` jangan daftarkan. Job berjalan berurutan untuk tiap lokasi, kegagalan satu lokasi tidak menghentikan lokasi lain.

### 7.5 Bentuk `report` dan status

```ts
interface SyncReport {
  entities: Array<{
    entity: SheetEntity; tab: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    accepted: number; rejected: number;
    error?: { code: 'MISSING_HEADERS' | 'MAPPING_NOT_CONFIGURED' | 'SHEET_UNREACHABLE'; message: string; headers?: string[] };
    rejectedRows: Array<{ row: number; field?: string; reason: string }>;   // maksimum 200 baris pertama, sisanya diringkas
  }>;
}
```

`GET /sync/status?locationId=` mengembalikan:

```ts
{ lastSuccessAt: string | null; lastRun: { status; startedAt; finishedAt; rowsAccepted; rowsRejected } | null;
  stale: boolean;               // true jika lastSuccessAt null atau lebih tua dari SYNC_STALE_MINUTES
  staleAfterMinutes: number }
```

Halaman admin menampilkan laporan terakhir per entitas, termasuk 200 baris tertolak pertama, dan tombol Jalankan sekarang.

---

## 8. Dashboard: definisi dan rumus

Semua perhitungan di backend. Frontend hanya menampilkan. Tanggal "hari ini" dan "bulan ini" dihitung di zona **Asia/Jakarta**. Semua endpoint menerima `locationId` dan memanggil `assertLocation`.

### 8.1 Status stok per SKU (urutan prioritas)

| Kondisi | Status | Label UI |
|---|---|---|
| `qty = 0` | `EMPTY` | Habis |
| `qty < safetyStock` | `CRITICAL` | Kritis |
| `qty < minStock` | `MINIMUM` | Minimal |
| lainnya | `SAFE` | Aman |

Arti kartu: Aman = stok di atas minimal; Minimal = di bawah batas minimal; Kritis = di bawah safety stock; Habis = stok 0 dan masih dibutuhkan (`forecastQty > 0` pada bulan berjalan).

### 8.2 Ringkasan Penjualan (`GET /dashboard/sales?locationId&from&to`)

Rumus berikut **sudah diverifikasi terhadap screenshot v1** (hari ke-18 dari 30, terjual 30 pcs, forecast bulan 3.419 pcs): forecast s.d. hari ini = 3.419 × 18 / 30 = 2.051; terjual vs forecast = 30 / 2.051 = 1%; proyeksi akhir bulan = 30 / 18 × 30 = 50.

| Kartu | Definisi |
|---|---|
| `revenue` (Omzet s.d. hari ini) | Σ `total` penjualan pada rentang. `null` tanpa `finance:read` |
| `previousMonthRevenue` | Σ `total` seluruh bulan kalender sebelumnya (subjudul "Oktober total Rp 71,2 jt") |
| `soldQty` | Σ `qty` pada rentang |
| `forecastQty` | Σ `forecast.qty` bulan berjalan × `daysElapsed / daysInMonth`, dibulatkan. Untuk rentang lintas bulan, proporsikan per bulan menurut jumlah hari yang tercakup |
| `soldVsForecastPct` | `soldQty / forecastQty × 100`; `null` jika `forecastQty = 0`. UI membulatkan ke bilangan bulat |
| `projectedMonthEndQty` | `soldQty / daysElapsed × daysInMonth`, dibulatkan. Hanya bermakna jika rentang adalah bulan berjalan dari tanggal 1; selain itu `null` (UI menampilkan "–") |
| `stockShortageQty` | **ASUMSI, konfirmasi ke klien.** Σ per SKU `max(0, (projectedSku − soldSku) − stockQty)` |
| `shortageSkuCount` | Jumlah SKU dengan kekurangan > 0 |
| `emptySkuCount` | Jumlah SKU berstatus `EMPTY` |
| `stockValue` | **ASUMSI, konfirmasi ke klien.** Σ `qty × cost`. `null` tanpa `finance:read` |
| `criticalSkuCount` | Jumlah SKU berstatus `CRITICAL` |

Bentuk respons:

```ts
interface SalesDashboard {
  meta: { locationId: string; from: string; to: string; daysElapsed: number; daysInMonth: number;
          lastSuccessAt: string | null; stale: boolean };
  cards: {
    revenue: number | null; previousMonthRevenue: number | null;
    soldQty: number; forecastQty: number; soldVsForecastPct: number | null;
    projectedMonthEndQty: number | null; stockShortageQty: number | null;
    shortageSkuCount: number; emptySkuCount: number; criticalSkuCount: number;
    stockValue: number | null;
  };
  daily: Array<{ date: string; qty: number; revenue: number | null }>;
  products: Array<{ sku: string; name: string; soldQty: number; forecastQty: number; pct: number | null;
                    stockQty: number; status: 'SAFE' | 'MINIMUM' | 'CRITICAL' | 'EMPTY' }>;
}
```

Filter cepat di UI: `Bulan ini` (tanggal 1 s.d. hari ini), `Bulan lalu` (penuh), `30 hari` (hari ini − 29 s.d. hari ini), `Pilih tanggal` (bebas, maksimum 366 hari). Rentang default: Bulan ini.

### 8.3 Persediaan Barang (`GET /dashboard/inventory?locationId&status?`)

```ts
interface InventoryDashboard {
  meta: { locationId: string; lastSuccessAt: string | null; stale: boolean };
  cards: { totalSku: number; safeCount: number; minimumCount: number; criticalCount: number; emptyCount: number;
           stockValue: number | null };
  rows: Array<{ sku: string; name: string; qty: number; minStock: number; safetyStock: number;
                status: 'SAFE' | 'MINIMUM' | 'CRITICAL' | 'EMPTY'; value: number | null; syncedAt: string }>;
}
```

Lima kartu ini sama dengan baris kartu paling atas di v1: Total produk jadi, Aman, Minimal, Kritis, Habis. Parameter `status` memfilter `rows`.

### 8.4 Capaian Target Produksi (`GET /dashboard/production?locationId&period=YYYY-MM`)

Tampilan halaman ini tidak terlihat di bahan yang tersedia, jadi dibuat sederhana dan **ditinjau bersama klien**. Default `period` = bulan berjalan.

```ts
interface ProductionDashboard {
  meta: { locationId: string; period: string; lastSuccessAt: string | null; stale: boolean };
  cards: { totalTarget: number; totalActual: number; achievementPct: number | null;
           skuReached: number; skuBelow: number };
  rows: Array<{ sku: string; name: string; target: number; actual: number; pct: number | null; gap: number }>;  // gap = target - actual
}
```

### 8.5 Ekspor CSV

`GET /dashboard/:page/export` (`page` = `sales`|`production`|`inventory`, parameter sama dengan halaman). Isi: baris `rows`/`products` dari respons yang sama (satu sumber perhitungan, angka dijamin sama dengan layar). Pengaturan: UTF-8 dengan BOM, pemisah koma, header kolom berbahasa Indonesia, angka mentah tanpa simbol atau pemisah ribuan, tanggal `YYYY-MM-DD`. Nama file: `tridhata-{page}-{lokasi}-{from}_{to}.csv`. Kolom keuangan dikosongkan bagi yang tak punya `finance:read`. Setiap ekspor tercatat sebagai `export.downloaded`.

---

## 9. Frontend dan desain antarmuka

### 9.1 Prinsip

Antarmuka adalah **alat kerja**: tenang, rapat informasi, mudah dipindai. Acuan gaya: kesederhanaan antarmuka Apple (ruang kosong terukur, hierarki dari ukuran dan bobot huruf, warna hemat). Bukan situs promosi. Struktur informasi mengikuti v1 (sidebar kiri bergrup, bilah atas dengan status sinkron, kartu angka di atas, tabel di bawah) karena pengguna sudah terbiasa, tetapi tampilan dan kodenya dibuat ulang.

### 9.2 Persiapan

1. Inisialisasi shadcn/ui dengan CLI resmi (ikuti dokumentasi untuk versi Tailwind yang dipakai). Komponen disalin ke `src/components/ui`.
2. Komponen yang dipakai: `button`, `input`, `label`, `select`, `dialog`, `sheet`, `tabs`, `table`, `badge`, `tooltip`, `skeleton`, `sonner`, `dropdown-menu`, `calendar`, `popover`, `chart`, `form`, `alert`, `separator`, `scroll-area`. Jangan menambah komponen lain tanpa alasan.
3. Font: `pnpm --filter web add @fontsource-variable/inter` lalu `import '@fontsource-variable/inter'` di `main.tsx`. **Tidak ada Google Fonts atau CDN.**
4. Semua warna, radius, dan bayangan berasal dari token di `styles/index.css`. **Dilarang** memakai kelas warna Tailwind mentah (`bg-blue-500`, dll.) di komponen fitur. Pakai token (`bg-card`, `text-muted-foreground`, `border-border`, dst.).

### 9.3 Token desain

Pertahankan struktur `@theme inline` hasil `shadcn init`. Isi variabel berikut (nilai hex boleh dikonversi ke format yang dipakai versi shadcn terpasang, selama tampilannya sama):

```css
:root {
  --radius: 0.625rem;                       /* 10px: kartu, panel. rounded-md = 8px: tombol, input */
  --background: #F5F5F7;
  --foreground: #1D1D1F;
  --card: #FFFFFF;           --card-foreground: #1D1D1F;
  --popover: #FFFFFF;        --popover-foreground: #1D1D1F;
  --primary: #2F6DB5;        --primary-foreground: #FFFFFF;
  --secondary: #EFEFF2;      --secondary-foreground: #1D1D1F;
  --muted: #EFEFF2;          --muted-foreground: #6E6E73;
  --accent: #E8F0FA;         --accent-foreground: #1F4F8C;
  --destructive: #C4311E;
  --border: #E5E5EA;         --input: #D2D2D7;         --ring: #2F6DB5;

  /* status stok: hanya untuk makna, bukan hiasan */
  --status-safe: #1F8A4C;     --status-safe-bg: #E7F4EC;
  --status-minimum: #B26A00;  --status-minimum-bg: #FBF0DC;
  --status-critical: #C4311E; --status-critical-bg: #FBE9E6;
  --status-empty: #7A1F16;    --status-empty-bg: #F3E3E1;
  --warning: #B26A00;         --warning-bg: #FBF0DC;
}

html { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', Inter, 'Segoe UI', Roboto, sans-serif; }
body { font-size: 14px; line-height: 1.5; color: var(--foreground); background: var(--background);
       -webkit-font-smoothing: antialiased; font-feature-settings: 'cv11', 'ss01'; }
.tabular { font-variant-numeric: tabular-nums; }
```

Mode gelap tidak dibangun di Opsi 1, tetapi karena semua warna lewat variabel, blok `.dark { ... }` dapat ditambahkan nanti tanpa mengubah komponen.

Skala tipografi:

| Peran | Ukuran | Bobot | Catatan |
|---|---|---|---|
| Judul halaman | 28px | 600 | `letter-spacing: -0.02em` |
| Judul bagian | 20px | 600 | `letter-spacing: -0.01em` |
| Angka utama kartu | 28px | 600 | tabular-nums |
| Isi, tabel, tombol | 14px | 400 / 500 | |
| Label, keterangan | 12–13px | 400 / 500 | `text-muted-foreground` |

Skala jarak kelipatan 4px (4, 8, 12, 16, 24, 32, 48). Radius hanya dua: 10px (kartu, panel, dialog) dan 8px (tombol, input, badge). `rounded-full` hanya untuk avatar dan titik status. Pemisah memakai garis 1px, **bukan bayangan**. Satu-satunya bayangan: popover/dropdown/dialog `0 8px 24px rgb(0 0 0 / 0.08)`. Animasi 150ms `ease-out`, tanpa pantulan, dinonaktifkan jika `prefers-reduced-motion`.

### 9.4 Daftar periksa anti-slop (wajib lulus sebelum halaman dianggap selesai)

1. Tidak ada gradien (terutama ungu atau biru-ungu), tidak ada efek kaca/blur dekoratif, tidak ada bayangan besar berwarna.
2. Tidak ada emoji dalam UI. Ikon hanya Lucide: satu ukuran per konteks (16px di tombol dan tabel, 20px di navigasi), `strokeWidth` 1.75 seragam.
3. Tidak ada kartu di dalam kartu. Tidak ada barisan kartu identik hanya untuk mengisi ruang. Kartu angka dipakai karena ada angka yang harus dibandingkan.
4. Teks antarmuka memakai istilah kerja klien: PPIC, SKU, produk jadi, safety stock, pcs. Tidak ada lorem ipsum, sapaan basa-basi ("Selamat datang kembali!"), slogan, atau kalimat bertele-tele.
5. Judul dan tombol berupa kata kerja atau nama objek yang jelas: `Setujui`, `Tolak`, `Unduh data`, `Muat ulang`, `Jalankan sekarang`. Bukan kalimat promosi.
6. Hierarki dari ukuran, bobot, dan jarak. Maksimal **satu** warna aksen per layar, **satu** tombol utama (`default`) per area.
7. Angka rata kanan di tabel, `tabular-nums`, pemisah ribuan titik dan desimal koma (id-ID). Angka disingkat ("Rp 1,8 jt") **hanya di kartu ringkasan**, angka penuh di tabel dan ekspor.
8. Tidak ada elemen dekoratif tanpa informasi: tidak ada ilustrasi stok, hero, pola latar, atau maskot.
9. Setiap halaman punya tiga keadaan yang dirancang: **memuat** (skeleton dengan bentuk konten asli, bukan spinner di tengah layar), **kosong** (menjelaskan penyebab dan langkah berikutnya), **galat** (pesan jelas + tombol `Coba lagi`).
10. Indikator kesegaran data selalu terlihat di bilah atas (bagian 9.5). Jika `stale`, tampil banner kuning di atas konten: "Data terakhir diperbarui {waktu}. Angka di bawah mungkin belum mencerminkan kondisi terbaru."
11. Status stok tidak pernah disampaikan dengan warna saja. Selalu ada teks label (`Aman`, `Minimal`, `Kritis`, `Habis`) di dalam `Badge`.
12. Kontras teks minimal 4,5 : 1. Seluruh fitur bisa dipakai dengan keyboard, fokus terlihat jelas (`ring`), target sentuh minimal 40px di perangkat sentuh.
13. Diuji pada lebar 360, 768, dan 1366px. Di bawah 1024px sidebar berubah menjadi `Sheet` (laci) yang dibuka dari tombol menu.
14. Tidak ada teks "Lorem", "Dashboard Title", "Card Title", atau nama placeholder bawaan templat yang tersisa di kode.

Contoh teks yang benar dan salah:

| Salah | Benar |
|---|---|
| "Belum ada data. Mulai petualanganmu!" | "Belum ada penjualan pada rentang ini. Ubah rentang tanggal atau periksa sinkron terakhir." |
| "Oops! Terjadi kesalahan 😢" | "Data penjualan gagal dimuat. Periksa koneksi, lalu coba lagi." |
| "Powerful insights at a glance" | (tidak ada, langsung judul halaman) |
| "Submit" | "Kirim pengajuan" |

### 9.5 Struktur aplikasi dan rute

```
/login                      publik
/ubah-sandi                 wajib jika mustChangePassword
/                           redirect ke /penjualan
/penjualan                  dashboard:read      Ringkasan Penjualan
/produksi                   dashboard:read      Capaian Target Produksi
/persediaan                 dashboard:read      Persediaan Barang
/persetujuan                approval:create     Daftar + buat + setujui/tolak
/admin/pengguna             user:manage
/admin/log                  audit:read
/admin/sinkron              sync:manage
```

Parameter lokasi dan rentang tanggal disimpan di **URL search params** (`?lokasi=BOGOR&dari=2026-11-01&sampai=2026-11-18`) agar tautan dapat dibagikan. Komponen `<RequirePermission permission="...">` membungkus rute. Menu sidebar hanya menampilkan item yang diizinkan. Ini kenyamanan, bukan pengamanan.

Sidebar (lebar 240px), bergrup:
`DASHBOARD`: Ringkasan Penjualan, Capaian Target Produksi, Persediaan Barang · `KEUANGAN`: Persetujuan · `ADMIN`: Pengguna, Log Aktivitas, Sinkron dan Pemetaan. Di atas: nama "Tridhata Ops" dan keterangan lokasi aktif. Pemilih lokasi (kontrol segmen "Bogor | Nganjuk") hanya menampilkan lokasi yang boleh diakses. Bilah atas: judul halaman, chip status sinkron, menu pengguna (profil, ganti sandi, keluar).

Chip status sinkron:

| Keadaan | Tampilan |
|---|---|
| Segar | titik hijau + "Tersinkron 09.55" |
| `stale` | titik kuning + "Data terakhir 3 jam lalu" |
| Run terakhir gagal | titik merah + "Sinkron gagal" (admin: tautan ke halaman Sinkron) |
| Belum pernah sinkron | titik abu + "Belum tersinkron" |

### 9.6 Spesifikasi halaman

**Ringkasan Penjualan.** Judul + tanggal hari ini. Baris kontrol: segmen `Bulan ini | Bulan lalu | 30 hari | Pilih tanggal`, label rentang aktif (`01/11/2026 – 18/11/2026`), tombol `Unduh data`. Lima `StatCard`: Omzet s.d. hari ini (subteks "Oktober total Rp 71,2 jt"), Terjual vs forecast (nilai persen, subteks "30 dari 2.051 pcs"), Proyeksi akhir bulan (subteks "Forecast bulan 3.419 pcs"), Kekurangan stok s.d. akhir bulan (subteks "0 SKU kurang · 0 SKU sudah habis"), Nilai stok produk jadi (subteks "0 kritis · 0 habis"). Di bawahnya grafik harian (satu seri, tanpa gradien, tanpa efek 3D) dan tabel produk (kolom: SKU, Nama, Terjual, Forecast, Capaian %, Stok, Status; urut, cari). Jika `cards.revenue` adalah `null`, kartu Omzet dan Nilai stok **tidak dirender** (bukan diisi strip).

**Persediaan Barang.** Lima kartu: Total produk jadi, Aman, Minimal, Kritis, Habis (kartu status memakai garis kiri 3px berwarna status, tidak lebih). Filter chip status. Tabel: SKU, Nama, Stok, Minimal, Safety stock, Status, Nilai, Diperbarui.

**Capaian Target Produksi.** Pemilih periode (bulan). Kartu: Total target, Total realisasi, Capaian %, SKU tercapai, SKU di bawah target. Tabel dengan batang kemajuan tipis (4px) pada kolom capaian. **Tinjau bersama klien**, bagian ini belum punya acuan visual.

**Persetujuan.** Tab `Menunggu | Disetujui | Ditolak`. Tabel: Tanggal, Pemohon, Jenis, Judul, Nilai, Status. Klik baris membuka `Sheet` samping berisi detail. Tombol `Setujui` dan `Tolak` hanya tampil bagi yang punya `approval:decide` dan bukan pemohonnya. `Tolak` memunculkan dialog dengan kolom alasan wajib. Tombol `Buat pengajuan` membuka dialog form (jenis, judul, catatan, nilai).

**Admin Pengguna.** Tabel pengguna, dialog tambah/ubah, aksi `Atur ulang sandi` (kata sandi sementara ditampilkan sekali dalam dialog dengan tombol salin, peringatan bahwa tidak akan tampil lagi).

**Admin Log Aktivitas.** Tabel (waktu, pengguna, aksi, objek, IP) dengan filter pengguna, aksi, tanggal; klik baris menampilkan `before`/`after` sebagai JSON terformat di `Sheet`. Muat lebih banyak dengan paginasi kursor.

**Admin Sinkron dan Pemetaan.** Per lokasi: status terakhir, tombol `Jalankan sekarang`, laporan per entitas (diterima, ditolak, galat, daftar baris tertolak). Tab `Pemetaan`: tabel mapping yang dapat diedit (tab, entitas, header sumber, field tujuan, tipe, wajib, kunci), simpan lewat `PUT /sync/mappings`. Mapping `TODO_CONFIRM` ditandai peringatan.

### 9.7 Kode inti frontend (acuan)

Klien API dengan satu kali refresh bersamaan (single-flight) dan token hanya di memori:

```ts
// src/lib/api-client.ts
const API = import.meta.env.VITE_API_URL as string;
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onSessionExpired: () => void = () => {};

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

export class ApiError extends Error {
  constructor(public status: number, public body: { code?: string; message?: string; details?: unknown } | null) {
    super(body?.message ?? 'Terjadi kesalahan');
  }
}

async function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (r) => (r.ok ? ((await r.json()) as { accessToken: string }).accessToken : null))
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && canRetry && !path.startsWith('/auth/')) {
    const t = await refreshAccessToken();
    if (t) { setAccessToken(t); return api<T>(path, init, false); }
    setAccessToken(null); onSessionExpired();
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
```

Saat aplikasi dimuat: panggil `POST /auth/refresh`. Berhasil → simpan token, ambil `/me`, render aplikasi. Gagal → ke `/login`. Tampilkan skeleton layar penuh selama pengecekan ini (bukan kilasan halaman login).

Pemformat (satu-satunya tempat format angka dan tanggal):

```ts
// src/lib/format.ts
const nf = new Intl.NumberFormat('id-ID');
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const rupiahCompact = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 });

export const formatInt = (n: number) => nf.format(n);
export const formatRupiah = (n: number) => rupiah.format(n);
export const formatRupiahCompact = (n: number) => rupiahCompact.format(n);   // "Rp 1,8 jt": verifikasi keluarannya di tes
export const formatPct = (n: number | null) => (n === null ? '–' : `${Math.round(n)}%`);
```

Tulis tes Vitest untuk pemformat (termasuk kasus 1.800.000 → `Rp 1,8 jt`, dan spasi tak-putus yang mungkin disisipkan Intl). Jika keluaran Intl berbeda dari yang diharapkan di versi runtime tertentu, sesuaikan tes dan dokumentasikan.

### 9.8 Aturan teknis frontend

1. Data dari server hanya lewat TanStack Query. Tidak ada state global untuk data API. Kunci query menyertakan `lokasi`, `dari`, `sampai`.
2. Form memakai React Hook Form + skema Zod dari `packages/shared` (satu sumber aturan dengan backend). Pesan galat bidang dalam bahasa Indonesia.
3. Kode dipecah per fitur. Tidak ada berkas komponen lebih dari sekitar 250 baris. Pisahkan hook, komponen tampilan, dan pemetaan data.
4. Tidak ada `dangerouslySetInnerHTML`. Tidak ada `localStorage` untuk token atau data pengguna.
5. Variabel lingkungan frontend hanya `VITE_API_URL`.

---

## 10. Infrastruktur dan deployment

Frontend dan backend adalah dua unit terpisah: image, compose, dan alur CI/CD berbeda. Database tidak membuka port ke luar kontainer.

### 10.1 Topologi

| Komponen | Kontainer | Jaringan | Domain |
|---|---|---|---|
| Caddy (HTTPS, reverse proxy) | `tridhata-edge` | `edge` | semua |
| Frontend (Nginx, berkas statis) | `tridhata-web` | `edge` | `app.klien.com` |
| Backend (NestJS) | `tridhata-api` | `edge`, `internal` | `api.klien.com` |
| PostgreSQL 16 | `tridhata-db` | `internal` saja | tidak ada |

Prasyarat server: Ubuntu 24.04 LTS, Docker + Compose plugin, `docker network create edge`, firewall hanya membuka 22, 80, 443, login SSH dengan kunci saja, pembaruan keamanan otomatis aktif.

### 10.2 `apps/api/Dockerfile`

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api... --filter shared...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter shared build \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && corepack enable
COPY --from=build /app ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && node apps/api/dist/main.js"]
```

Catatan: image ini sengaja tidak diminimalkan (menyalin seluruh `/app` agar CLI Prisma tersedia untuk migrasi). Optimasi ukuran image bukan prioritas Opsi 1. Sesuaikan `dist/main.js` dengan lokasi output build NestJS yang sebenarnya.

### 10.3 `apps/web/Dockerfile` dan Nginx

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web... --filter shared...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter shared build && pnpm --filter web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
ENV API_ORIGIN=https://api.klien.com
EXPOSE 80
```

`apps/web/nginx.conf.template` (image Nginx resmi menjalankan `envsubst` pada berkas di `/etc/nginx/templates`):

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header X-Frame-Options DENY always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${API_ORIGIN}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }
  location = /index.html { add_header Cache-Control "no-cache"; }
  location / { try_files $uri /index.html; }
}
```

Catatan: header `add_header` di dalam `location` menimpa header level `server` di Nginx. Jika header keamanan harus ada juga pada respons `/assets/`, ulangi atau pindahkan ke `include` terpisah. Verifikasi dengan `curl -I`. `unsafe-inline` pada `style-src` dibutuhkan oleh Recharts dan Radix; jangan melonggarkan `script-src`.

### 10.4 Berkas Compose

`infra/compose.edge.yml`:

```yaml
services:
  edge:
    image: caddy:2
    container_name: tridhata-edge
    restart: unless-stopped
    ports: ['80:80', '443:443']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [edge]
volumes: { caddy_data: {}, caddy_config: {} }
networks: { edge: { external: true } }
```

`infra/compose.api.yml`:

```yaml
services:
  db:
    image: postgres:16
    container_name: tridhata-db
    restart: unless-stopped
    env_file: ../.env.db
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [internal]
  api:
    build: { context: .., dockerfile: apps/api/Dockerfile }
    container_name: tridhata-api
    restart: unless-stopped
    env_file: ../.env.api
    depends_on: { db: { condition: service_healthy } }
    networks: [internal, edge]
volumes: { pgdata: {} }
networks:
  internal: {}
  edge: { external: true }
```

`infra/compose.web.yml`:

```yaml
services:
  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
      args: { VITE_API_URL: https://api.klien.com }
    container_name: tridhata-web
    restart: unless-stopped
    environment: { API_ORIGIN: https://api.klien.com }
    networks: [edge]
networks: { edge: { external: true } }
```

`infra/Caddyfile`:

```
app.klien.com {
  encode zstd gzip
  reverse_proxy tridhata-web:80
}
api.klien.com {
  encode zstd gzip
  reverse_proxy tridhata-api:3000
}
```

Ganti `klien.com` dengan domain sebenarnya. Berkas `.env.api` dan `.env.db` dibuat di server, tidak masuk repositori.

### 10.5 Pencadangan

`infra/backup.sh`, dijadwalkan cron harian pukul 02:00 waktu server:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tridhata}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
docker exec tridhata-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_DIR/tridhata-$STAMP.dump"
find "$BACKUP_DIR" -name 'tridhata-*.dump' -mtime +"$KEEP_DAYS" -delete
```

Pemulihan (didokumentasikan di `docs/OPERATIONS.md` dan **diuji sekali sebelum serah terima**): hentikan `api`, `pg_restore --clean --if-exists -d $POSTGRES_DB` dari berkas dump, jalankan `api`, periksa `/health` dan buka dashboard. Rekomendasikan salinan luar server (misalnya bucket) bila klien setuju.

### 10.6 CI/CD (GitHub Actions)

Dua alur terpisah dengan pemicu jalur (`paths`).

`.github/workflows/api.yml`: pada push ke `main` yang menyentuh `apps/api/**`, `packages/shared/**`: pasang pnpm, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, jalankan tes dengan service container `postgres:16`. Pada tag `api-v*`: SSH ke server, `git pull`, `docker compose -f infra/compose.api.yml up -d --build api`, tunggu lalu cek `GET /health` (gagal jika bukan 200).

`.github/workflows/web.yml`: sama, untuk `apps/web/**` dan `packages/shared/**`, pada tag `web-v*`: `docker compose -f infra/compose.web.yml up -d --build web`.

Kredensial SSH disimpan di GitHub Secrets. Pin versi setiap action pihak ketiga ke versi atau commit tertentu. Rollback: checkout tag sebelumnya di server lalu ulangi `up -d --build`.

### 10.7 Pemantauan

`GET /health` memeriksa koneksi database dan mengembalikan `{ status: 'ok' }` atau 503, tanpa detail internal. Daftarkan ke layanan ping gratis. Log JSON `pino` dibaca lewat `docker logs tridhata-api`. Jangan mencatat header `Authorization` atau cookie (konfigurasi `redact` pada pino).

---

## 11. Daftar periksa keamanan

| # | Syarat | Verifikasi |
|---|---|---|
| 1 | Google Sheet dipindah ke akses privat dan hanya dibagikan ke service account (Viewer) | Buka tautan sheet di jendela samaran: harus diminta login |
| 2 | Tidak ada ID sheet, kunci, atau rahasia di build frontend | `grep` di `apps/web/dist` |
| 3 | Setiap endpoint (kecuali `@Public`) butuh token valid | Tes e2e: semua rute tanpa token → 401 |
| 4 | Izin dicek server, termasuk lingkup lokasi | Tes e2e matriks peran × endpoint × lokasi |
| 5 | Kata sandi argon2id, token refresh disimpan sebagai hash, rotasi + deteksi pemakaian ulang | Tes unit/e2e |
| 6 | Pembatasan login (throttle IP + kunci akun) | Tes e2e |
| 7 | Header keamanan (Helmet di API, CSP di Nginx) | `curl -I` pada kedua domain |
| 8 | CORS hanya `CORS_ORIGIN` | Permintaan dari asal lain ditolak |
| 9 | Semua input divalidasi Zod, query lewat Prisma | Tinjauan kode: tidak ada SQL mentah dengan interpolasi string |
| 10 | Log tidak memuat kata sandi, token, cookie | Tinjauan konfigurasi pino dan `redact()` audit |
| 11 | Database tanpa port publik, role aplikasi tanpa UPDATE/DELETE pada `audit_log` | `docker ps`, `\dp audit_log` |
| 12 | `npm audit`/`pnpm audit` tanpa temuan tinggi/kritis yang belum ditangani | CI |

---

## 12. Pengujian

Gunakan abstraksi `SheetsClient` (antarmuka `getValues(spreadsheetId, tab): Promise<unknown[][]>`) sehingga tes memakai implementasi palsu. **Tidak ada tes yang memanggil Google sungguhan.**

| Area | Jenis | Yang harus terbukti |
|---|---|---|
| Matriks izin | e2e (Jest + Supertest, DB Postgres uji) | `STAFF` tidak bisa memutuskan pengajuan; `ADMIN` tidak bisa memutuskan; `FINANCE` bisa; pemohon tidak bisa memutuskan miliknya; pengguna tanpa `location:all` ditolak di lokasi lain (403) |
| Masking keuangan | e2e | Tanpa `finance:read`, `revenue`, `stockValue`, `price`, `total`, `cost`, `value` bernilai `null`, termasuk di CSV |
| Auth | e2e | Kunci akun setelah 5 gagal; rotasi refresh; pemakaian ulang token lama mencabut seluruh keluarga; ganti sandi mencabut semua token; `mustChangePassword` memblokir endpoint lain |
| Audit | e2e | Setiap POST/PATCH/PUT/DELETE (selain `/auth/refresh`) menambah baris `audit_log`; tidak ada `passwordHash` atau token di `before`/`after` |
| Sinkron | unit + integrasi (klien palsu) | Header berganti nama → entitas gagal, data lama tidak berubah; baris rusak dilaporkan dengan nomor baris; sinkron dua kali tidak menggandakan; `TODO_CONFIRM` ditolak; kunci duplikat ditolak; tanggal serial terkonversi benar |
| Rumus dashboard | unit | Fixture hari ke-18 dari 30, terjual 30 pcs, forecast 3.419 → `forecastQty = 2051`, `soldVsForecastPct ≈ 1`, `projectedMonthEndQty = 50`; kasus tepi: forecast 0, bulan Februari, rentang lintas bulan, tengah malam di zona Asia/Jakarta |
| Status stok | unit | Prioritas `EMPTY > CRITICAL > MINIMUM > SAFE`, termasuk nilai batas tepat sama dengan ambang |
| Keputusan ganda | integrasi | Dua permintaan `decide` bersamaan pada satu pengajuan: tepat satu berhasil, satu mendapat 409 |
| Pemformat | Vitest | `formatRupiahCompact(1_800_000)`, `formatPct(null)`, `formatInt(1250)` |
| Komponen | Vitest + Testing Library | `RequirePermission` menyembunyikan dan mengalihkan; tombol `Setujui` hanya muncul untuk yang berhak |
| Alur utama | Playwright (satu skenario) | login → ubah sandi → buka Ringkasan Penjualan → ubah rentang → unduh CSV |

---

## 13. Variabel lingkungan

`.env.example` (tanpa nilai rahasia nyata):

```
# --- api (.env.api)
NODE_ENV=production
PORT=3000
TZ=Asia/Jakarta
DATABASE_URL=postgresql://USER:PASSWORD@db:5432/tridhata?schema=public
JWT_ACCESS_SECRET=ganti-dengan-string-acak-minimal-32-karakter
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=7
CORS_ORIGIN=https://app.klien.com
COOKIE_DOMAIN=.klien.com
GOOGLE_SA_EMAIL=nama@project.iam.gserviceaccount.com
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SHEET_ID_BOGOR=
SHEET_ID_NGANJUK=
SYNC_ENABLED=true
SYNC_CRON=*/15 * * * *
SYNC_STALE_MINUTES=120
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=

# --- db (.env.db)
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=tridhata

# --- web (build arg dan runtime)
VITE_API_URL=https://api.klien.com
API_ORIGIN=https://api.klien.com
```

Catatan: tidak ada `JWT_REFRESH_SECRET` karena token refresh berupa string acak yang disimpan sebagai hash, bukan JWT. Ini menggantikan daftar variabel di ringkasan sebelumnya.

---

## 14. Rencana kerja dan kriteria penerimaan

Dua pengembang: **A** = backend, database, infrastruktur; **B** = frontend dan desain. Perkiraan mulai 25 November 2026. Setiap fase memiliki kriteria penerimaan yang **harus lulus** sebelum lanjut.

### Fase 0: Fondasi proyek (hari 1–2)

- [ ] Monorepo pnpm, `tsconfig.base.json`, ESLint, Prettier, Husky/lint-staged (opsional).
- [ ] `packages/shared` ter-build; api dan web dapat mengimpornya.
- [ ] Skeleton NestJS (health), skeleton Vite, `docker compose` lokal untuk Postgres.
- [ ] `shadcn init`, token desain, font Inter dihosting sendiri.
- [ ] CI dasar (lint, typecheck, tes) hijau.

**Penerimaan:** `pnpm install && pnpm dev:api` dan `pnpm dev:web` berjalan; CI hijau pada PR pertama.

### Fase 1: Database dan autentikasi (minggu 1)

- [ ] Skema Prisma bagian 5, migrasi awal, seed.
- [ ] Modul auth, guard global, `PermissionsGuard`, `AuditService`, `/me`, `/health`.
- [ ] Format galat seragam dan `ZodValidationPipe`.

**Penerimaan:** tes e2e auth dan matriks izin (bagian 12) lulus; login → `/me` bekerja; refresh dirotasi.

### Fase 2: Admin dan kerangka UI (minggu 2) — **titik kritis jadwal**

- [ ] Modul users, endpoint `/audit-logs`, `/locations`.
- [ ] Frontend: layout, sidebar, bilah atas, pemilih lokasi, login, ganti sandi, `RequirePermission`, halaman Pengguna dan Log Aktivitas.

**Penerimaan:** admin membuat pengguna `FINANCE` dan `STAFF`, masing-masing login dan hanya melihat menu yang sesuai; setiap aksi admin muncul di Log Aktivitas. **Jika fase 1–2 tidak selesai di akhir minggu 2, laporkan segera bahwa tenggat berisiko.**

### Fase 3: Sinkron Sheets (minggu 3)

- [ ] `SheetsClient`, modul `sheets-sync`, mapping CRUD, cron, advisory lock, `SyncRun`, `/sync/status`.
- [ ] Frontend: halaman Sinkron dan Pemetaan, chip status sinkron, banner `stale`.

**Penerimaan:** seluruh tes sinkron (bagian 12) lulus dengan klien palsu; dengan sheet uji nyata (disediakan klien), mapping terisi dan satu putaran sinkron berhasil; header yang diubah menghasilkan pesan galat yang menyebut header itu.

### Fase 4: Dashboard dan persetujuan (minggu 4)

- [ ] Tiga endpoint dashboard, ekspor CSV, masking keuangan.
- [ ] Modul approvals + halaman Persetujuan.
- [ ] Tiga halaman dashboard sesuai bagian 9.6.

**Penerimaan:** tes rumus (fixture 30 / 2.051 / 50) lulus; angka tiga kartu utama dicocokkan dengan hitungan manual dari sheet klien; ekspor CSV terbuka benar di Excel (karakter Indonesia dan kolom benar); `STAFF` tanpa `finance:read` tidak melihat angka keuangan di layar maupun CSV.

### Fase 5: Pengerasan dan serah terima (minggu 5, sampai 28 Desember)

- [ ] Compose, Caddy, CI deploy, deploy ke VPS klien, HTTPS aktif.
- [ ] Pencadangan harian + uji pemulihan.
- [ ] Daftar periksa keamanan bagian 11 lulus semua.
- [ ] Tinjauan anti-slop (bagian 9.4) dan uji lebar 360/768/1366.
- [ ] `docs/DEPLOY.md`, `docs/OPERATIONS.md`, `README.md`, `docs/OPEN_QUESTIONS.md` final.
- [ ] Uji penerimaan bersama klien, perbaikan, serah terima.

**Penerimaan:** seluruh Definition of Done di bawah.

### Definition of Done (seluruh proyek)

1. Semua item cakupan 1.2 berfungsi di produksi pada domain klien dengan HTTPS.
2. Tes bagian 12 lulus di CI.
3. Daftar periksa keamanan bagian 11 lulus.
4. Tidak ada ID sheet atau rahasia terlihat di sisi browser; sheet sudah privat.
5. Backup harian berjalan dan pemulihan sudah diuji.
6. Dokumentasi pemasangan, operasi, dan pemetaan sheet lengkap dan dicoba oleh orang selain penulisnya.
7. Tidak ada `TODO_CONFIRM` tersisa di mapping produksi.
8. Tinjauan anti-slop lulus untuk semua halaman.

---

## 15. Pertanyaan terbuka (jangan ditebak, catat di `docs/OPEN_QUESTIONS.md`)

| # | Pertanyaan | Asumsi sementara |
|---|---|---|
| 1 | Nama tab dan header sheet Bogor dan Nganjuk, apakah strukturnya sama? | Belum diketahui. Mapping `TODO_CONFIRM`, diisi setelah melihat sheet |
| 2 | Apakah tab MASTER hanya berisi produk jadi? | Ya. Jika bukan, perlu kolom penanda jenis |
| 3 | Dari mana pengajuan berasal? | Dibuat lewat form di aplikasi (bagian 6.8) |
| 4 | Definisi "Kekurangan stok s.d. akhir bulan" | Bagian 8.2 (berbasis proyeksi), konfirmasi |
| 5 | "Nilai stok produk jadi" memakai HPP atau harga jual? | `qty × cost` (HPP), konfirmasi |
| 6 | Apakah penjualan di sheet punya nomor dokumen atau kunci unik per baris? | Tidak pasti. Kunci duplikat akan dilaporkan sebagai tolakan |
| 7 | Siapa saja pengguna awal, perannya, dan lokasinya? | Admin awal dari seed; sisanya dibuat admin |
| 8 | Apakah staf boleh melihat omzet dan nilai stok? | Tidak secara bawaan; dapat diberi `finance:read` per pengguna |
| 9 | Desain halaman Capaian Target Produksi v1 | Tidak terlihat; dibuat sederhana dan ditinjau klien |
| 10 | Server: sudah ada atau perlu disiapkan; domain apa? | VPS disiapkan klien, domain dari klien |
| 11 | Apakah penghapusan baris di sheet harus menghapus data di database? | Tidak. Sinkron hanya menambah dan memperbarui (keterbatasan yang dicatat) |

---

## 16. Jalur ke Opsi 2 dan 3 (jangan dibangun sekarang)

Sudah disiapkan di skema: kolom `version` (`StockLevel`, `Request`) untuk penguncian optimistik, kolom `level` pada `Approval` untuk persetujuan berjenjang, modul yang berdiri sendiri untuk penambahan modul baru. Opsi 2 menambah: penguncian optimistik pada semua entitas yang bisa diedit, persetujuan berjenjang dengan batas nilai, seluruh halaman Finance, peran dan izin yang lebih rinci, serta log aktivitas lengkap dengan filter lanjutan. Opsi 3 menambah: perintah kerja, penomoran dokumen otomatis, dan pembuatan dokumen PDF dari templat.
