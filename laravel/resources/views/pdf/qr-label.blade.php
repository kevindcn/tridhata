<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Label QR - {{ $product->sku }}</title>
    <style>
        @page {
            size: A6 landscape;
            margin: 12px 16px;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.3;
            color: #111;
        }
        .label-card {
            border: 2px solid #1b4332;
            border-radius: 6px;
            padding: 10px 14px;
            background-color: #fff;
        }
        .label-header {
            border-bottom: 2px solid #2d6a4f;
            padding-bottom: 6px;
            margin-bottom: 10px;
        }
        .brand-title {
            font-size: 13px;
            font-weight: bold;
            color: #1b4332;
            letter-spacing: 0.5px;
        }
        .brand-subtitle {
            font-size: 9px;
            color: #555;
        }
        .label-body {
            width: 100%;
            border-collapse: collapse;
        }
        .label-body td {
            vertical-align: middle;
        }
        .info-col {
            width: 60%;
            padding-right: 10px;
        }
        .qr-col {
            width: 40%;
            text-align: center;
        }
        .product-sku {
            font-size: 14px;
            font-weight: bold;
            color: #1b4332;
            background: #e8f5e9;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 6px;
        }
        .product-name {
            font-size: 13px;
            font-weight: bold;
            color: #222;
            margin-bottom: 6px;
        }
        .product-detail {
            font-size: 10px;
            color: #444;
            margin-bottom: 3px;
        }
        .product-price {
            font-size: 12px;
            font-weight: bold;
            color: #1b4332;
            margin-top: 6px;
        }
        .qr-image {
            width: 130px;
            height: 130px;
            display: block;
            margin: 0 auto;
        }
        .qr-caption {
            font-size: 9px;
            font-weight: bold;
            color: #444;
            margin-top: 4px;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>
    <div class="label-card">
        <div class="label-header">
            <table style="width: 100%;">
                <tr>
                    <td>
                        <div class="brand-title">PT TRIDHATA AGRO INOVASI</div>
                        <div class="brand-subtitle">Label Identifikasi Produk & Gudang</div>
                    </td>
                    <td style="text-align: right; font-size: 9px; color: #666;">
                        Dicetak: {{ now()->translatedFormat('d M Y') }}
                    </td>
                </tr>
            </table>
        </div>

        <table class="label-body">
            <tr>
                <td class="info-col">
                    <div class="product-sku">{{ $product->sku }}</div>
                    <div class="product-name">{{ $product->name }}</div>
                    <div class="product-detail"><strong>Satuan:</strong> {{ $product->unit ?? 'pcs' }}</div>
                    <div class="product-detail"><strong>Stok Minimal:</strong> {{ $product->min_stock ?? 0 }} {{ $product->unit ?? 'pcs' }}</div>
                    <div class="product-price">Harga: Rp {{ number_format($product->selling_price, 0, ',', '.') }}</div>
                </td>
                <td class="qr-col">
                    <img src="data:image/svg+xml;base64,{{ $qrCodeBase64 }}" class="qr-image" alt="QR Code" />
                    <div class="qr-caption">{{ $product->sku }}</div>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
