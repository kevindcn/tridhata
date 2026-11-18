import { formatRupiahCompact } from './lib/format';

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
            TO
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-foreground">Tridhata Ops</h1>
            <p className="text-xs text-muted-foreground">Fasilitas Bogor & Nganjuk</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Fase 0: Fondasi Proyek
          </span>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard Operasional PPIC
          </h2>
          <p className="text-sm text-muted-foreground">
            Sistem manajemen operasional produksi, perencanaan, persediaan, dan persetujuan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-[var(--radius)] border border-border p-5 space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Status Fondasi</span>
            <div className="text-2xl font-semibold tabular text-foreground">Siap</div>
            <p className="text-xs text-muted-foreground">
              Monorepo, Fastify NestJS, Prisma Postgres, React 19 Vite.
            </p>
          </div>

          <div className="bg-card rounded-[var(--radius)] border border-border p-5 space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Uji Pemformat Mata Uang</span>
            <div className="text-2xl font-semibold tabular text-foreground">
              {formatRupiahCompact(71200000)}
            </div>
            <p className="text-xs text-muted-foreground">
              Format ringkas standar Indonesia (id-ID).
            </p>
          </div>

          <div className="bg-card rounded-[var(--radius)] border border-border p-5 space-y-2 border-l-4 border-l-[var(--status-safe)]">
            <span className="text-xs font-medium text-muted-foreground">Standar Antarmuka</span>
            <div className="text-2xl font-semibold text-[var(--status-safe)]">Anti-Slop</div>
            <p className="text-xs text-muted-foreground">
              Font Inter lokal, tanpa gradien, tanpa emoji, kontras tinggi.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card px-6 py-3 text-center text-xs text-muted-foreground">
        Tridhata Ops V2 &bull; Dokumen Spesifikasi Opsi 1 (Fondasi)
      </footer>
    </div>
  );
}
