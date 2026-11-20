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

  // 2. Peran: ADMIN, OWNER, FINANCE, SALES_OFFICE, SALES_FIELD, WAREHOUSE, STAFF
  const roles: Record<RoleName, { id: string; name: string }> = {} as never;

  const allRoleNames: RoleName[] = [
    'ADMIN',
    'OWNER',
    'FINANCE',
    'SALES_OFFICE',
    'SALES_FIELD',
    'WAREHOUSE',
    'STAFF',
  ];

  for (const roleName of allRoleNames) {
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
  console.info(`Peran terdaftar: ${allRoleNames.join(', ')}`);

  // 3. Akun Demo Awal
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
  });

  const demoUsersConfig = [
    {
      email: adminEmail.toLowerCase().trim(),
      name: 'Administrator Utama',
      role: roles.ADMIN,
      mustChangePassword: false,
    },
    {
      email: 'owner@tridhata.com',
      name: 'Ir. Hendra Wijaya',
      role: roles.OWNER,
      mustChangePassword: false,
    },
    {
      email: 'budi@tridhata.com',
      name: 'Budi Santoso (Finance)',
      role: roles.FINANCE,
      mustChangePassword: false,
    },
    {
      email: 'finance@tridhata.com',
      name: 'Finance & Kasir Operasional',
      role: roles.FINANCE,
      mustChangePassword: false,
    },
    {
      email: 'sales@tridhata.com',
      name: 'Rian Pratama (Sales Office)',
      role: roles.SALES_OFFICE,
      mustChangePassword: false,
    },
    {
      email: 'agronomis@tridhata.com',
      name: 'Agus Santoso, S.P. (Agronomis Lapangan)',
      role: roles.SALES_FIELD,
      mustChangePassword: false,
    },
    {
      email: 'gudang@tridhata.com',
      name: 'Joko Widodo (Staf Gudang & Logistik PIC)',
      role: roles.WAREHOUSE,
      mustChangePassword: false,
    },
    {
      email: 'siska@tridhata.com',
      name: 'Siska Tina (Staf Operasional)',
      role: roles.STAFF,
      mustChangePassword: false,
    },
  ];

  const seededUsers: Record<string, { id: string; email: string }> = {};

  for (const u of demoUsersConfig) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        roleId: u.role.id,
        defaultLocationId: bogor.id,
        active: true,
        mustChangePassword: false,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: u.role.id,
        defaultLocationId: bogor.id,
        active: true,
        mustChangePassword: false,
        extraPermissions: [],
      },
    });

    seededUsers[u.email] = user;

    // Hubungkan user ke kedua lokasi (Bogor dan Nganjuk)
    for (const loc of locations) {
      await prisma.locationAccess.upsert({
        where: {
          userId_locationId: {
            userId: user.id,
            locationId: loc.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          locationId: loc.id,
        },
      });
    }
  }
  console.info(`Akun demo terdaftar (${demoUsersConfig.length} akun): ${demoUsersConfig.map((u) => u.email).join(', ')}`);

  // 3b. Sample Demo Requests (Pengajuan Dana, Kasbon, dan Diskon)
  const budiUser = seededUsers['budi@tridhata.com'];
  const salesUser = seededUsers['sales@tridhata.com'];
  const ownerUser = seededUsers['owner@tridhata.com'];

  if (budiUser && ownerUser && salesUser) {
    // 1. Pengajuan Kasbon Operasional dari Finance ke Owner (PENDING)
    const existingReq1 = await prisma.request.findFirst({
      where: { title: 'Kasbon Pembelian Pupuk Tambahan & Biaya Kirim Nganjuk' },
    });
    if (!existingReq1) {
      await prisma.request.create({
        data: {
          requesterId: budiUser.id,
          locationId: bogor.id,
          type: 'Pengajuan Kasbon & Operasional (ke Owner)',
          title: 'Kasbon Pembelian Pupuk Tambahan & Biaya Kirim Nganjuk',
          note: 'Kebutuhan mendesak pengadaan pupuk mikro dan biaya sewa armada pickup ke depo Nganjuk.',
          amount: 15500000,
          status: 'PENDING',
        },
      });
    }

    // 2. Pembelian Bahan Baku PO dari Finance ke Owner (PENDING)
    const existingReq2 = await prisma.request.findFirst({
      where: { title: 'PO Bahan Baku Karung Laminasi & Polybag 5.000 Pcs' },
    });
    if (!existingReq2) {
      await prisma.request.create({
        data: {
          requesterId: budiUser.id,
          locationId: bogor.id,
          type: 'Pembelian Bahan Baku / PO (ke Owner)',
          title: 'PO Bahan Baku Karung Laminasi & Polybag 5.000 Pcs',
          note: 'Vendor meminta DP 50% untuk produksi karung cetak Tridhata musim tanam Q1.',
          amount: 48000000,
          status: 'PENDING',
        },
      });
    }

    // 3. Diskon Khusus Penjualan dari Sales Office (PENDING - bisa di-ACC Finance / Owner)
    const existingReq3 = await prisma.request.findFirst({
      where: { title: 'Diskon Khusus 4% Kios Tani Jaya (Order > 200 Karung)' },
    });
    if (!existingReq3) {
      await prisma.request.create({
        data: {
          requesterId: salesUser.id,
          locationId: bogor.id,
          type: 'Diskon Khusus Penjualan',
          title: 'Diskon Khusus 4% Kios Tani Jaya (Order > 200 Karung)',
          note: 'Pelanggan loyal minta diskon volume tambahan untuk pembayaran tempo 14 hari.',
          amount: 1850000,
          status: 'PENDING',
        },
      });
    }
  }

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
