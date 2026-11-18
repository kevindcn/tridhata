import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatRupiahCompact } from '@/lib/format';
import { Layers, Activity, Server, CheckCircle2 } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[var(--radius-md)] bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
            TO
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-foreground">Tridhata Ops</h1>
            <p className="text-xs text-muted-foreground">Fasilitas Bogor & Nganjuk</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Fase 0: Fondasi Proyek
          </span>
          <Button variant="outline" size="sm">
            Dokumentasi
          </Button>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status Fondasi
              </CardTitle>
              <CheckCircle2 className="size-4 text-[var(--status-safe)]" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-semibold tabular text-foreground">Siap & Terverifikasi</div>
              <p className="text-xs text-muted-foreground">
                Monorepo pnpm, Fastify NestJS, Prisma Postgres, React 19 Vite.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Uji Pemformat Angka
              </CardTitle>
              <Activity className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-semibold tabular text-foreground">
                {formatRupiahCompact(71200000)}
              </div>
              <p className="text-xs text-muted-foreground">
                Format ringkas standar Indonesia (id-ID) untuk kartu ringkasan.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[var(--status-safe)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Standar Antarmuka
              </CardTitle>
              <Layers className="size-4 text-[var(--status-safe)]" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-semibold text-[var(--status-safe)]">Anti-Slop</div>
              <p className="text-xs text-muted-foreground">
                Font Inter lokal, tanpa gradien dekoratif, radius 10px / 8px.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Spesifikasi Token Status Stok</CardTitle>
                <CardDescription>
                  Warna status hanya untuk informasi fungsional, wajib disertai label teks.
                </CardDescription>
              </div>
              <Server className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="safe">Aman</Badge>
              <Badge variant="minimum">Minimal</Badge>
              <Badge variant="critical">Kritis</Badge>
              <Badge variant="empty">Habis</Badge>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Semua token warna berasal dari variabel CSS di index.css tanpa kelas warna Tailwind mentah.
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border bg-card px-6 py-3 text-center text-xs text-muted-foreground">
        Tridhata Ops V2 &bull; Dokumen Spesifikasi Opsi 1 (Fondasi)
      </footer>
    </div>
  );
}
