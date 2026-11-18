import { z } from 'zod';

export const createRequestSchema = z.object({
  locationId: z
    .string()
    .uuid({ message: 'ID lokasi harus berformat UUID' }),
  type: z
    .string()
    .trim()
    .min(2, { message: 'Jenis pengajuan minimal 2 karakter' })
    .max(50, { message: 'Jenis pengajuan maksimal 50 karakter' }),
  title: z
    .string()
    .trim()
    .min(3, { message: 'Judul pengajuan minimal 3 karakter' })
    .max(120, { message: 'Judul pengajuan maksimal 120 karakter' }),
  note: z
    .string()
    .trim()
    .max(1000, { message: 'Catatan maksimal 1000 karakter' })
    .optional()
    .nullable(),
  amount: z
    .number()
    .nonnegative({ message: 'Nominal harus bernilai 0 atau positif' })
    .refine(
      (val) => {
        const decimals = val.toString().split('.')[1];
        return !decimals || decimals.length <= 2;
      },
      { message: 'Nominal maksimal 2 angka di belakang koma' },
    ),
});

export type CreateRequestDto = z.infer<typeof createRequestSchema>;

export const decideRequestSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED'], {
      errorMap: () => ({ message: 'Keputusan harus APPROVED atau REJECTED' }),
    }),
    note: z
      .string()
      .trim()
      .max(1000, { message: 'Catatan maksimal 1000 karakter' })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'REJECTED') {
      if (!data.note || data.note.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Alasan penolakan wajib diisi (minimal 5 karakter)',
          path: ['note'],
        });
      }
    }
  });

export type DecideRequestDto = z.infer<typeof decideRequestSchema>;
