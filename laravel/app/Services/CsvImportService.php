<?php

namespace App\Services;

use App\Models\Item;
use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CsvImportService
{
    /**
     * Import items from a CSV file and upsert by SKU.
     */
    public function importItems(mixed $file): int
    {
        $rows = $this->parseCsv($file);
        if (empty($rows)) {
            return 0;
        }

        $headerMap = [
            'sku' => ['sku', 'kode', 'kode_barang', 'item_code', 'item_sku', 'part_number'],
            'name' => ['name', 'nama', 'nama_barang', 'item_name', 'deskripsi', 'description'],
            'category' => ['category', 'kategori', 'kategori_barang', 'cat'],
            'unit' => ['unit', 'satuan', 'uom'],
            'min_stock' => ['min_stock', 'minimum_stock', 'stok_minimal', 'stok_min', 'min_stok', 'min'],
            'safety_stock' => ['safety_stock', 'stok_pengaman', 'safety', 'buffer_stock'],
            'is_raw_material' => ['is_raw_material', 'raw_material', 'bahan_baku', 'is_raw'],
            'is_active' => ['is_active', 'active', 'status', 'aktif'],
        ];

        $records = [];
        foreach ($rows as $row) {
            $mapped = $this->mapRow($row, $headerMap);
            $sku = trim((string) ($mapped['sku'] ?? ''));
            if ($sku === '') {
                continue;
            }

            $data = [
                'sku' => $sku,
                'name' => trim((string) ($mapped['name'] ?? $sku)),
                'category' => isset($mapped['category']) ? trim((string) $mapped['category']) : null,
                'unit' => !empty($mapped['unit']) ? trim((string) $mapped['unit']) : 'pcs',
                'min_stock' => isset($mapped['min_stock']) ? (int) $mapped['min_stock'] : 0,
                'safety_stock' => isset($mapped['safety_stock']) ? (int) $mapped['safety_stock'] : 0,
                'is_raw_material' => isset($mapped['is_raw_material']) ? $this->toBoolean($mapped['is_raw_material']) : true,
                'is_active' => isset($mapped['is_active']) ? $this->toBoolean($mapped['is_active']) : true,
            ];

            // Later rows overwrite earlier rows for the same SKU
            $records[$sku] = $data;
        }

        if (empty($records)) {
            return 0;
        }

        DB::transaction(function () use ($records) {
            foreach (array_chunk($records, 100, true) as $chunk) {
                foreach ($chunk as $sku => $attributes) {
                    Item::updateOrCreate(['sku' => $sku], $attributes);
                }
            }
        });

        return count($records);
    }

    /**
     * Import products from a CSV file and upsert by SKU.
     */
    public function importProducts(mixed $file): int
    {
        $rows = $this->parseCsv($file);
        if (empty($rows)) {
            return 0;
        }

        $headerMap = [
            'sku' => ['sku', 'kode', 'kode_produk', 'product_code', 'product_sku'],
            'name' => ['name', 'nama', 'nama_produk', 'product_name'],
            'unit' => ['unit', 'satuan', 'uom'],
            'selling_price' => ['selling_price', 'harga', 'harga_jual', 'price', 'sell_price'],
            'cogs_price' => ['cogs_price', 'hpp', 'harga_pokok', 'cost', 'cost_price', 'cogs'],
            'min_stock' => ['min_stock', 'minimum_stock', 'stok_minimal', 'stok_min', 'min_stok', 'min'],
            'is_active' => ['is_active', 'active', 'status', 'aktif'],
        ];

        $records = [];
        foreach ($rows as $row) {
            $mapped = $this->mapRow($row, $headerMap);
            $sku = trim((string) ($mapped['sku'] ?? ''));
            if ($sku === '') {
                continue;
            }

            $data = [
                'sku' => $sku,
                'name' => trim((string) ($mapped['name'] ?? $sku)),
                'unit' => !empty($mapped['unit']) ? trim((string) $mapped['unit']) : 'pcs',
                'selling_price' => isset($mapped['selling_price']) ? (float) str_replace(['Rp', '.', ' '], ['', '', ''], str_replace(',', '.', (string) $mapped['selling_price'])) : 0,
                'cogs_price' => isset($mapped['cogs_price']) ? (float) str_replace(['Rp', '.', ' '], ['', '', ''], str_replace(',', '.', (string) $mapped['cogs_price'])) : 0,
                'min_stock' => isset($mapped['min_stock']) ? (int) $mapped['min_stock'] : 0,
                'is_active' => isset($mapped['is_active']) ? $this->toBoolean($mapped['is_active']) : true,
            ];

            $records[$sku] = $data;
        }

        if (empty($records)) {
            return 0;
        }

        DB::transaction(function () use ($records) {
            foreach (array_chunk($records, 100, true) as $chunk) {
                foreach ($chunk as $sku => $attributes) {
                    Product::updateOrCreate(['sku' => $sku], $attributes);
                }
            }
        });

        return count($records);
    }

    /**
     * Import vendors from a CSV file and upsert by code.
     */
    public function importVendors(mixed $file): int
    {
        $rows = $this->parseCsv($file);
        if (empty($rows)) {
            return 0;
        }

        $headerMap = [
            'code' => ['code', 'kode', 'kode_vendor', 'kode_pemasok', 'vendor_code'],
            'name' => ['name', 'nama', 'nama_vendor', 'nama_pemasok', 'vendor_name', 'supplier_name'],
            'contact_person' => ['contact_person', 'kontak', 'kontak_person', 'pic', 'nama_pic', 'contact'],
            'phone' => ['phone', 'telepon', 'telp', 'no_telp', 'nomor_telepon', 'hp', 'no_hp'],
            'email' => ['email', 'surel', 'e_mail'],
            'address' => ['address', 'alamat', 'alamat_lengkap'],
            'payment_terms' => ['payment_terms', 'termin', 'termin_pembayaran', 'syarat_pembayaran', 'terms', 'term'],
            'is_active' => ['is_active', 'active', 'status', 'aktif'],
        ];

        $records = [];
        foreach ($rows as $row) {
            $mapped = $this->mapRow($row, $headerMap);
            $code = trim((string) ($mapped['code'] ?? ''));
            if ($code === '') {
                // If code is empty but name exists, fallback to code generated from name or skip
                $name = trim((string) ($mapped['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 10));
            }

            $data = [
                'code' => $code,
                'name' => trim((string) ($mapped['name'] ?? $code)),
                'contact_person' => isset($mapped['contact_person']) ? trim((string) $mapped['contact_person']) : null,
                'phone' => isset($mapped['phone']) ? trim((string) $mapped['phone']) : null,
                'email' => isset($mapped['email']) ? trim((string) $mapped['email']) : null,
                'address' => isset($mapped['address']) ? trim((string) $mapped['address']) : null,
                'payment_terms' => isset($mapped['payment_terms']) ? trim((string) $mapped['payment_terms']) : null,
                'is_active' => isset($mapped['is_active']) ? $this->toBoolean($mapped['is_active']) : true,
            ];

            $records[$code] = $data;
        }

        if (empty($records)) {
            return 0;
        }

        DB::transaction(function () use ($records) {
            foreach (array_chunk($records, 100, true) as $chunk) {
                foreach ($chunk as $code => $attributes) {
                    Vendor::updateOrCreate(['code' => $code], $attributes);
                }
            }
        });

        return count($records);
    }

    /**
     * Parse CSV stream row by row with header normalization.
     *
     * @return array<int, array<string, string>>
     */
    protected function parseCsv(mixed $file): array
    {
        $filePath = $this->resolveFilePath($file);
        if (!file_exists($filePath)) {
            return [];
        }

        $handle = fopen($filePath, 'r');
        if ($handle === false) {
            return [];
        }

        // Detect delimiter: semicolon or comma
        $firstLine = fgets($handle);
        if ($firstLine === false) {
            fclose($handle);
            return [];
        }
        rewind($handle);

        $delimiter = (strpos($firstLine, ';') !== false && strpos($firstLine, ',') === false) ? ';' : ',';

        $rawHeaders = fgetcsv($handle, 0, $delimiter);
        if (!$rawHeaders) {
            fclose($handle);
            return [];
        }

        $normalizedHeaders = [];
        foreach ($rawHeaders as $index => $header) {
            $normalizedHeaders[$index] = $this->normalizeHeader((string) $header);
        }

        $rows = [];
        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            if (empty(array_filter($row, fn ($val) => trim((string) $val) !== ''))) {
                continue;
            }

            $rowData = [];
            foreach ($normalizedHeaders as $index => $headerKey) {
                $rowData[$headerKey] = isset($row[$index]) ? trim((string) $row[$index]) : '';
            }

            $rows[] = $rowData;
        }

        fclose($handle);
        return $rows;
    }

    /**
     * Map normalized row keys to canonical target attributes using alias map.
     */
    protected function mapRow(array $row, array $headerMap): array
    {
        $mapped = [];
        foreach ($headerMap as $targetField => $aliases) {
            foreach ($aliases as $alias) {
                if (array_key_exists($alias, $row) && $row[$alias] !== '') {
                    $mapped[$targetField] = $row[$alias];
                    break;
                }
            }
        }
        return $mapped;
    }

    /**
     * Normalize header name to lowercase snake_case without BOM.
     */
    protected function normalizeHeader(string $header): string
    {
        // Strip UTF-8 BOM
        $header = preg_replace('/^\xEF\xBB\xBF/', '', $header);
        $header = trim($header);
        $header = strtolower($header);
        $header = preg_replace('/[^a-z0-9]+/', '_', $header);
        return trim($header, '_');
    }

    /**
     * Convert various boolean representations to bool.
     */
    protected function toBoolean(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        $val = strtolower(trim((string) $value));
        return in_array($val, ['1', 'true', 'ya', 'yes', 'aktif', 'active'], true);
    }

    /**
     * Resolve the absolute path to the CSV file.
     */
    protected function resolveFilePath(mixed $file): string
    {
        if ($file instanceof UploadedFile) {
            return $file->getRealPath() ?: $file->path();
        }

        if ($file instanceof \SplFileInfo) {
            return $file->getRealPath() ?: $file->getPathname();
        }

        if (is_string($file)) {
            if (file_exists($file)) {
                return $file;
            }
            if (Storage::disk('public')->exists($file)) {
                return Storage::disk('public')->path($file);
            }
            if (Storage::disk('local')->exists($file)) {
                return Storage::disk('local')->path($file);
            }
            if (Storage::exists($file)) {
                return Storage::path($file);
            }
        }

        throw new \InvalidArgumentException('File CSV tidak ditemukan atau tidak valid.');
    }
}
