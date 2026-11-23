<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Surat Jalan - {{ $movement->code }}</title>
    <style>
        @page {
            margin: 24px 30px;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #222;
        }
        .header {
            border-bottom: 2px solid #2d6a4f;
            padding-bottom: 10px;
            margin-bottom: 14px;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            color: #1b4332;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
        }
        .company-sub {
            font-size: 9px;
            color: #555;
        }
        .doc-title {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            margin: 12px 0;
            color: #1b4332;
            letter-spacing: 1px;
        }
        .meta-table {
            width: 100%;
            margin-bottom: 14px;
            border-collapse: collapse;
        }
        .meta-table td {
            padding: 3px 6px;
            vertical-align: top;
            font-size: 10px;
        }
        .meta-label {
            font-weight: bold;
            color: #333;
            width: 18%;
        }
        .meta-sep {
            width: 2%;
        }
        .meta-val {
            width: 30%;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
        }
        .items-table th, .items-table td {
            border: 1px solid #ccc;
            padding: 6px 8px;
            text-align: left;
            font-size: 10px;
        }
        .items-table th {
            background-color: #e8f5e9;
            color: #1b4332;
            font-weight: bold;
            text-align: center;
        }
        .text-center {
            text-align: center;
        }
        .text-right {
            text-align: right;
        }
        .notes-box {
            background-color: #f8f9fa;
            border: 1px dashed #ccc;
            padding: 8px;
            font-size: 9px;
            margin-bottom: 25px;
        }
        .signatures {
            width: 100%;
            margin-top: 25px;
            border-collapse: collapse;
        }
        .signatures td {
            width: 33.33%;
            text-align: center;
            font-size: 10px;
            vertical-align: top;
        }
        .sign-space {
            height: 60px;
        }
        .sign-name {
            font-weight: bold;
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <table style="width: 100%;">
            <tr>
                <td style="width: 65%;">
                    <div class="company-name">PT TRIDHATA AGRO INOVASI</div>
                    <div class="company-sub">
                        Produsen & Distributor Pupuk Organik & Produk Agro Hayati<br>
                        <strong>Kantor & Gudang Bogor:</strong> Jl. Raya Bogor - Jakarta KM 48, Bogor, Jawa Barat<br>
                        <strong>Pabrik & Gudang Nganjuk:</strong> Kawasan Industri Nganjuk, Jawa Timur
                    </div>
                </td>
                <td style="width: 35%; text-align: right; vertical-align: middle;">
                    <div style="font-size: 13px; font-weight: bold; color: #1b4332;">SURAT JALAN</div>
                    <div style="font-size: 11px; font-weight: bold; color: #444;">{{ $movement->code }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="doc-title">SURAT JALAN & BUKTI PENGIRIMAN BARANG</div>

    <table class="meta-table">
        <tr>
            <td class="meta-label">Nomor Dokumen</td>
            <td class="meta-sep">:</td>
            <td class="meta-val"><strong>{{ $movement->code }}</strong></td>
            <td class="meta-label">Gudang Asal</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ $movement->location?->name ?? '-' }} ({{ $movement->location?->code ?? '-' }})</td>
        </tr>
        <tr>
            <td class="meta-label">Tanggal Kirim</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ \Carbon\Carbon::parse($movement->date)->translatedFormat('d F Y') }}</td>
            <td class="meta-label">Tujuan / Penerima</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">
                @if($movement->targetLocation)
                    {{ $movement->targetLocation->name }} ({{ $movement->targetLocation->code }})
                @else
                    {{ $movement->notes ? Str::limit($movement->notes, 40) : 'Pihak Luar / Pelanggan' }}
                @endif
            </td>
        </tr>
        <tr>
            <td class="meta-label">Jenis Pengiriman</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ $movement->type?->getLabel() ?? $movement->type }}</td>
            <td class="meta-label">Petugas / Operator</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ $movement->creator?->name ?? 'Admin Sistem' }}</td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;">No</th>
                <th style="width: 20%;">SKU / Kode</th>
                <th style="width: 45%;">Nama Barang / Komoditas</th>
                <th style="width: 15%;" class="text-right">Kuantitas</th>
                <th style="width: 15%;" class="text-center">Satuan</th>
            </tr>
        </thead>
        <tbody>
            @forelse($movement->items as $index => $item)
                @php
                    $itemName = $item->item?->name ?? $item->product?->name ?? '-';
                    $sku = $item->item?->sku ?? $item->product?->sku ?? '-';
                @endphp
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td>{{ $sku }}</td>
                    <td><strong>{{ $itemName }}</strong></td>
                    <td class="text-right">{{ number_format($item->qty, 0, ',', '.') }}</td>
                    <td class="text-center">{{ $item->unit }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" class="text-center">Tidak ada item dalam dokumen ini.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    @if($movement->notes)
        <div class="notes-box">
            <strong>Catatan Pengiriman:</strong><br>
            {{ $movement->notes }}
        </div>
    @endif

    <table class="signatures">
        <tr>
            <td>
                Pengirim / Driver,<br>
                <div class="sign-space"></div>
                <div class="sign-name">( ............................................ )</div>
                <div>Tgl: .................................</div>
            </td>
            <td>
                Penerima Gudang,<br>
                <div class="sign-space"></div>
                <div class="sign-name">( ............................................ )</div>
                <div>Tgl: .................................</div>
            </td>
            <td>
                Mengetahui / Kepala Gudang,<br>
                <div class="sign-space"></div>
                <div class="sign-name">( ............................................ )</div>
                <div>Tgl: .................................</div>
            </td>
        </tr>
    </table>
</body>
</html>
