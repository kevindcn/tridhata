import { z } from 'zod';

export const googleExchangeSchema = z.object({
  ticket: z.string().min(1, { message: 'Tiket autentikasi wajib diisi' }),
});

export type GoogleExchangeDto = z.infer<typeof googleExchangeSchema>;

export type GoogleAuthErrorCode =
  | 'UNREGISTERED_ACCOUNT'
  | 'ACCOUNT_INACTIVE'
  | 'STATE_MISMATCH'
  | 'GOOGLE_AUTH_CANCELLED'
  | 'EMAIL_NOT_VERIFIED'
  | 'AUTH_FAILED';
