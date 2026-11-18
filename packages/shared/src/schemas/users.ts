import { z } from 'zod';
import { PERMISSIONS } from '../permissions';

export const roleNameSchema = z.enum(['ADMIN', 'FINANCE', 'STAFF']);

export const permissionEnumSchema = z.enum(PERMISSIONS);

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Nama minimal 2 karakter' })
    .max(100, { message: 'Nama maksimal 100 karakter' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Format email tidak valid' }),
  role: roleNameSchema,
  division: z
    .string()
    .trim()
    .max(50, { message: 'Divisi maksimal 50 karakter' })
    .optional(),
  locationIds: z
    .array(z.string().uuid({ message: 'ID lokasi harus berformat UUID' }))
    .min(1, { message: 'Minimal pilih satu lokasi akses' }),
  defaultLocationId: z
    .string()
    .uuid({ message: 'Default lokasi harus berformat UUID' })
    .optional()
    .nullable(),
  extraPermissions: z
    .array(permissionEnumSchema)
    .default([]),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .partial()
  .extend({
    active: z.boolean().optional(),
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
