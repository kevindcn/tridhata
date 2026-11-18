import { PrismaClient, SheetEntity, FieldType } from '@prisma/client';
import * as argon2 from 'argon2';
import { ROLE_DEFAULTS, RoleName } from '@tridhata/shared';
import path from 'path';
import fs from 'fs';

// Muat .env baik saat dijalankan dari root maupun dari apps/api
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    if (typeof process.loadEnvFile === 'function') {
      try {
        process.loadEnvFile(p);
        break;
      } catch {
        // Lanjutkan mencoba path berikutnya
      }
    }
  }
}

const prisma = new PrismaClient();

async function main() {
  console.info('Memulai seeding basis data Tridhata Ops...');

  const isProduction = process.env.NODE_ENV === 'production';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || (!isProduction ? 'admin@tridhata.com' : undefined);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || (!isProduction ? 'AdminTridhata2026!' : undefined);

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi pada lingkungan production.',
    );
  }

  // 1. Lokasi: BOGOR dan NGANJUK (idempotent upsert)
  const bogor = await prisma.location.upsert({
    where: { code: 'BOGOR' },
    update: {
      name: 'Pabrik Bogor',
      spreadsheetId: process.env.SHEET_ID_BOGOR || null,
    },
    create: {
      code: 'BOGOR',
      name: 'Pabrik Bogor',
      spreadsheetId: process.env.SHEET_ID_BOGOR || null,
    },
  });

  const nganjuk = await prisma.location.upsert({
    where: { code: 'NGANJUK' },
    update: {
      name: 'Pabrik Nganjuk',
      spreadsheetId: process.env.SHEET_ID_NGANJUK || null,
    },
    create: {
      code: 'NGANJUK',
      name: 'Pabrik Nganjuk',
      spreadsheetId: process.env.SHEET_ID_NGANJUK || null,
    },
  });

  const locations = [bogor, nganjuk];
  console.info(`Lokasi terdaftar: ${locations.map((l) => l.code).join(', ')}`);

  // 2. Peran: ADMIN, FINANCE, STAFF (dengan permissions dari ROLE_DEFAULTS)
  const roles: Record<RoleName, { id: string; name: string }> = {} as never;

  for (const roleName of ['ADMIN', 'FINANCE', 'STAFF'] as RoleName[]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        permissions: [...ROLE_DEFAULTS[roleName]],
      },
      create: {
        name: roleName,
        permissions: [...ROLE_DEFAULTS[roleName]],
      },
    });
    roles[roleName] = role;
  }
  console.info('Peran terdaftar: ADMIN, FINANCE, STAFF');

  // 3. Akun Admin Awal
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
  });

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase().trim() },
    update: {
      name: 'Administrator Utama',
      roleId: roles.ADMIN.id,
      defaultLocationId: bogor.id,
      active: true,
    },
    create: {
      name: 'Administrator Utama',
      email: adminEmail.toLowerCase().trim(),
      passwordHash,
      roleId: roles.ADMIN.id,
      defaultLocationId: bogor.id,
      active: true,
      mustChangePassword: true,
      extraPermissions: [],
    },
  });

  // Hubungkan admin ke kedua lokasi
  for (const loc of locations) {
    await prisma.locationAccess.upsert({
      where: {
        userId_locationId: {
          userId: adminUser.id,
          locationId: loc.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        locationId: loc.id,
      },
    });
  }
  console.info(`Akun admin terdaftar: ${adminUser.email}`);

  // 4. Initial Sheet Mappings dengan placeholder TODO_CONFIRM
  interface MappingConfig {
    entity: SheetEntity;
    targetField: string;
    fieldType: FieldType;
    required: boolean;
    isKey: boolean;
  }

  const initialMappings: MappingConfig[] = [
    // PRODUCT
    { entity: 'PRODUCT', targetField: 'sku', fieldType: 'STRING', required: true, isKey: true },
    { entity: 'PRODUCT', targetField: 'name', fieldType: 'STRING', required: true, isKey: false },
    { entity: 'PRODUCT', targetField: 'unit', fieldType: 'STRING', required: false, isKey: false },
    { entity: 'PRODUCT', targetField: 'price', fieldType: 'DECIMAL', required: false, isKey: false },
    { entity: 'PRODUCT', targetField: 'cost', fieldType: 'DECIMAL', required: false, isKey: false },

    // STOCK
    { entity: 'STOCK', targetField: 'sku', fieldType: 'STRING', required: true, isKey: true },
    { entity: 'STOCK', targetField: 'qty', fieldType: 'INT', required: true, isKey: false },
    { entity: 'STOCK', targetField: 'minStock', fieldType: 'INT', required: true, isKey: false },
    { entity: 'STOCK', targetField: 'safetyStock', fieldType: 'INT', required: true, isKey: false },

    // SALE
    { entity: 'SALE', targetField: 'date', fieldType: 'DATE', required: true, isKey: true },
    { entity: 'SALE', targetField: 'sku', fieldType: 'STRING', required: true, isKey: true },
    { entity: 'SALE', targetField: 'docNo', fieldType: 'STRING', required: false, isKey: true },
    { entity: 'SALE', targetField: 'qty', fieldType: 'INT', required: true, isKey: false },
    { entity: 'SALE', targetField: 'price', fieldType: 'DECIMAL', required: true, isKey: false },
    { entity: 'SALE', targetField: 'total', fieldType: 'DECIMAL', required: false, isKey: false },

    // FORECAST
    { entity: 'FORECAST', targetField: 'sku', fieldType: 'STRING', required: true, isKey: true },
    { entity: 'FORECAST', targetField: 'period', fieldType: 'STRING', required: true, isKey: true },
    { entity: 'FORECAST', targetField: 'qty', fieldType: 'INT', required: true, isKey: false },

    // TARGET
    { entity: 'TARGET', targetField: 'sku', fieldType: 'STRING', required: true, isKey: true },
    { entity: 'TARGET', targetField: 'period', fieldType: 'STRING', required: true, isKey: true },
    { entity: 'TARGET', targetField: 'targetQty', fieldType: 'INT', required: true, isKey: false },
    { entity: 'TARGET', targetField: 'actualQty', fieldType: 'INT', required: false, isKey: false },
  ];

  for (const loc of locations) {
    for (const m of initialMappings) {
      await prisma.sheetMapping.upsert({
        where: {
          locationId_entity_targetField: {
            locationId: loc.id,
            entity: m.entity,
            targetField: m.targetField,
          },
        },
        update: {},
        create: {
          locationId: loc.id,
          tab: 'TODO_CONFIRM',
          entity: m.entity,
          sourceHeader: 'TODO_CONFIRM',
          targetField: m.targetField,
          fieldType: m.fieldType,
          required: m.required,
          isKey: m.isKey,
        },
      });
    }
  }

  console.info('Sheet mapping awal dengan placeholder TODO_CONFIRM berhasil dibuat.');
  console.info('Seeding selesai dengan sukses.');
}

main()
  .catch((e) => {
    console.error('Terjadi kesalahan saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
