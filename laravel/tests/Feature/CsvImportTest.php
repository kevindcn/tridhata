<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\CsvImportService;
use Filament\Pages\Actions\Action;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CsvImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_items_from_csv(): void
    {
        $csvContent = "sku,name,category,unit,min_stock\nRAW-001,Pupuk NPK,Pupuk,kg,50\nRAW-002,Polybag 20x20,Kemasan,pcs,500";
        $file = UploadedFile::fake()->createWithContent('items.csv', $csvContent);

        $service = new CsvImportService();
        $importedCount = $service->importItems($file);

        $this->assertEquals(2, $importedCount);
        $this->assertDatabaseHas('items', ['sku' => 'RAW-001', 'name' => 'Pupuk NPK', 'unit' => 'kg', 'min_stock' => 50]);
        $this->assertDatabaseHas('items', ['sku' => 'RAW-002', 'name' => 'Polybag 20x20', 'unit' => 'pcs', 'min_stock' => 500]);
    }

    public function test_import_products_from_csv(): void
    {
        $csvContent = "sku,name,unit,selling_price,cogs_price,min_stock\nPROD-001,Beras Premium 5kg,sak,75000,60000,20\nPROD-002,Beras Medium 5kg,sak,65000,52000,30";
        $file = UploadedFile::fake()->createWithContent('products.csv', $csvContent);

        $service = new CsvImportService();
        $importedCount = $service->importProducts($file);

        $this->assertEquals(2, $importedCount);
        $this->assertDatabaseHas('products', [
            'sku' => 'PROD-001',
            'name' => 'Beras Premium 5kg',
            'selling_price' => 75000,
            'cogs_price' => 60000,
            'min_stock' => 20,
        ]);
        $this->assertDatabaseHas('products', [
            'sku' => 'PROD-002',
            'name' => 'Beras Medium 5kg',
            'selling_price' => 65000,
            'cogs_price' => 52000,
            'min_stock' => 30,
        ]);
    }

    public function test_import_vendors_from_csv(): void
    {
        $csvContent = "code,name,contact_person,phone,email,address,payment_terms\nVND-001,PT Pupuk Indonesia,Budi Santoso,08123456789,budi@pupuk.com,Jl. Industri No 1,Net 30\nVND-002,CV Plastik Jaya,Siti Rahma,08987654321,siti@plastikjaya.com,Jl Togamas 4,Cash";
        $file = UploadedFile::fake()->createWithContent('vendors.csv', $csvContent);

        $service = new CsvImportService();
        $importedCount = $service->importVendors($file);

        $this->assertEquals(2, $importedCount);
        $this->assertDatabaseHas('vendors', [
            'code' => 'VND-001',
            'name' => 'PT Pupuk Indonesia',
            'contact_person' => 'Budi Santoso',
            'phone' => '08123456789',
            'email' => 'budi@pupuk.com',
            'payment_terms' => 'Net 30',
        ]);
    }

    public function test_duplicate_rows_and_update_existing_behavior(): void
    {
        Item::create([
            'sku' => 'RAW-001',
            'name' => 'Pupuk NPK Lama',
            'category' => 'Pupuk',
            'unit' => 'kg',
            'min_stock' => 10,
        ]);

        // CSV contains updated name and duplicate rows for RAW-001
        $csvContent = "SKU, Name ,Category,Unit,Min_Stock\nRAW-001,Pupuk NPK Baru,Pupuk Kimia,kg,60\nRAW-001,Pupuk NPK Terakhir,Pupuk Kimia,kg,75\nRAW-003,Bibit Padi,Bibit,kg,100";
        $file = UploadedFile::fake()->createWithContent('items_duplicates.csv', $csvContent);

        $service = new CsvImportService();
        $importedCount = $service->importItems($file);

        $this->assertEquals(2, $importedCount); // 2 distinct SKUs processed
        $this->assertDatabaseCount('items', 2);
        $this->assertDatabaseHas('items', [
            'sku' => 'RAW-001',
            'name' => 'Pupuk NPK Terakhir',
            'min_stock' => 75,
        ]);
        $this->assertDatabaseHas('items', [
            'sku' => 'RAW-003',
            'name' => 'Bibit Padi',
            'min_stock' => 100,
        ]);
    }

    public function test_filament_resources_load_successfully_for_authenticated_users(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@tridhata.com',
            'active' => true,
        ]);

        $this->actingAs($user);

        // Test Item Resource List
        $responseItem = $this->get('/admin/items');
        $responseItem->assertSuccessful();

        // Test Product Resource List
        $responseProduct = $this->get('/admin/products');
        $responseProduct->assertSuccessful();

        // Test Vendor Resource List
        $responseVendor = $this->get('/admin/vendors');
        $responseVendor->assertSuccessful();
    }
}
