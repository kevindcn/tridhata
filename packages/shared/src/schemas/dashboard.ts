import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function validateDateRange<T extends { from: string; to: string }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  const fromDate = new Date(data.from);
  const toDate = new Date(data.to);
  if (fromDate > toDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tanggal dari tidak boleh lebih besar dari tanggal sampai',
      path: ['to'],
    });
  }
  const fromTime = fromDate.getTime();
  const toTime = toDate.getTime();
  const diffDays = Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24));
  if (diffDays > 366) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Rentang tanggal maksimal 366 hari',
      path: ['to'],
    });
  }
}

export const dateRangeBaseSchema = z.object({
  from: z
    .string()
    .regex(dateRegex, { message: 'Format tanggal dari harus YYYY-MM-DD' }),
  to: z
    .string()
    .regex(dateRegex, { message: 'Format tanggal sampai harus YYYY-MM-DD' }),
});

export const dateRangeSchema = dateRangeBaseSchema.superRefine(validateDateRange);

export type DateRangeDto = z.infer<typeof dateRangeSchema>;

export const dashboardQuerySchema = dateRangeBaseSchema
  .extend({
    locationId: z.string().uuid({ message: 'ID lokasi harus berformat UUID' }),
  })
  .superRefine(validateDateRange);

export type DashboardQueryDto = z.infer<typeof dashboardQuerySchema>;

export const productionDashboardQuerySchema = z.object({
  locationId: z.string().uuid({ message: 'ID lokasi harus berformat UUID' }),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { message: 'Format periode harus YYYY-MM' })
    .optional(),
});

export type ProductionDashboardQueryDto = z.infer<typeof productionDashboardQuerySchema>;

export const inventoryDashboardQuerySchema = z.object({
  locationId: z.string().uuid({ message: 'ID lokasi harus berformat UUID' }),
  status: z.enum(['SAFE', 'MINIMUM', 'CRITICAL', 'EMPTY']).optional(),
});

export type InventoryDashboardQueryDto = z.infer<typeof inventoryDashboardQuerySchema>;
