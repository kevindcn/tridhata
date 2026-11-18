import { describe, it, expect } from 'vitest';
import { formatInt, formatRupiah, formatRupiahCompact, formatPct } from './format';

describe('format utilities', () => {
  it('formats integer with Indonesian thousands separator', () => {
    expect(formatInt(1250)).toBe('1.250');
    expect(formatInt(1000000)).toBe('1.000.000');
  });

  it('formats currency in Rupiah', () => {
    expect(formatRupiah(50000)).toContain('Rp');
    expect(formatRupiah(50000)).toContain('50.000');
  });

  it('formats compact Rupiah (1.800.000 -> Rp 1,8 jt)', () => {
    const compact = formatRupiahCompact(1800000);
    expect(compact).toContain('Rp');
    expect(compact).toContain('1,8');
    expect(compact).toContain('jt');
  });

  it('formats percentage correctly and handles null', () => {
    expect(formatPct(null)).toBe('–');
    expect(formatPct(85.4)).toBe('85%');
    expect(formatPct(85.6)).toBe('86%');
    expect(formatPct(0)).toBe('0%');
  });
});
