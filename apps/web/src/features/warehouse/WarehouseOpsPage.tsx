import React, { useState } from 'react';
import {
  Boxes,
  Truck,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Image as ImageIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface StockReceipt {
  id: string;
  docNumber: string;
  vendorName: string;
  productName: string;
  qty: number;
  unit: string;
  condition: 'BAIK' | 'RUSAK_SEBAGIAN' | 'SEGEL_RUSAK';
  photoUrl: string;
  createdAt: string;
  receivedBy: string;
}

const INITIAL_RECEIPTS: StockReceipt[] = [
  {
    id: 'rcp-1',
    docNumber: 'SJ-SUP-2026-088',
    vendorName: 'PT Kemasan Citra Mandiri',
    productName: 'Paper Bag SOS Kraft Cokelat 28x15x28',
    qty: 15000,
    unit: 'Pcs',
    condition: 'BAIK',
    photoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
    createdAt: 'Hari ini, 10.15 WIB',
    receivedBy: 'Siska Tina (Gudang)',
  },
  {
    id: 'rcp-2',
    docNumber: 'SJ-SUP-2026-092',
    vendorName: 'PT Bio Tani Makmur',
    productName: 'Bahan Baku Hayati Organik',
    qty: 2400,
    unit: 'Kg',
    condition: 'RUSAK_SEBAGIAN',
    photoUrl: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80',
    createdAt: 'Kemarin, 15.40 WIB',
    receivedBy: 'Budi (PIC Bongkar)',
  },
];

export const WarehouseOpsPage: React.FC = () => {
  const [receipts, setReceipts] = useState<StockReceipt[]>(INITIAL_RECEIPTS);
  const [docNumber, setDocNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [productName, setProductName] = useState('Paper Bag SOS Kraft Cokelat 28x15x28 80gsm');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [condition, setCondition] = useState<'BAIK' | 'RUSAK_SEBAGIAN' | 'SEGEL_RUSAK'>('BAIK');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedPhoto(reader.result as string);
        toast.success(`Foto fisik Surat Jalan vendor berhasil diunggah.`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber || !vendorName || !qty) {
      toast.error('Lengkapi nomor surat jalan, nama vendor, dan kuantitas');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newReceipt: StockReceipt = {
        id: `rcp-${Date.now()}`,
        docNumber,
        vendorName,
        productName,
        qty: parseInt(qty) || 0,
        unit,
        condition,
        photoUrl:
          selectedPhoto ||
          'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
        createdAt: 'Baru saja',
        receivedBy: 'PIC Gudang Aktif',
      };

      setReceipts([newReceipt, ...receipts]);
      setIsSubmitting(false);
      setDocNumber('');
      setVendorName('');
      setQty('');
      setSelectedPhoto(null);
      toast.success('Penerimaan barang dan bukti fisik berhasil disimpan ke sistem & disinkronkan ke Sheets!');
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Operasional Gudang & Logistik
            </h1>
            <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-800 border-cyan-200">
              Gudang & Bongkar Muat
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pencatatan barang datang (GRN), upload foto fisik surat jalan suplier, dan cetak Surat Jalan resmi pengiriman.
          </p>
        </div>

        <Button
          onClick={() => setIsPrintModalOpen(true)}
          className="h-8 text-xs bg-primary hover:bg-[#008557] font-medium"
        >
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Cetak Surat Jalan Pengiriman (PDF)
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Barang Masuk (GRN) Hari Ini
            </CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-status-safe" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              3 Truk
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              17.400 unit produk & bahan baku tercatat
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Siap Kirim ke Pelanggan
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-primary">
              6 Pengiriman
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Surat jalan otomatis terbit dengan barcode
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Laporan Kerusakan / Rusak
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-amber-600">
              1 Temuan
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Foto bukti kemasan rusak telah di-upload ke QC
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Penerimaan Barang & Upload Foto Fisik */}
        <div className="lg:col-span-5">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Catat Barang Masuk & Foto Surat Jalan Vendor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCreateReceipt} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs">No. Surat Jalan Vendor</Label>
                    <Input
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="SJ-XXXX-XXX"
                      className="mt-1 h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nama Suplier / Vendor</Label>
                    <Input
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="PT Nama Vendor"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Produk / Bahan Baku Diterima</Label>
                  <Select value={productName} onValueChange={setProductName}>
                    <SelectTrigger className="mt-1 h-8 text-xs bg-card">
                      <SelectValue placeholder="Pilih Produk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paper Bag SOS Kraft Cokelat 28x15x28 80gsm" className="text-xs">
                        Paper Bag SOS Kraft Cokelat 28x15x28 80gsm
                      </SelectItem>
                      <SelectItem value="Paper Bowl 650ml Kraft Food Grade" className="text-xs">
                        Paper Bowl 650ml Kraft Food Grade
                      </SelectItem>
                      <SelectItem value="Kardus Box Corrugated 30x20x15" className="text-xs">
                        Kardus Box Corrugated 30x20x15
                      </SelectItem>
                      <SelectItem value="Bahan Baku Hayati Organik" className="text-xs">
                        Bahan Baku Hayati Organik
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs">Kuantitas Diterima</Label>
                    <Input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="Jumlah fisik dihitung"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Satuan Barang</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="mt-1 h-8 text-xs bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pcs" className="text-xs">Pcs / Lembar</SelectItem>
                        <SelectItem value="Kg" className="text-xs">Kilogram (Kg)</SelectItem>
                        <SelectItem value="Liter" className="text-xs">Liter</SelectItem>
                        <SelectItem value="Sak" className="text-xs">Sak / Zak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Kondisi Fisik Saat Bongkar Truk</Label>
                  <Select value={condition} onValueChange={(v: 'BAIK' | 'RUSAK_SEBAGIAN' | 'SEGEL_RUSAK') => setCondition(v)}>
                    <SelectTrigger className="mt-1 h-8 text-xs bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAIK" className="text-xs">Kondisi Baik & Segel Utuh</SelectItem>
                      <SelectItem value="RUSAK_SEBAGIAN" className="text-xs">Kemasan Robek / Rusak Sebagian</SelectItem>
                      <SelectItem value="SEGEL_RUSAK" className="text-xs">Segel Terbuka / Tidak Sesuai PO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload Foto Fisik Surat Jalan Vendor */}
                <div>
                  <Label className="text-xs flex items-center justify-between">
                    <span>Foto Fisik Surat Jalan & Kondisi Barang</span>
                    <span className="text-[10px] text-primary font-medium">Bukti Otentik</span>
                  </Label>
                  <div className="mt-1.5 border-2 border-dashed border-border rounded-lg p-3 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
                    {selectedPhoto ? (
                      <div className="relative">
                        <img
                          src={selectedPhoto}
                          alt="Surat Jalan"
                          className="w-full h-32 object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(null)}
                          className="absolute top-1.5 right-1.5 bg-background/80 hover:bg-background text-foreground rounded-full p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="mt-2 text-[11px] text-status-safe font-medium flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Foto Surat Jalan Siap Disimpan
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-2">
                        <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground" />
                        <span className="text-xs font-medium text-primary mt-1 block">
                          Foto Lembar Surat Jalan TTD Sopir
                        </span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Format JPG / PNG langsung dari kamera HP
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

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-9 text-xs font-medium bg-primary hover:bg-[#008557]"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {isSubmitting ? 'Menyimpan Penerimaan...' : 'Simpan Barang Masuk & Foto'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Tabel Riwayat Penerimaan Barang Gudang */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              Log Penerimaan Barang & Bukti Fisik ({receipts.length} Penerimaan)
            </h2>
            <span className="text-[11px] text-muted-foreground font-mono">Pabrik BOGOR</span>
          </div>

          <Card className="shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold">Bukti Foto</TableHead>
                    <TableHead className="text-xs font-semibold">No. Dokumen & Vendor</TableHead>
                    <TableHead className="text-xs font-semibold">Nama Produk</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Kuantitas</TableHead>
                    <TableHead className="text-xs font-semibold">Kondisi Fisik</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((rcp) => (
                    <TableRow key={rcp.id} className="hover:bg-muted/30">
                      <TableCell className="w-16">
                        <div
                          className="w-12 h-10 rounded overflow-hidden bg-muted cursor-pointer group relative"
                          onClick={() => setPreviewPhotoModal(rcp.photoUrl)}
                        >
                          <img
                            src={rcp.photoUrl}
                            alt="Bukti"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                            <Eye className="h-3.5 w-3.5 text-white" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {rcp.docNumber}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {rcp.vendorName}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium max-w-[180px] truncate">
                        {rcp.productName}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold tabular-nums">
                        {rcp.qty.toLocaleString('id-ID')} {rcp.unit}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            rcp.condition === 'BAIK'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                              : 'bg-rose-50 text-rose-700 border-rose-200 text-[10px]'
                          }
                        >
                          {rcp.condition === 'BAIK' ? 'Baik' : 'Ada Cacat'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal Preview Dokumen Surat Jalan (Print-Ready) */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="max-w-2xl p-6 bg-white text-slate-900">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Preview Surat Jalan Pengiriman (Dokumen PDF Siap Cetak)</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                3 RANGKAP
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-4 text-xs font-sans border-2 border-slate-200 p-4 rounded-md bg-slate-50/50">
            {/* Header Surat Jalan */}
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-emerald-800 tracking-tight">TRIDHATA AGRO</h3>
                <p className="text-[11px] text-slate-600">Pabrik Bogor: Jl. Raya Sukaraja No. 88, Bogor</p>
                <p className="text-[11px] text-slate-600">Telepon: (0251) 833-XXXX • Email: ops@tridhata.com</p>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-sm text-slate-800">SURAT JALAN</div>
                <div className="font-mono text-xs text-slate-600">No: SJ-OUT-2026-1142</div>
                <div className="text-[11px] text-slate-500">Tanggal: 20 November 2026</div>
              </div>
            </div>

            {/* Penerima */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-2 border rounded bg-white">
                <span className="font-semibold text-slate-700 block mb-0.5">Kepada Yth:</span>
                <p className="font-bold">Distributor Tani Makmur Sejahtera</p>
                <p className="text-slate-600">Jl. Pahlawan No. 45, Kab. Nganjuk</p>
                <p className="text-slate-600">No. Kontak: 0812-3456-XXXX</p>
              </div>
              <div className="p-2 border rounded bg-white">
                <span className="font-semibold text-slate-700 block mb-0.5">Informasi Kendaraan:</span>
                <p><span className="text-slate-500">No. Polisi:</span> B 9281 TDA (Truk Colt Diesel)</p>
                <p><span className="text-slate-500">Nama Pengemudi:</span> Pak Suwandi</p>
                <p><span className="text-slate-500">Ekspedisi:</span> Armada Internal Pabrik</p>
              </div>
            </div>

            {/* Tabel Muatan */}
            <table className="w-full border-collapse border border-slate-300 bg-white">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border p-1.5 font-bold">No</th>
                  <th className="border p-1.5 font-bold">Kode SKU</th>
                  <th className="border p-1.5 font-bold">Deskripsi Produk</th>
                  <th className="border p-1.5 text-right font-bold">Kuantitas</th>
                  <th className="border p-1.5 font-bold">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-1.5">1</td>
                  <td className="border p-1.5 font-mono">TRD-BIO-001</td>
                  <td className="border p-1.5 font-medium">Tridhata Bio-Grow 1 Liter Kemasan Botol</td>
                  <td className="border p-1.5 text-right font-bold">2.400 Botol</td>
                  <td className="border p-1.5 text-slate-600">Batch B-2611-04</td>
                </tr>
                <tr>
                  <td className="border p-1.5">2</td>
                  <td className="border p-1.5 font-mono">TRD-GRN-050</td>
                  <td className="border p-1.5 font-medium">Tridhata Granul Organik Karung 50 Kg</td>
                  <td className="border p-1.5 text-right font-bold">300 Karung</td>
                  <td className="border p-1.5 text-slate-600">Batch G-2611-02</td>
                </tr>
              </tbody>
            </table>

            {/* Area TTD 3 Pihak */}
            <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t">
              <div>
                <p className="text-[11px] text-slate-500 mb-8">Penerima Barang,</p>
                <p className="font-semibold border-t mx-4 pt-0.5">( ............................... )</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 mb-8">Sopir / Pengemudi,</p>
                <p className="font-semibold border-t mx-4 pt-0.5">Pak Suwandi</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 mb-8">Hormat Kami (Gudang),</p>
                <p className="font-semibold border-t mx-4 pt-0.5">Kepala Gudang</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsPrintModalOpen(false)}>
              Tutup
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-[#008557]"
              onClick={() => {
                window.print();
              }}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Cetak Dokumen Sekarang
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Foto Dokumen Penuh */}
      <Dialog open={!!previewPhotoModal} onOpenChange={() => setPreviewPhotoModal(null)}>
        <DialogContent className="max-w-2xl p-2 bg-background">
          <DialogHeader className="p-2 pb-0">
            <DialogTitle className="text-xs font-medium text-muted-foreground">
              Bukti Fisik Surat Jalan / Kondisi Barang Masuk
            </DialogTitle>
          </DialogHeader>
          {previewPhotoModal && (
            <div className="rounded-md overflow-hidden mt-2">
              <img
                src={previewPhotoModal}
                alt="Foto Dokumen Fisik"
                className="w-full max-h-[70vh] object-contain mx-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
