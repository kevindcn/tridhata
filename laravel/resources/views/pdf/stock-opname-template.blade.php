<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Formulir Stock Opname - {{ $opname->code ?? 'SO-BLANK' }}</title>
    <style>
        @page {
            margin: 20px 24px;
            size: A4 portrait;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            color: #111;
            margin: 0;
            padding: 10px 10px;
            position: relative;
        }
        /* 4 Corner Registration Square Markers for OpenCV Auto-straightening */
        .corner-marker {
            position: absolute;
            width: 24px;
            height: 24px;
            background-color: #000;
        }
        .corner-marker.top-left {
            top: 0px;
            left: 0px;
        }
        .corner-marker.top-right {
            top: 0px;
            right: 0px;
        }
        .corner-marker.bottom-left {
            bottom: 0px;
            left: 0px;
        }
        .corner-marker.bottom-right {
            bottom: 0px;
            right: 0px;
        }

        .header-container {
            margin-top: 15px;
            margin-bottom: 15px;
            border-bottom: 2px solid #2d6a4f;
            padding-bottom: 8px;
        }
        .title-block {
            text-align: center;
            margin-bottom: 12px;
        }
        .title-block h1 {
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0 0 4px 0;
            color: #1b4332;
        }
        .title-block p {
            margin: 0;
            font-size: 9px;
            color: #666;
        }

        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        .meta-table td {
            padding: 3px 5px;
            font-size: 10px;
            vertical-align: middle;
        }
        .meta-label {
            font-weight: bold;
            color: #222;
            width: 15%;
        }
        .meta-sep {
            width: 2%;
        }
        .meta-val {
            width: 33%;
        }

        .table-data {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 15px;
        }
        .table-data th, .table-data td {
            border: 1px solid #333;
            padding: 6px 6px;
            font-size: 10px;
            vertical-align: middle;
        }
        .table-data th {
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

        /* 4 Individual Square Character Boxes [ ][ ][ ][ ] */
        .digit-container {
            display: inline-block;
            white-space: nowrap;
        }
        .digit-box {
            display: inline-block;
            width: 22px;
            height: 24px;
            border: 1.5px solid #000;
            margin: 0 1px;
            background-color: #fff;
            vertical-align: middle;
        }

        .instructions {
            margin-top: 10px;
            padding: 6px 10px;
            background-color: #f8f9fa;
            border: 1px dashed #999;
            font-size: 9px;
            color: #444;
        }
    </style>
</head>
<body>
    <!-- Corner Registration Markers -->
    <div class="corner-marker top-left"></div>
    <div class="corner-marker top-right"></div>
    <div class="corner-marker bottom-left"></div>
    <div class="corner-marker bottom-right"></div>

    <div class="header-container">
        <div class="title-block">
            <h1>Formulir Stock Opname Fisik</h1>
            <p>Tridhata Agro ERP - Kode Formulir: {{ $opname->code ?? 'SO-SAMPLE' }}</p>
        </div>

        <table class="meta-table">
            <tr>
                <td class="meta-label">Cabang</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">{{ $opname->location->name ?? '-' }}</td>
                <td class="meta-label">Tanggal</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">{{ $opname->date ? \Carbon\Carbon::parse($opname->date)->format('Y-m-d') : date('Y-m-d') }}</td>
            </tr>
            <tr>
                <td class="meta-label">Petugas</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">{{ $opname->creator->name ?? 'Petugas Gudang' }}</td>
                <td class="meta-label">Status</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">{{ $opname->status ?? 'DRAFT' }}</td>
            </tr>
        </table>
    </div>

    <table class="table-data">
        <thead>
            <tr>
                <th style="width: 5%;">No</th>
                <th style="width: 15%;">SKU</th>
                <th style="width: 35%;">Nama Barang</th>
                <th style="width: 12%;">Stok Sistem</th>
                <th style="width: 23%;">Kotak Hitung Fisik</th>
                <th style="width: 10%;">Satuan</th>
            </tr>
        </thead>
        <tbody>
            @forelse($opname->items ?? [] as $index => $item)
                @php
                    $master = $item->item ?? $item->product ?? null;
                    $sku = $master->sku ?? ('SKU-' . str_pad($index + 1, 3, '0', STR_PAD_LEFT));
                    $name = $master->name ?? 'Barang #' . ($index + 1);
                    $unit = $master->unit ?? 'pcs';
                    $sysQty = $item->system_qty ?? 0;
                @endphp
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td style="font-weight: bold;">{{ $sku }}</td>
                    <td>{{ $name }}</td>
                    <td class="text-center">{{ $sysQty }}</td>
                    <td class="text-center">
                        <div class="digit-container">
                            <span class="digit-box"></span>
                            <span class="digit-box"></span>
                            <span class="digit-box"></span>
                            <span class="digit-box"></span>
                        </div>
                    </td>
                    <td class="text-center">{{ $unit }}</td>
                </tr>
            @empty
                @for($i = 1; $i <= 10; $i++)
                    <tr>
                        <td class="text-center">{{ $i }}</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="text-center">0</td>
                        <td class="text-center">
                            <div class="digit-container">
                                <span class="digit-box"></span>
                                <span class="digit-box"></span>
                                <span class="digit-box"></span>
                                <span class="digit-box"></span>
                            </div>
                        </td>
                        <td class="text-center">pcs</td>
                    </tr>
                @endfor
            @endforelse
        </tbody>
    </table>

    <div class="instructions">
        <strong>Petunjuk Pengisian:</strong>
        Tulis 1 digit angka per kotak secara jelas (contoh: [0][0][2][5]). Jangan melewati batas kotak.
        Pastikan 4 tanda kotak hitam di setiap sudut tidak terpotong saat mengambil foto formulir.
    </div>
</body>
</html>
