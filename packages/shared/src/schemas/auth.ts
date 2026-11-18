import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Format email tidak valid' }),
  password: z
    .string()
    .min(1, { message: 'Kata sandi wajib diisi' }),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: 'Kata sandi saat ini wajib diisi' }),
    newPassword: z
      .string()
      .min(10, { message: 'Kata sandi baru minimal 10 karakter' })
      .regex(/[A-Za-z]/, { message: 'Kata sandi baru harus mengandung huruf' })
      .regex(/[0-9]/, { message: 'Kata sandi baru harus mengandung angka' }),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Kata sandi baru harus berbeda dari kata sandi saat ini',
    path: ['newPassword'],
  });

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
