-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SheetEntity" AS ENUM ('PRODUCT', 'STOCK', 'SALE', 'FORECAST', 'TARGET');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('STRING', 'INT', 'DECIMAL', 'DATE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('CRON', 'MANUAL');

-- CreateTable
CREATE TABLE "lokasi" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spreadsheetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lokasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peran" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[],

    CONSTRAINT "peran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengguna" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "division" TEXT,
    "roleId" UUID NOT NULL,
    "defaultLocationId" UUID,
    "extraPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akses_lokasi" (
    "userId" UUID NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "akses_lokasi_pkey" PRIMARY KEY ("userId","locationId")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produk" (
    "id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stok_produk" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stok_produk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penjualan" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "docNo" TEXT,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penjualan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_produksi" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "targetQty" INTEGER NOT NULL,
    "actualQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "target_produksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengajuan" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "decision" "Decision" NOT NULL,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_mapping" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "tab" TEXT NOT NULL,
    "entity" "SheetEntity" NOT NULL,
    "sourceHeader" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "isKey" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheet_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "triggeredById" UUID,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowsAccepted" INTEGER NOT NULL DEFAULT 0,
    "rowsRejected" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB,

    CONSTRAINT "sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lokasi_code_key" ON "lokasi"("code");

-- CreateIndex
CREATE UNIQUE INDEX "peran_name_key" ON "peran"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_userId_idx" ON "refresh_token"("userId");

-- CreateIndex
CREATE INDEX "refresh_token_familyId_idx" ON "refresh_token"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "produk_sku_key" ON "produk"("sku");

-- CreateIndex
CREATE INDEX "stok_produk_locationId_idx" ON "stok_produk"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "stok_produk_productId_locationId_key" ON "stok_produk"("productId", "locationId");

-- CreateIndex
CREATE INDEX "penjualan_locationId_date_idx" ON "penjualan"("locationId", "date");

-- CreateIndex
CREATE INDEX "penjualan_productId_idx" ON "penjualan"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "penjualan_locationId_sourceKey_key" ON "penjualan"("locationId", "sourceKey");

-- CreateIndex
CREATE INDEX "forecast_locationId_period_idx" ON "forecast"("locationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_productId_locationId_period_key" ON "forecast"("productId", "locationId", "period");

-- CreateIndex
CREATE INDEX "target_produksi_locationId_period_idx" ON "target_produksi"("locationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "target_produksi_productId_locationId_period_key" ON "target_produksi"("productId", "locationId", "period");

-- CreateIndex
CREATE INDEX "pengajuan_status_createdAt_idx" ON "pengajuan"("status", "createdAt");

-- CreateIndex
CREATE INDEX "pengajuan_requesterId_idx" ON "pengajuan"("requesterId");

-- CreateIndex
CREATE INDEX "approval_requestId_idx" ON "approval"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "sheet_mapping_locationId_entity_targetField_key" ON "sheet_mapping"("locationId", "entity", "targetField");

-- CreateIndex
CREATE INDEX "sync_run_locationId_startedAt_idx" ON "sync_run"("locationId", "startedAt");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_userId_createdAt_idx" ON "audit_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "pengguna" ADD CONSTRAINT "pengguna_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "peran"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengguna" ADD CONSTRAINT "pengguna_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "lokasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akses_lokasi" ADD CONSTRAINT "akses_lokasi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akses_lokasi" ADD CONSTRAINT "akses_lokasi_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "lokasi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_produk" ADD CONSTRAINT "stok_produk_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penjualan" ADD CONSTRAINT "penjualan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast" ADD CONSTRAINT "forecast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_produksi" ADD CONSTRAINT "target_produksi_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
