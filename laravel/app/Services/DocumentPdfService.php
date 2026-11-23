<?php

namespace App\Services;

use App\Models\Product;
use App\Models\SalesOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class DocumentPdfService
{
    /**
     * Generates a Sales Order PDF and stores it on the public storage disk.
     *
     * @param SalesOrder $order
     * @return string Relative path in public storage: sales-orders/{so_number}.pdf
     */
    public function generateSalesOrderPdf(SalesOrder $order): string
    {
        $order->loadMissing(['location', 'items.product']);

        $pdf = Pdf::loadView('pdf.sales-order', [
            'order' => $order,
        ]);

        $relativeDirectory = 'sales-orders';
        $relativePath = "{$relativeDirectory}/{$order->so_number}.pdf";

        Storage::disk('public')->put($relativePath, $pdf->output());

        $fullPath = storage_path('app/public/' . $relativePath);
        if (! file_exists($fullPath)) {
            @mkdir(dirname($fullPath), 0755, true);
            @file_put_contents($fullPath, $pdf->output());
        }

        $order->update(['pdf_path' => $relativePath]);

        return $relativePath;
    }

    /**
     * Generates an Invoice PDF and stores it on the public storage disk.
     *
     * @param SalesOrder $order
     * @return string Relative path in public storage: invoices/INV-{so_number}.pdf
     */
    public function generateInvoicePdf(SalesOrder $order): string
    {
        $order->loadMissing(['location', 'items.product']);

        $pdf = Pdf::loadView('pdf.invoice', [
            'order' => $order,
        ]);

        $relativeDirectory = 'invoices';
        $relativePath = "{$relativeDirectory}/INV-{$order->so_number}.pdf";

        Storage::disk('public')->put($relativePath, $pdf->output());

        $fullPath = storage_path('app/public/' . $relativePath);
        if (! file_exists($fullPath)) {
            @mkdir(dirname($fullPath), 0755, true);
            @file_put_contents($fullPath, $pdf->output());
        }

        return $relativePath;
    }

    /**
     * Generates a QR Code sticker label PDF for a product and stores it on disk.
     *
     * @param Product $product
     * @return string Relative path in public storage: qr-labels/{sku}.pdf
     */
    public function generateQrLabelPdf(Product $product): string
    {
        $qrCodeSvg = (string) QrCode::size(150)->generate($product->sku);
        $qrCodeBase64 = base64_encode($qrCodeSvg);

        $pdf = Pdf::loadView('pdf.qr-label', [
            'product' => $product,
            'qrCodeBase64' => $qrCodeBase64,
        ]);

        $relativeDirectory = 'qr-labels';
        $relativePath = "{$relativeDirectory}/{$product->sku}.pdf";

        Storage::disk('public')->put($relativePath, $pdf->output());

        $fullPath = storage_path('app/public/' . $relativePath);
        if (! file_exists($fullPath)) {
            @mkdir(dirname($fullPath), 0755, true);
            @file_put_contents($fullPath, $pdf->output());
        }

        return $relativePath;
    }
}
