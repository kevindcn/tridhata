import { z } from 'zod';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {
    try {
      process.loadEnvFile('../../.env');
    } catch {
      // Env variables already set via environment / container
    }
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  TZ: z.string().default('Asia/Jakarta'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().url(), // satu asal saja
  COOKIE_DOMAIN: z.string().optional(), // contoh: .klien.com
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

export function validateEnv(config: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.format();
    console.error('Konfigurasi environment tidak valid:', JSON.stringify(errors, null, 2));
    throw new Error('Konfigurasi environment tidak valid. Periksa berkas .env Anda.');
  }
  return result.data;
}
