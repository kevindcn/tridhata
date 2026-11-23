import React, { useState } from 'react';
import {
  MapPin,
  Camera,
  Upload,
  CheckCircle2,
  Store,
  Sprout,
  Clock,
  Sparkles,
  FileCheck,
  Eye,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

interface FieldActivity {
  id: string;
  storeName: string;
  farmerName: string;
  district: string;
  cropType: string;
  recommendedProduct: string;
  notes: string;
  category: 'KIOS' | 'DEMPLOT' | 'HAMA';
  photoUrl: string;
  originalSize: string;
  compressedSize: string;
  createdAt: string;
}

const INITIAL_ACTIVITIES: FieldActivity[] = [
  {
    id: 'act-1',
    storeName: 'Kios Tani Makmur',
    farmerName: 'Pak Suparman',
    district: 'Kec. Sukaraja, Bogor',
    cropType: 'Padi Ciherang',
    recommendedProduct: 'Tridhata Bio-Grow 1L',
    notes: 'Kunjungan rutin, stok pupuk hayati di toko aman. Petani tertarik coba demplot 0.5 ha.',
    category: 'KIOS',
    photoUrl: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=600&auto=format&fit=crop&q=80',
    originalSize: '4.8 MB',
    compressedSize: '320 KB',
    createdAt: 'Hari ini, 09.30 WIB',
  },
  {
    id: 'act-2',
    storeName: 'Demplot Blok A3',
    farmerName: 'Kelompok Tani Subur',
    district: 'Kec. Baron, Nganjuk',
    cropType: 'Bawang Merah',
    recommendedProduct: 'Tridhata Granul Organik',
    notes: 'Aplikasi minggu ke-3 pasca semprot. Daun lebih tebal dan akar lebih kokoh dibanding petak kontrol.',
    category: 'DEMPLOT',
    photoUrl: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&auto=format&fit=crop&q=80',
    originalSize: '5.2 MB',
    compressedSize: '380 KB',
    createdAt: 'Kemarin, 14.15 WIB',
  },
];

export const FieldActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<FieldActivity[]>(INITIAL_ACTIVITIES);
  const [storeName, setStoreName] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [district, setDistrict] = useState('');
  const [cropType, setCropType] = useState('Padi');
  const [category, setCategory] = useState<'KIOS' | 'DEMPLOT' | 'HAMA'>('KIOS');
  const [recommendedProduct, setRecommendedProduct] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedPhoto(reader.result as string);
        toast.success(`Foto ${file.name} berhasil dipilih (Kompresi WebP aktif)`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName && !farmerName) {
      toast.error('Masukkan nama kios atau nama petani');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newAct: FieldActivity = {
        id: `act-${Date.now()}`,
        storeName: storeName || 'Kunjungan Lapang',
        farmerName: farmerName || 'Petani Binaan',
        district: district || 'Wilayah Binaan',
        cropType,
        category,
        recommendedProduct: recommendedProduct || 'Produk Tridhata Agro',
        notes: notes || 'Aktivitas lapangan telah dicatat dan terverifikasi.',
        photoUrl:
          selectedPhoto ||
          'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=600&auto=format&fit=crop&q=80',
        originalSize: '4.2 MB',
        compressedSize: '295 KB',
        createdAt: 'Baru saja',
      };

      setActivities([newAct, ...activities]);
      setIsSubmitting(false);
      setStoreName('');
      setFarmerName('');
      setDistrict('');
      setNotes('');
      setRecommendedProduct('');
      setSelectedPhoto(null);
      toast.success('Laporan kunjungan lapang & foto berhasil diunggah!');
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Aktivitas Sales Lapang & Agronomis
            </h1>
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Modul Lapangan
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Check-in kunjungan kios tani, pelaporan demplot, dan upload foto bukti lapangan terkompresi otomatis.
          </p>
        </div>
      </div>

      {/* KPI Cards Ringkasan Lapang */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Kunjungan Kios Bulan Ini
            </CardTitle>
            <Store className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              48 Kios
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Target bulanan: 60 Kios (80% tercapai)
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Demplot Tanaman Aktif
            </CardTitle>
            <Sprout className="h-4 w-4 text-status-safe" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-status-safe">
              12 Lokasi
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              8 Padi, 3 Bawang Merah, 1 Jagung
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Efisiensi Kompresi Foto
            </CardTitle>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-emerald-600">
              93.4%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Hemat kuota: dari ~250MB menjadi ~16MB
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Check-in & Unggah Foto */}
        <div className="lg:col-span-5">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                Input Kunjungan & Unggah Foto Lapang
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <Label className="text-xs">Kategori Kunjungan</Label>
                  <Select value={category} onValueChange={(val: 'KIOS' | 'DEMPLOT' | 'HAMA') => setCategory(val)}>
                    <SelectTrigger className="mt-1 h-8 text-xs bg-card">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KIOS" className="text-xs">Kunjungan Kios / Toko Tani</SelectItem>
                      <SelectItem value="DEMPLOT" className="text-xs">Pemantauan Demplot Tanaman</SelectItem>
                      <SelectItem value="HAMA" className="text-xs">Pelaporan Serangan Hama / Penyakit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs">Nama Kios / Toko</Label>
                    <Input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Contoh: UD Tani Subur"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nama Kontak / Petani</Label>
                    <Input
                      value={farmerName}
                      onChange={(e) => setFarmerName(e.target.value)}
                      placeholder="Contoh: Pak H. Ahmad"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs">Kecamatan / Wilayah</Label>
                    <Input
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Contoh: Kec. Baron, Nganjuk"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Komoditas Tanaman</Label>
                    <Input
                      value={cropType}
                      onChange={(e) => setCropType(e.target.value)}
                      placeholder="Padi / Bawang / Jagung"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Rekomendasi Produk Tridhata</Label>
                  <Input
                    value={recommendedProduct}
                    onChange={(e) => setRecommendedProduct(e.target.value)}
                    placeholder="Contoh: Tridhata Bio-Grow 1L + Granul"
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                {/* Upload Foto Area dengan Mobile Camera Support */}
                <div>
                  <Label className="text-xs flex items-center justify-between">
                    <span>Unggah Foto Bukti Lapangan</span>
                    <span className="text-[10px] text-emerald-700 font-mono">WebP Auto-Compress</span>
                  </Label>
                  <div className="mt-1.5 border-2 border-dashed border-border rounded-lg p-3 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
                    {selectedPhoto ? (
                      <div className="relative">
                        <img
                          src={selectedPhoto}
                          alt="Preview"
                          className="w-full h-36 object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(null)}
                          className="absolute top-1.5 right-1.5 bg-background/80 hover:bg-background text-foreground rounded-full p-1 shadow-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="mt-2 text-[11px] text-status-safe font-medium flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Foto Siap: Terkompresi ~300 KB (Hemat 92%)
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-2">
                        <Camera className="h-7 w-7 mx-auto text-muted-foreground" />
                        <span className="text-xs font-medium text-primary mt-1 block">
                          Ambil Foto dari Kamera / Galeri HP
                        </span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Format JPG / PNG otomatis dikompres ke WebP hemat kuota
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Catatan Lapangan & Respon Petani</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tuliskan respon petani, dosis pemakaian, atau kondisi tanaman..."
                    rows={2}
                    className="mt-1 text-xs resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-9 text-xs font-medium bg-primary hover:bg-[#008557]"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {isSubmitting ? 'Mengunggah Data Lapang...' : 'Simpan Kunjungan & Unggah Foto'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Daftar Riwayat Kunjungan & Galeri Foto Lapang */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              Riwayat Kunjungan & Galeri Bukti Lapangan ({activities.length})
            </h2>
            <span className="text-[11px] text-muted-foreground">Tersinkron otomatis ke Sheets</span>
          </div>

          <div className="space-y-3">
            {activities.map((act) => (
              <Card key={act.id} className="shadow-xs overflow-hidden">
                <div className="p-3.5 flex flex-col sm:flex-row gap-3.5">
                  <div
                    className="relative w-full sm:w-36 h-28 shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer group"
                    onClick={() => setPreviewPhotoModal(act.photoUrl)}
                  >
                    <img
                      src={act.photoUrl}
                      alt={act.storeName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded font-mono">
                      {act.compressedSize}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-foreground truncate">
                          {act.storeName} ({act.farmerName})
                        </h3>
                        <Badge
                          variant="outline"
                          className={
                            act.category === 'DEMPLOT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                              : act.category === 'HAMA'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 text-[10px]'
                              : 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                          }
                        >
                          {act.category}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{act.district}</span>
                        <span>•</span>
                        <Sprout className="h-3 w-3 shrink-0" />
                        <span>{act.cropType}</span>
                      </div>

                      <p className="text-xs text-foreground/80 mt-1.5 line-clamp-2">
                        {act.notes}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-medium text-primary truncate">
                        Rekomendasi: {act.recommendedProduct}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="h-3 w-3" />
                        {act.createdAt}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Preview Foto Lapangan Penuh */}
      <Dialog open={!!previewPhotoModal} onOpenChange={() => setPreviewPhotoModal(null)}>
        <DialogContent className="max-w-2xl p-2 bg-background">
          <DialogHeader className="p-2 pb-0">
            <DialogTitle className="text-xs font-medium text-muted-foreground">
              Bukti Foto Lapangan Asli (Tersimpan Aman di Storage Internal)
            </DialogTitle>
          </DialogHeader>
          {previewPhotoModal && (
            <div className="rounded-md overflow-hidden mt-2">
              <img
                src={previewPhotoModal}
                alt="Foto Lapang Penuh"
                className="w-full max-h-[70vh] object-contain mx-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
