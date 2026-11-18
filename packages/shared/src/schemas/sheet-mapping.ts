import { z } from 'zod';

export const sheetEntitySchema = z.enum([
  'PRODUCT',
  'STOCK',
  'SALE',
  'FORECAST',
  'TARGET',
]);

export type SheetEntity = z.infer<typeof sheetEntitySchema>;

export const fieldTypeSchema = z.enum([
  'STRING',
  'INT',
  'DECIMAL',
  'DATE',
]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

export const sheetMappingSchema = z.object({
  id: z.string().uuid().optional(),
  locationId: z.string().uuid({ message: 'ID lokasi harus berformat UUID' }),
  tab: z.string().trim().min(1, { message: 'Nama tab tidak boleh kosong' }),
  entity: sheetEntitySchema,
  sourceHeader: z.string().trim().min(1, { message: 'Nama header sumber tidak boleh kosong' }),
  targetField: z.string().trim().min(1, { message: 'Field tujuan tidak boleh kosong' }),
  fieldType: fieldTypeSchema,
  required: z.boolean().default(true),
  isKey: z.boolean().default(false),
});

export type SheetMappingDto = z.infer<typeof sheetMappingSchema>;

export const updateSheetMappingsSchema = z.object({
  mappings: z.array(sheetMappingSchema),
});

export type UpdateSheetMappingsDto = z.infer<typeof updateSheetMappingsSchema>;
