import { normalizeHeader, serialToDate, parseCell } from './sheets-parser';

describe('sheets-parser', () => {
  describe('normalizeHeader', () => {
    it('normalizes whitespace and case', () => {
      expect(normalizeHeader('  Kode  Barang  ')).toBe('kode barang');
      expect(normalizeHeader('SKU')).toBe('sku');
      expect(normalizeHeader(null)).toBe('');
      expect(normalizeHeader(undefined)).toBe('');
    });
  });

  describe('serialToDate', () => {
    it('converts excel serial number to YYYY-MM-DD string', () => {
      // 45248 -> 2023-11-18
      const dateStr = serialToDate(45248);
      expect(dateStr).toBe('2023-11-18');
    });

    it('converts serial number 1 to 1899-12-31', () => {
      expect(serialToDate(1)).toBe('1899-12-31');
    });
  });

  describe('parseCell', () => {
    it('handles empty values for all types', () => {
      expect(parseCell('', 'STRING')).toEqual({ ok: false, reason: 'EMPTY' });
      expect(parseCell('   ', 'STRING')).toEqual({ ok: false, reason: 'EMPTY' });
      expect(parseCell(null, 'INT')).toEqual({ ok: false, reason: 'EMPTY' });
      expect(parseCell(undefined, 'DECIMAL')).toEqual({ ok: false, reason: 'EMPTY' });
      expect(parseCell('', 'DATE')).toEqual({ ok: false, reason: 'EMPTY' });
    });

    it('parses STRING correctly', () => {
      expect(parseCell('  SKU-001  ', 'STRING')).toEqual({ ok: true, value: 'SKU-001' });
    });

    it('parses INT correctly', () => {
      expect(parseCell(100, 'INT')).toEqual({ ok: true, value: 100 });
      expect(parseCell(100.6, 'INT')).toEqual({ ok: true, value: 101 });
      expect(parseCell('250', 'INT')).toEqual({ ok: true, value: 250 });
      expect(parseCell('abc', 'INT')).toEqual({ ok: false, reason: 'NOT_A_NUMBER' });
      expect(parseCell('1.250', 'INT')).toEqual({ ok: true, value: 1 }); // Number('1.250') is 1.25 -> 1
    });

    it('parses DECIMAL correctly', () => {
      expect(parseCell(125000.5, 'DECIMAL')).toEqual({ ok: true, value: 125000.5 });
      expect(parseCell('54000.75', 'DECIMAL')).toEqual({ ok: true, value: 54000.75 });
      expect(parseCell('not_num', 'DECIMAL')).toEqual({ ok: false, reason: 'NOT_A_NUMBER' });
    });

    it('parses DATE correctly', () => {
      expect(parseCell(45248, 'DATE')).toEqual({ ok: true, value: '2023-11-18' });
      expect(parseCell('2026-11-18', 'DATE')).toEqual({ ok: true, value: '2026-11-18' });
      expect(parseCell('18/11/2026', 'DATE')).toEqual({ ok: false, reason: 'BAD_DATE' });
      expect(parseCell('invalid-date', 'DATE')).toEqual({ ok: false, reason: 'BAD_DATE' });
    });
  });
});
