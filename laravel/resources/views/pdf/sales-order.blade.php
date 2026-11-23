<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Sales Order - {{ $order->so_number }}</title>
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
            margin-bottom: 15px;
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
        .total-box {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .total-box td {
            padding: 4px 8px;
            font-size: 11px;
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
                    <div style="font-size: 13px; font-weight: bold; color: #1b4332;">SALES ORDER</div>
                    <div style="font-size: 11px; font-weight: bold; color: #444;">{{ $order->so_number }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="doc-title">PESANAN PENJUALAN (SALES ORDER)</div>

    <table class="meta-table">
        <tr>
            <td class="meta-label">Nomor SO</td>
            <td class="meta-sep">:</td>
            <td class="meta-val"><strong>{{ $order->so_number }}</strong></td>
            <td class="meta-label">Cabang / Lokasi</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ $order->location?->name ?? '-' }} ({{ $order->location?->code ?? '-' }})</td>
        </tr>
        <tr>
            <td class="meta-label">Nomor PO Pelanggan</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ $order->po_number ?? '-' }}</td>
            <td class="meta-label">Nama Pelanggan</td>
            <td class="meta-sep">:</td>
            <td class="meta-val"><strong>{{ $order->customer_name ?? '-' }}</strong></td>
        </tr>
        <tr>
            <td class="meta-label">Tanggal Pesanan</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ \Carbon\Carbon::parse($order->date)->translatedFormat('d F Y') }}</td>
            <td class="meta-label">Saluran Penjualan</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ $order->channel ?? 'OFFLINE' }}</td>
        </tr>
        <tr>
            <td class="meta-label">Status Pesanan</td>
            <td class="meta-sep">:</td>
            <td class="meta-val"><strong>{{ $order->status }}</strong></td>
            <td class="meta-label">Dicetak Pada</td>
            <td class="meta-sep">:</td>
            <td class="meta-val">{{ now()->translatedFormat('d F Y H:i') }}</td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;">No</th>
                <th style="width: 18%;">SKU</th>
                <th style="width: 37%;">Nama Produk</th>
                <th style="width: 10%;" class="text-center">Satuan</th>
                <th style="width: 10%;" class="text-right">Qty</th>
                <th style="width: 20%;" class="text-right">Harga Satuan (Rp)</th>
                <th style="width: 20%;" class="text-right">Total (Rp)</th>
            </tr>
        </thead>
        <tbody>
            @php $calculatedSubtotal = 0; @endphp
            @forelse($order->items as $index => $item)
                @php
                    $lineTotal = $item->total > 0 ? $item->total : ($item->qty * $item->price);
                    $calculatedSubtotal += $lineTotal;
                @endphp
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td>{{ $item->product?->sku ?? '-' }}</td>
                    <td><strong>{{ $item->product?->name ?? '-' }}</strong></td>
                    <td class="text-center">{{ $item->product?->unit ?? 'pcs' }}</td>
                    <td class="text-right">{{ number_format($item->qty, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($item->price, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($lineTotal, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="7" class="text-center">Tidak ada item dalam pesanan ini.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <table class="total-box">
        <tr>
            <td style="width: 60%;"></td>
            <td style="width: 20%; text-align: right; font-weight: bold;">Subtotal:</td>
            <td style="width: 20%; text-align: right;">Rp {{ number_format($calculatedSubtotal, 0, ',', '.') }}</td>
        </tr>
        <tr>
            <td style="width: 60%;"></td>
            <td style="width: 20%; text-align: right; font-weight: bold; border-top: 1px solid #ccc; font-size: 12px; color: #1b4332;">Total Pesanan:</td>
            <td style="width: 20%; text-align: right; font-weight: bold; border-top: 1px solid #ccc; font-size: 12px; color: #1b4332;">
                Rp {{ number_format($order->total_amount > 0 ? $order->total_amount : $calculatedSubtotal, 0, ',', '.') }}
            </td>
        </tr>
    </table>

    @if($order->notes)
        <div class="notes-box">
            <strong>Catatan:</strong><br>
            {{ $order->notes }}
        </div>
    @endif

    <table class="signatures">
        <tr>
            <td>
                Pemesan / Pelanggan,<br>
                <div class="sign-space"></div>
                <div class="sign-name">( {{ $order->customer_name ?: '................................' }} )</div>
                <div>Tgl: .................................</div>
            </td>
            <td>
                Bagian Penjualan,<br>
                <div class="sign-space"></div>
                <div class="sign-name">( ............................................ )</div>
                <div>Tgl: .................................</div>
            </td>
            <td>
                Mengetahui / Keuangan,<br>
                <div class="sign-space"></div>
                <div class="sign-name">( ............................................ )</div>
                <div>Tgl: .................................</div>
            </td>
        </tr>
    </table>
</body>
</html>
