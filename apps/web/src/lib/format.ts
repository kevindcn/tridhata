const nf = new Intl.NumberFormat('id-ID');

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const rupiahCompact = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

// Normalisasi non-breaking space (\u00a0 dan \u202f) agar konsisten di berbagai browser/runtime
const normalizeSpaces = (str: string) => str.replace(/[\u00a0\u202f]/g, ' ');

export const formatInt = (n: number): string => nf.format(n);

export const formatRupiah = (n: number): string => normalizeSpaces(rupiah.format(n));

export const formatRupiahCompact = (n: number): string => normalizeSpaces(rupiahCompact.format(n));

export const formatPct = (n: number | null): string => (n === null ? '–' : `${Math.round(n)}%`);
