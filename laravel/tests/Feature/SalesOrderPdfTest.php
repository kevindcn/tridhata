<?php

namespace Tests\Feature;

use App\Filament\Resources\ProductResource;
use App\Filament\Resources\SalesOrderResource;
use App\Models\Location;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\User;
use App\Services\DocumentPdfService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SalesOrderPdfTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'sales_admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'kepala_cabang', 'guard_name' => 'web']);
    }

    public function test_generates_sales_order_pdf_and_stores_on_disk(): void
    {
        $location = Location::factory()->create(['name' => 'Gudang Bogor', 'code' => 'BGR']);
        $product = Product::factory()->create(['sku' => 'PROD-01', 'name' => 'Pupuk Organik Padat', 'selling_price' => 50000]);

        $order = SalesOrder::factory()->create([
            'so_number' => 'SO-2026-001',
            'po_number' => 'PO-CUST-889',
            'customer_name' => 'PT Tani Makmur',
            'channel' => 'OFFLINE',
            'location_id' => $location->id,
            'date' => '2026-11-23',
            'status' => 'CONFIRMED',
            'total_amount' => 100000,
        ]);

        SalesOrderItem::create([
            'sales_order_id' => $order->id,
            'product_id' => $product->id,
            'qty' => 2,
            'price' => 50000,
            'total' => 100000,
        ]);

        $service = app(DocumentPdfService::class);

        $pdfPath = $service->generateSalesOrderPdf($order);

        $this->assertNotEmpty($pdfPath);
        $this->assertStringEndsWith('.pdf', $pdfPath);
        $this->assertFileExists(storage_path('app/public/' . $pdfPath));
        Storage::disk('public')->assertExists($pdfPath);
    }

    public function test_generates_invoice_pdf_and_stores_on_disk(): void
    {
        $location = Location::factory()->create(['name' => 'Gudang Nganjuk', 'code' => 'NGJ']);
        $product = Product::factory()->create(['sku' => 'PROD-02', 'name' => 'Pupuk Hayati Cair', 'selling_price' => 75000]);

        $order = SalesOrder::factory()->create([
            'so_number' => 'SO-2026-002',
            'customer_name' => 'CV Subur Jaya',
            'channel' => 'TOKOPEDIA',
            'location_id' => $location->id,
            'date' => '2026-11-23',
            'status' => 'CONFIRMED',
            'total_amount' => 150000,
        ]);

        SalesOrderItem::create([
            'sales_order_id' => $order->id,
            'product_id' => $product->id,
            'qty' => 2,
            'price' => 75000,
            'total' => 150000,
        ]);

        $service = app(DocumentPdfService::class);

        $pdfPath = $service->generateInvoicePdf($order);

        $this->assertNotEmpty($pdfPath);
        $this->assertStringEndsWith('.pdf', $pdfPath);
        $this->assertStringContainsString('INV-SO-2026-002', $pdfPath);
        $this->assertFileExists(storage_path('app/public/' . $pdfPath));
        Storage::disk('public')->assertExists($pdfPath);
    }

    public function test_generates_qr_label_for_product(): void
    {
        $product = Product::factory()->create([
            'sku' => 'PROD-A',
            'name' => 'Pupuk Organik Super',
            'unit' => 'pcs',
            'selling_price' => 45000,
        ]);

        $service = app(DocumentPdfService::class);

        $labelPdf = $service->generateQrLabelPdf($product);

        $this->assertNotEmpty($labelPdf);
        $this->assertStringEndsWith('.pdf', $labelPdf);
        $this->assertStringContainsString('PROD-A', $labelPdf);
        $this->assertFileExists(storage_path('app/public/' . $labelPdf));
        Storage::disk('public')->assertExists($labelPdf);
    }

    public function test_branch_scoping_on_sales_orders(): void
    {
        $locationA = Location::factory()->create(['name' => 'Cabang Bogor']);
        $locationB = Location::factory()->create(['name' => 'Cabang Nganjuk']);

        $userBogor = User::factory()->create(['default_location_id' => $locationA->id]);
        $userBogor->locations()->attach($locationA->id);
        $userBogor->assignRole('kepala_cabang');

        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super_admin');

        $orderA = SalesOrder::factory()->create(['location_id' => $locationA->id, 'so_number' => 'SO-BGR-01']);
        $orderB = SalesOrder::factory()->create(['location_id' => $locationB->id, 'so_number' => 'SO-NGJ-01']);

        // Restricted user query scope
        $this->actingAs($userBogor);
        $this->assertTrue(SalesOrderResource::getEloquentQuery()->where('id', $orderA->id)->exists());
        $this->assertFalse(SalesOrderResource::getEloquentQuery()->where('id', $orderB->id)->exists());

        // Super admin sees all
        $this->actingAs($superAdmin);
        $this->assertTrue(SalesOrderResource::getEloquentQuery()->where('id', $orderA->id)->exists());
        $this->assertTrue(SalesOrderResource::getEloquentQuery()->where('id', $orderB->id)->exists());
    }

    public function test_filament_sales_order_resource_actions(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');
        $this->actingAs($user);

        $order = SalesOrder::factory()->create(['so_number' => 'SO-TEST-ACT']);
        $product = Product::factory()->create();
        SalesOrderItem::create([
            'sales_order_id' => $order->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => 10000,
            'total' => 10000,
        ]);

        Livewire::test(SalesOrderResource\Pages\ListSalesOrders::class)
            ->assertTableActionExists('downloadSalesOrder')
            ->assertTableActionExists('downloadInvoice')
            ->callTableAction('downloadSalesOrder', $order)
            ->assertFileDownloaded();

        Livewire::test(SalesOrderResource\Pages\ListSalesOrders::class)
            ->callTableAction('downloadInvoice', $order)
            ->assertFileDownloaded();
    }

    public function test_filament_product_resource_qr_label_action(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');
        $this->actingAs($user);

        $product = Product::factory()->create(['sku' => 'SKU-QR-001', 'name' => 'Produk Uji']);

        Livewire::test(ProductResource\Pages\ListProducts::class)
            ->assertTableActionExists('printQrLabel')
            ->callTableAction('printQrLabel', $product)
            ->assertFileDownloaded();
    }

    public function test_user_without_locations_sees_no_sales_orders(): void
    {
        $location = Location::factory()->create();
        SalesOrder::factory()->create(['location_id' => $location->id]);

        $userWithoutLocation = User::factory()->create(['default_location_id' => null]);
        $userWithoutLocation->assignRole('sales_admin');

        $this->actingAs($userWithoutLocation);
        $this->assertEquals(0, SalesOrderResource::getEloquentQuery()->count());
    }

    public function test_sales_order_and_delivery_relationships(): void
    {
        $location = Location::factory()->create(['name' => 'Gudang Utama']);
        $product = Product::factory()->create(['name' => 'Pupuk A']);

        $order = SalesOrder::factory()->create([
            'location_id' => $location->id,
            'so_number' => 'SO-REL-01',
        ]);

        $orderItem = SalesOrderItem::create([
            'sales_order_id' => $order->id,
            'product_id' => $product->id,
            'qty' => 5,
            'price' => 20000,
            'total' => 100000,
        ]);

        $delivery = \App\Models\Delivery::create([
            'sj_number' => 'SJ-REL-01',
            'sales_order_id' => $order->id,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'driver_name' => 'Budi Santoso',
            'vehicle_no' => 'B 1234 CD',
            'status' => 'PENDING',
        ]);

        // Test relations
        $this->assertEquals($location->id, $order->location->id);
        $this->assertCount(1, $order->items);
        $this->assertEquals($product->id, $order->items->first()->product->id);
        $this->assertEquals($order->id, $orderItem->salesOrder->id);
        $this->assertCount(1, $order->deliveries);
        $this->assertEquals($delivery->id, $order->deliveries->first()->id);
        $this->assertEquals($order->id, $delivery->salesOrder->id);
        $this->assertEquals($location->id, $delivery->location->id);

        $this->assertTrue($location->salesOrders->contains($order));
        $this->assertTrue($location->deliveries->contains($delivery));
        $this->assertTrue($product->salesOrderItems->contains($orderItem));
    }
}
