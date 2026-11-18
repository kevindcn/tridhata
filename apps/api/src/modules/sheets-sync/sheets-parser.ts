import { FieldType } from '@prisma/client';

export const normalizeHeader = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

// Sheets menyimpan tanggal sebagai nomor seri sejak 1899-12-30
export function serialToDate(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export type ParseCellResult =
  | { ok: true; value: string | number }
  | { ok: false; reason: 'EMPTY' | 'NOT_A_NUMBER' | 'BAD_DATE' };

export function parseCell(raw: unknown, type: FieldType): ParseCellResult {
  if (raw === '' || raw === null || raw === undefined) {
    return { ok: false, reason: 'EMPTY' };
  }

  switch (type) {
    case 'STRING': {
      const str = String(raw).trim();
      return str.length > 0
        ? { ok: true, value: str }
        : { ok: false, reason: 'EMPTY' };
    }

    case 'INT': {
      if (typeof raw === 'number') {
        return Number.isFinite(raw)
          ? { ok: true, value: Math.round(raw) }
          : { ok: false, reason: 'NOT_A_NUMBER' };
      }
      const str = String(raw).trim();
      if (str === '') return { ok: false, reason: 'EMPTY' };
      const n = Number(str);
      return !isNaN(n) && Number.isFinite(n)
        ? { ok: true, value: Math.round(n) }
        : { ok: false, reason: 'NOT_A_NUMBER' };
    }

    case 'DECIMAL': {
      if (typeof raw === 'number') {
        return Number.isFinite(raw)
          ? { ok: true, value: raw }
          : { ok: false, reason: 'NOT_A_NUMBER' };
      }
      const str = String(raw).trim();
      if (str === '') return { ok: false, reason: 'EMPTY' };
      const n = Number(str);
      return !isNaN(n) && Number.isFinite(n)
        ? { ok: true, value: n }
        : { ok: false, reason: 'NOT_A_NUMBER' };
    }

    case 'DATE': {
      if (typeof raw === 'number') {
        if (!Number.isFinite(raw) || raw < 1) {
          return { ok: false, reason: 'BAD_DATE' };
        }
        return { ok: true, value: serialToDate(raw) };
      }
      const str = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const d = new Date(`${str}T00:00:00Z`);
        if (!isNaN(d.getTime())) {
          return { ok: true, value: str };
        }
      }
      return { ok: false, reason: 'BAD_DATE' };
    }
  }
}
