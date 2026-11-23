<?php

namespace Tests\Feature;

use App\Enums\StockMovementType;
use App\Jobs\ProcessStockOpnameOcrJob;
use App\Models\Approval;
use App\Models\Attendance;
use App\Models\Bom;
use App\Models\BomItem;
use App\Models\Item;
use App\Models\Letter;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductionLog;
use App\Models\Request as ErpRequest;
use App\Models\RequestItem;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\StockMovementItem;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use App\Models\Vendor;
use App\Services\ApprovalService;
use App\Services\CsvImportService;
use App\Services\DocumentPdfService;
use App\Services\InventoryService;
use App\Services\LetterNumberService;
use App\Services\ProductionService;
use App\Services\WatermarkService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class E2ETrackerVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seed(RoleAndPermissionSeeder::class);
    }

    /**
     * 1a. Unregistered Google account is blocked by pre-provisioned whitelist check
     */
    public function test_flow_01a_unregistered_google_account_is_blocked(): void
    {
        $strangerMock = Mockery::mock('Laravel\Socialite\Two\User');
        $strangerMock->shouldReceive('getId')->andReturn('stranger-999');
        $strangerMock->shouldReceive('getEmail')->andReturn('intruder@unknown.com');
        $strangerMock->shouldReceive('getName')->andReturn('Intruder');
        $strangerMock->shouldReceive('getAvatar')->andReturn(null);

        $providerMock = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $providerMock->shouldReceive('user')->andReturn($strangerMock);
        Socialite::shouldReceive('driver')->with('google')->andReturn($providerMock);

        $response = $this->get('/auth/google/callback');
        $response->assertRedirect('/login');
        $response->assertSessionHas('error', 'Akun Google Anda belum terdaftar di sistem ERP Tridhata.');
        $this->assertGuest();
    }

    /**
     * 1b. Whitelisted pre-provisioned user login with Spatie role assignment
     */
    public function test_flow_01b_user_login_whitelist_and_spatie_roles(): void
    {
        $user = User::factory()->create([
            'email' => 'operasional.bogor@tridhata.com',
            'active' => true,
        ]);
        $user->assignRole('admin_bogor');

        $whitelistedMock = Mockery::mock('Laravel\Socialite\Two\User');
        $whitelistedMock->shouldReceive('getId')->andReturn('google-whitelisted-001');
        $whitelistedMock->shouldReceive('getEmail')->andReturn('operasional.bogor@tridhata.com');
        $whitelistedMock->shouldReceive('getName')->andReturn('Kepala Gudang Bogor');
        $whitelistedMock->shouldReceive('getAvatar')->andReturn('https://lh3.googleusercontent.com/avatar01');

        $providerMock = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $providerMock->shouldReceive('user')->andReturn($whitelistedMock);
        Socialite::shouldReceive('driver')->with('google')->andReturn($providerMock);

        $loginResponse = $this->get('/auth/google/callback');
        $loginResponse->assertRedirect('/admin');
        $this->assertAuthenticatedAs($user);

        $user->refresh();
        $this->assertEquals('google-whitelisted-001', $user->google_id);
        $this->assertTrue($user->hasRole('admin_bogor'));
    }

    /**
     * 2. Master data seeding and CSV import
     */
    public function test_flow_02_master_data_csv_import(): void
    {
        $csvService = new CsvImportService();

        // 2a. Import Items
        $itemsCsv = "sku,name,category,unit,min_stock\nRAW-KOP-01,Biji Kopi Arabika,Bahan Baku,kg,50\nRAW-PKG-01,Pouch 250g,Kemasan,pcs,200";
        $itemFile = UploadedFile::fake()->createWithContent('items.csv', $itemsCsv);
        $itemCount = $csvService->importItems($itemFile);
        $this->assertEquals(2, $itemCount);
        $this->assertDatabaseHas('items', ['sku' => 'RAW-KOP-01', 'name' => 'Biji Kopi Arabika']);
        $this->assertDatabaseHas('items', ['sku' => 'RAW-PKG-01', 'name' => 'Pouch 250g']);

        // 2b. Import Products
        $productsCsv = "sku,name,unit,selling_price,cogs_price,min_stock\nPROD-KOP-250,Kopi Arabika Bubuk 250g,pcs,65000,35000,50\nPROD-KOP-500,Kopi Arabika Bubuk 500g,pcs,120000,65000,30";
        $productFile = UploadedFile::fake()->createWithContent('products.csv', $productsCsv);
        $prodCount = $csvService->importProducts($productFile);
        $this->assertEquals(2, $prodCount);
        $this->assertDatabaseHas('products', ['sku' => 'PROD-KOP-250', 'selling_price' => 65000]);

        // 2c. Import Vendors
        $vendorsCsv = "code,name,contact_person,phone,email,address,payment_terms\nVND-001,PT Pupuk Organik,Budi,0812345678,budi@pupuk.com,Bogor,Net 30\nVND-002,CV Mitra Agro,Dewi,0898765432,dewi@mitra.com,Nganjuk,Cash";
        $vendorFile = UploadedFile::fake()->createWithContent('vendors.csv', $vendorsCsv);
        $vendorCount = $csvService->importVendors($vendorFile);
        $this->assertEquals(2, $vendorCount);
        $this->assertDatabaseHas('vendors', ['code' => 'VND-001', 'name' => 'PT Pupuk Organik']);
    }

    /**
     * 3. Raw material stock intake via StockMovement (IN)
     */
    public function test_flow_03_raw_material_stock_intake_via_stock_movement(): void
    {
        $bogor = Location::factory()->create(['code' => 'BGR', 'name' => 'Gudang Bogor']);
        $rawItem = Item::factory()->create(['sku' => 'RAW-INTAKE-01', 'name' => 'Gabah Basah', 'unit' => 'kg']);

        $service = app(InventoryService::class);
        $movement = $service->recordMovement([
            'type' => StockMovementType::IN,
            'location_id' => $bogor->id,
            'date' => now()->toDateString(),
            'notes' => 'Penerimaan bahan baku dari petani',
            'items' => [
                ['item_id' => $rawItem->id, 'qty' => 500, 'unit' => 'kg', 'unit_price' => 12000],
            ],
        ]);

        $this->assertInstanceOf(StockMovement::class, $movement);
        $this->assertEquals(StockMovementType::IN, $movement->type);

        $this->assertDatabaseHas('stock_levels', [
            'item_id' => $rawItem->id,
            'location_id' => $bogor->id,
            'qty' => 500,
        ]);
    }

    /**
     * 4. Purchase request submission and 2-step approval (Finance -> Director)
     */
    public function test_flow_04_purchase_request_submission_and_two_step_approval(): void
    {
        $bogor = Location::factory()->create(['code' => 'BGR', 'name' => 'Gudang Bogor']);
        $item = Item::factory()->create(['sku' => 'RAW-REQ-01', 'name' => 'Karung Plastik']);

        $requester = User::factory()->create(['name' => 'Staf Pengadaan']);
        $requester->locations()->attach($bogor);

        $financeUser = User::factory()->create(['name' => 'Manager Keuangan', 'division' => 'finance']);
        $financeUser->assignRole('finance');

        $directorUser = User::factory()->create(['name' => 'Direktur Operasional', 'division' => 'director']);
        $directorUser->assignRole('director');

        $approvalService = app(ApprovalService::class);

        // 4a. Submit request with amount requiring 2-step approval (> Rp 5.000.000)
        $request = $approvalService->submitRequest([
            'location_id' => $bogor->id,
            'type' => 'RAW_MATERIAL',
            'title' => 'Pengadaan 1000 Karung Plastik',
            'notes' => 'Persiapan panen raya',
            'items' => [
                [
                    'item_id' => $item->id,
                    'qty' => 1000,
                    'estimated_price' => 7500,
                    'total_price' => 7500000,
                ],
            ],
        ], $requester);

        $this->assertEquals('PENDING', $request->status);
        $this->assertEquals(1, $request->current_approval_step);
        $this->assertEquals(7500000, $request->amount);

        // 4b. Step 1: Finance approval
        $step1Approval = $approvalService->processDecision($request, $financeUser, 1, 'APPROVED', 'Disetujui finance sesuai anggaran.');
        $request->refresh();
        $this->assertEquals('PENDING', $request->status);
        $this->assertEquals(2, $request->current_approval_step);
        $this->assertEquals('APPROVED', $step1Approval->decision);

        // 4c. Step 2: Director approval (final)
        $step2Approval = $approvalService->processDecision($request, $directorUser, 2, 'APPROVED', 'Disetujui direktur untuk diproses PO.');
        $request->refresh();
        $this->assertEquals('APPROVED', $request->status);
        $this->assertNotNull($request->decided_at);
        $this->assertCount(2, $request->approvals);
    }

    /**
     * 5. Production execution via BOM recipe: verifying raw materials are auto-deducted and finished goods are added
     */
    public function test_flow_05_production_execution_bom_recipe_and_auto_deduction(): void
    {
        $location = Location::factory()->create(['code' => 'BGR', 'name' => 'Pabrik Bogor']);
        $rawMaterial = Item::factory()->create(['sku' => 'RAW-KOP-BOM', 'name' => 'Biji Kopi Hijau']);
        $packaging = Item::factory()->create(['sku' => 'RAW-PKG-BOM', 'name' => 'Standing Pouch 250g']);
        $finishedProduct = Product::factory()->create(['sku' => 'PROD-KOP-BOM', 'name' => 'Kopi Roasted 250g']);

        // Stock initial raw materials
        StockLevel::create(['location_id' => $location->id, 'item_id' => $rawMaterial->id, 'qty' => 300]);
        StockLevel::create(['location_id' => $location->id, 'item_id' => $packaging->id, 'qty' => 500]);

        // Define BOM recipe: 10 units finished goods requires 2.5 kg raw coffee and 10 pouches
        $bom = Bom::create([
            'product_id' => $finishedProduct->id,
            'code' => 'BOM-KOP-250',
            'name' => 'Resep Kopi Bubuk 250g',
            'batch_size' => 10,
            'yield_unit' => 'pcs',
            'is_active' => true,
        ]);
        BomItem::create([
            'bom_id' => $bom->id,
            'item_id' => $rawMaterial->id,
            'quantity' => 2.5,
            'unit' => 'kg',
        ]);
        BomItem::create([
            'bom_id' => $bom->id,
            'item_id' => $packaging->id,
            'quantity' => 10,
            'unit' => 'pcs',
        ]);

        $productionService = app(ProductionService::class);

        // Execute production of 100 units (10 batches)
        // Deducts: 25 kg raw coffee, 100 pouches; Adds: 100 units finished product
        $log = $productionService->recordProduction([
            'location_id' => $location->id,
            'product_id' => $finishedProduct->id,
            'produced_qty' => 100,
            'reject_qty' => 0,
            'notes' => 'Produksi batch 1',
        ]);

        $this->assertInstanceOf(ProductionLog::class, $log);
        $this->assertEquals(100, $log->actual_qty);

        // Verify raw materials deducted
        $this->assertEquals(275, StockLevel::where('location_id', $location->id)->where('item_id', $rawMaterial->id)->value('qty'));
        $this->assertEquals(400, StockLevel::where('location_id', $location->id)->where('item_id', $packaging->id)->value('qty'));

        // Verify finished product added
        $this->assertEquals(100, StockLevel::where('location_id', $location->id)->where('product_id', $finishedProduct->id)->value('qty'));
    }

    /**
     * 6. Inter-warehouse transfer from Bogor to Nganjuk and Surat Jalan PDF generation
     */
    public function test_flow_06_inter_warehouse_transfer_and_surat_jalan_pdf(): void
    {
        $bogor = Location::factory()->create(['code' => 'BGR', 'name' => 'Gudang Bogor', 'address' => 'Jl. Pajajaran Bogor']);
        $nganjuk = Location::factory()->create(['code' => 'NGJ', 'name' => 'Gudang Nganjuk', 'address' => 'Jl. Dermojoyo Nganjuk']);
        $product = Product::factory()->create(['sku' => 'PROD-TRF-01', 'name' => 'Kopi Kemasan Siap Jual']);

        StockLevel::create(['location_id' => $bogor->id, 'product_id' => $product->id, 'qty' => 80]);

        $inventoryService = app(InventoryService::class);

        // Execute inter-warehouse transfer of 30 units from Bogor to Nganjuk
        $movement = $inventoryService->transferBetweenWarehouses($bogor->id, $nganjuk->id, [
            ['product_id' => $product->id, 'qty' => 30, 'unit' => 'pcs'],
        ], 'Distribusi stok Bogor ke Nganjuk');

        $this->assertEquals(StockMovementType::TRANSFER, $movement->type);
        $this->assertEquals(50, StockLevel::where('location_id', $bogor->id)->where('product_id', $product->id)->value('qty'));
        $this->assertEquals(30, StockLevel::where('location_id', $nganjuk->id)->where('product_id', $product->id)->value('qty'));

        // Generate Surat Jalan PDF
        $pdfPath = $inventoryService->generateSuratJalanPdf($movement);
        $this->assertNotEmpty($pdfPath);
        $this->assertEquals("surat-jalan/{$movement->code}.pdf", $pdfPath);
        Storage::disk('public')->assertExists($pdfPath);
    }

    /**
     * 7. Sales Order creation, Invoice PDF, and QR code label generation
     */
    public function test_flow_07_sales_order_invoice_pdf_and_qr_label(): void
    {
        $nganjuk = Location::factory()->create(['code' => 'NGJ', 'name' => 'Gudang Nganjuk']);
        $product = Product::factory()->create([
            'sku' => 'PROD-SO-01',
            'name' => 'Kopi Robusta Nganjuk 250g',
            'selling_price' => 50000,
        ]);

        $salesOrder = SalesOrder::factory()->create([
            'so_number' => 'SO-2026-E2E-001',
            'po_number' => 'PO-CUST-101',
            'customer_name' => 'Toko Barokah Jaya',
            'location_id' => $nganjuk->id,
            'date' => '2026-11-23',
            'status' => 'CONFIRMED',
            'total_amount' => 1000000,
        ]);

        SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'product_id' => $product->id,
            'qty' => 20,
            'price' => 50000,
            'total' => 1000000,
        ]);

        $pdfService = app(DocumentPdfService::class);

        // 7a. Invoice PDF
        $invoicePath = $pdfService->generateInvoicePdf($salesOrder);
        $this->assertNotEmpty($invoicePath);
        $this->assertEquals("invoices/INV-{$salesOrder->so_number}.pdf", $invoicePath);
        Storage::disk('public')->assertExists($invoicePath);

        // 7b. Sales Order PDF
        $soPath = $pdfService->generateSalesOrderPdf($salesOrder);
        $this->assertNotEmpty($soPath);
        $this->assertEquals("sales-orders/{$salesOrder->so_number}.pdf", $soPath);
        Storage::disk('public')->assertExists($soPath);

        // 7c. QR Code Label PDF
        $qrPath = $pdfService->generateQrLabelPdf($product);
        $this->assertNotEmpty($qrPath);
        $this->assertEquals("qr-labels/{$product->sku}.pdf", $qrPath);
        Storage::disk('public')->assertExists($qrPath);
    }

    /**
     * 8. Mobile attendance stamping with server WIB timestamp, coordinates, and Google Maps URL
     */
    public function test_flow_08_mobile_attendance_stamping_and_maps_url(): void
    {
        $user = User::factory()->create(['name' => 'Petugas Lapangan']);
        $location = Location::factory()->create(['name' => 'Kebun Percobaan Bogor']);
        $fakePhoto = UploadedFile::fake()->image('attendance_selfie.jpg', 640, 480);

        $watermarkService = app(WatermarkService::class);
        $serverWib = Carbon::now()->setTimezone('Asia/Jakarta');
        $lat = -6.597147;
        $lng = 106.806039;

        // Stamp photo
        $stampedPath = $watermarkService->stampAttendancePhoto($fakePhoto, $lat, $lng, $serverWib);

        $this->assertNotEmpty($stampedPath);
        $this->assertStringStartsWith('attendance/', $stampedPath);
        Storage::disk('public')->assertExists($stampedPath);

        // Record attendance
        $attendance = Attendance::create([
            'user_id' => $user->id,
            'location_id' => $location->id,
            'type' => 'CLOCK_IN',
            'timestamp' => $serverWib,
            'latitude' => $lat,
            'longitude' => $lng,
            'maps_url' => "https://maps.google.com/?q={$lat},{$lng}",
            'photo_path' => $stampedPath,
            'is_verified' => true,
        ]);

        $this->assertDatabaseHas('attendances', [
            'id' => $attendance->id,
            'user_id' => $user->id,
            'type' => 'CLOCK_IN',
            'maps_url' => "https://maps.google.com/?q={$lat},{$lng}",
        ]);
    }

    /**
     * 9. Stock opname template generation, photo upload, OCR processing, and adjustment application
     */
    public function test_flow_09_stock_opname_template_ocr_and_adjustment(): void
    {
        $location = Location::factory()->create(['code' => 'NGJ', 'name' => 'Gudang Nganjuk']);
        $user = User::factory()->create(['name' => 'Petugas Opname']);
        $item = Item::factory()->create(['sku' => 'ITM-OPN-01', 'name' => 'Pupuk Urea', 'unit' => 'kg']);

        StockLevel::create(['location_id' => $location->id, 'item_id' => $item->id, 'qty' => 50]);

        $opname = StockOpname::create([
            'code' => 'SO-202611-OPN-001',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'created_by' => $user->id,
        ]);

        // 9a. Template PDF verification with 4 corner markers
        $view = view('pdf.stock-opname-template', [
            'opname' => $opname->load(['location', 'creator']),
        ])->render();
        $this->assertStringContainsString('corner-marker top-left', $view);
        $this->assertStringContainsString('corner-marker bottom-right', $view);

        // 9b. Photo upload and OCR processing via Job
        $photoPath = 'opnames/so_scan.jpg';
        Storage::disk('public')->put($photoPath, 'binary-image-data');

        $mockOcr = json_encode([
            [
                'row' => 1,
                'item_id' => $item->id,
                'digits' => '0047',
                'confidence' => 0.96,
                'flagged_manual' => false,
            ],
        ]);
        Storage::disk('public')->put($photoPath . '.json', $mockOcr);

        $opname->update(['form_photo_path' => $photoPath]);

        $job = new ProcessStockOpnameOcrJob($opname);
        $job->handle();

        $opname->refresh();
        $this->assertEquals('VERIFIED', $opname->status);

        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $opname->id,
            'item_id' => $item->id,
            'system_qty' => 50,
            'counted_qty' => 47,
            'variance' => -3,
            'ocr_confidence' => 0.96,
        ]);

        // 9c. Apply adjustment to inventory
        $inventoryService = app(InventoryService::class);
        $adjustmentMovement = $inventoryService->applyStockOpname($opname);

        $this->assertInstanceOf(StockMovement::class, $adjustmentMovement);
        $this->assertEquals(StockMovementType::ADJUSTMENT, $adjustmentMovement->type);
        $this->assertEquals('APPLIED', $opname->fresh()->status);

        // Assert StockLevel updated from 50 to counted 47
        $this->assertEquals(47, StockLevel::where('location_id', $location->id)->where('item_id', $item->id)->value('qty'));
    }

    /**
     * 10. Correspondence letter numbering generation and archiving
     */
    public function test_flow_10_correspondence_letter_numbering_and_archiving(): void
    {
        $service = app(LetterNumberService::class);
        $bogorLocation = Location::factory()->create(['code' => 'BGR', 'name' => 'Bogor']);
        $nganjukLocation = Location::factory()->create(['code' => 'NGJ', 'name' => 'Nganjuk']);

        // 10a. Automatic number generation with TAI-{branch}/OUT/{roman_month}/{year}
        $currentMonthRoman = $service->toRoman((int) now()->format('n'));
        $currentYear = now()->format('Y');

        $num1 = $service->generateNextNumber('OUT', 'BGR');
        $this->assertEquals("001/TAI-BGR/OUT/{$currentMonthRoman}/{$currentYear}", $num1);

        // 10b. Create letter and archive attached PDF
        $fakeLetterFile = UploadedFile::fake()->create('surat_tugas.pdf', 120, 'application/pdf');
        $storedFilePath = $fakeLetterFile->store('letters', 'public');

        $letter = Letter::create([
            'letter_number' => $num1,
            'direction' => 'OUT',
            'type' => 'SURAT_TUGAS',
            'location_id' => $bogorLocation->id,
            'subject' => 'Surat Tugas Verifikasi Lapangan',
            'date' => now()->toDateString(),
            'file_path' => $storedFilePath,
        ]);

        $this->assertDatabaseHas('letters', [
            'id' => $letter->id,
            'letter_number' => $num1,
            'branch' => 'BGR',
            'direction' => 'OUT',
        ]);
        Storage::disk('public')->assertExists($storedFilePath);

        // 10c. Incremental sequence within same branch
        $num2 = $service->generateNextNumber('OUT', 'BGR');
        $this->assertEquals("002/TAI-BGR/OUT/{$currentMonthRoman}/{$currentYear}", $num2);

        // 10d. Branch sequence isolation (Nganjuk starts at 001 independently)
        $numNganjuk = $service->generateNextNumber('OUT', 'NGJ');
        $this->assertEquals("001/TAI-NGJ/OUT/{$currentMonthRoman}/{$currentYear}", $numNganjuk);
    }

    /**
     * Master End-to-End Operational Lifecycle:
     * Exercises all 10 ERP capabilities sequentially in one unified business workflow.
     */
    public function test_comprehensive_sequential_erp_operational_lifecycle(): void
    {
        // =========================================================================
        // STEP 1: Google SSO Authentication & Role Provisioning
        // =========================================================================
        $adminUser = User::factory()->create([
            'email' => 'direktur@tridhata.com',
            'active' => true,
        ]);
        $adminUser->assignRole('super_admin');

        $googleMock = Mockery::mock('Laravel\Socialite\Two\User');
        $googleMock->shouldReceive('getId')->andReturn('google-director-id');
        $googleMock->shouldReceive('getEmail')->andReturn('direktur@tridhata.com');
        $googleMock->shouldReceive('getName')->andReturn('Direktur Utama');
        $googleMock->shouldReceive('getAvatar')->andReturn('https://lh3.googleusercontent.com/avatar_dir');

        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('user')->andReturn($googleMock);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $authResponse = $this->get('/auth/google/callback');
        $authResponse->assertRedirect('/admin');
        $this->assertAuthenticatedAs($adminUser);

        // =========================================================================
        // STEP 2: Master Data CSV Import & Locations Setup
        // =========================================================================
        $bogor = Location::factory()->create(['code' => 'BGR', 'name' => 'Gudang Pusat Bogor']);
        $nganjuk = Location::factory()->create(['code' => 'NGJ', 'name' => 'Gudang Cabang Nganjuk']);

        $csvService = new CsvImportService();
        $itemsCsv = "sku,name,category,unit,min_stock\nRAW-KOP-LIFECYCLE,Kopi Mentah Super,Bahan Baku,kg,100\nRAW-POUCH-LIFECYCLE,Pouch Kopi Foil,Kemasan,pcs,500";
        $csvService->importItems(UploadedFile::fake()->createWithContent('items.csv', $itemsCsv));

        $productsCsv = "sku,name,unit,selling_price,cogs_price,min_stock\nPROD-KOP-LIFECYCLE,Kopi Premium 250g,pcs,75000,40000,50";
        $csvService->importProducts(UploadedFile::fake()->createWithContent('products.csv', $productsCsv));

        $rawCoffee = Item::where('sku', 'RAW-KOP-LIFECYCLE')->firstOrFail();
        $rawPouch = Item::where('sku', 'RAW-POUCH-LIFECYCLE')->firstOrFail();
        $finishedCoffee = Product::where('sku', 'PROD-KOP-LIFECYCLE')->firstOrFail();

        // =========================================================================
        // STEP 3: Raw Material Intake (StockMovement IN)
        // =========================================================================
        $invService = app(InventoryService::class);
        $intakeMovement = $invService->recordMovement([
            'type' => StockMovementType::IN,
            'location_id' => $bogor->id,
            'date' => now()->toDateString(),
            'notes' => 'Penerimaan stok bahan baku awal',
            'items' => [
                ['item_id' => $rawCoffee->id, 'qty' => 500, 'unit' => 'kg', 'unit_price' => 70000],
                ['item_id' => $rawPouch->id, 'qty' => 1500, 'unit' => 'pcs', 'unit_price' => 2000],
            ],
        ]);
        $this->assertEquals(StockMovementType::IN, $intakeMovement->type);
        $this->assertEquals(500, StockLevel::where('location_id', $bogor->id)->where('item_id', $rawCoffee->id)->value('qty'));
        $this->assertEquals(1500, StockLevel::where('location_id', $bogor->id)->where('item_id', $rawPouch->id)->value('qty'));

        // =========================================================================
        // STEP 4: Purchase Request Submission and 2-Step Approval
        // =========================================================================
        $financeUser = User::factory()->create();
        $financeUser->assignRole('finance');
        $directorUser = User::factory()->create();
        $directorUser->assignRole('director');

        $approvalService = app(ApprovalService::class);
        $pr = $approvalService->submitRequest([
            'location_id' => $bogor->id,
            'type' => 'RAW_MATERIAL',
            'title' => 'Pengadaan Bahan Tambahan Panen',
            'items' => [
                ['item_id' => $rawCoffee->id, 'qty' => 100, 'estimated_price' => 70000, 'total_price' => 7000000],
            ],
        ], $adminUser);

        $this->assertEquals('PENDING', $pr->status);
        $this->assertEquals(1, $pr->current_approval_step);

        $approvalService->processDecision($pr, $financeUser, 1, 'APPROVED', 'Disetujui finance');
        $pr->refresh();
        $this->assertEquals('PENDING', $pr->status);
        $this->assertEquals(2, $pr->current_approval_step);

        $approvalService->processDecision($pr, $directorUser, 2, 'APPROVED', 'Disetujui direktur');
        $pr->refresh();
        $this->assertEquals('APPROVED', $pr->status);

        // =========================================================================
        // STEP 5: Production Execution via BOM Recipe (Auto-deduction)
        // =========================================================================
        $bom = Bom::create([
            'product_id' => $finishedCoffee->id,
            'code' => 'BOM-LIFECYCLE-01',
            'name' => 'Resep Kopi Premium 250g',
            'batch_size' => 10,
            'yield_unit' => 'pcs',
            'is_active' => true,
        ]);
        BomItem::create(['bom_id' => $bom->id, 'item_id' => $rawCoffee->id, 'quantity' => 2.5, 'unit' => 'kg']);
        BomItem::create(['bom_id' => $bom->id, 'item_id' => $rawPouch->id, 'quantity' => 10, 'unit' => 'pcs']);

        $prodService = app(ProductionService::class);
        // Produce 200 units (20 batches -> requires 50kg raw coffee, 200 pouches)
        $prodLog = $prodService->recordProduction([
            'location_id' => $bogor->id,
            'product_id' => $finishedCoffee->id,
            'produced_qty' => 200,
            'reject_qty' => 0,
        ]);
        $this->assertEquals(200, $prodLog->actual_qty);
        $this->assertEquals(450, StockLevel::where('location_id', $bogor->id)->where('item_id', $rawCoffee->id)->value('qty'));
        $this->assertEquals(1300, StockLevel::where('location_id', $bogor->id)->where('item_id', $rawPouch->id)->value('qty'));
        $this->assertEquals(200, StockLevel::where('location_id', $bogor->id)->where('product_id', $finishedCoffee->id)->value('qty'));

        // =========================================================================
        // STEP 6: Inter-Warehouse Transfer & Surat Jalan PDF
        // =========================================================================
        // Transfer 80 units from Bogor to Nganjuk
        $transfer = $invService->transferBetweenWarehouses($bogor->id, $nganjuk->id, [
            ['product_id' => $finishedCoffee->id, 'qty' => 80, 'unit' => 'pcs'],
        ], 'Transfer stok ke cabang Nganjuk');

        $this->assertEquals(120, StockLevel::where('location_id', $bogor->id)->where('product_id', $finishedCoffee->id)->value('qty'));
        $this->assertEquals(80, StockLevel::where('location_id', $nganjuk->id)->where('product_id', $finishedCoffee->id)->value('qty'));

        $sjPdf = $invService->generateSuratJalanPdf($transfer);
        Storage::disk('public')->assertExists($sjPdf);

        // =========================================================================
        // STEP 7: Sales Order, Invoice PDF, & QR Code Label
        // =========================================================================
        $so = SalesOrder::factory()->create([
            'so_number' => 'SO-LIFECYCLE-001',
            'customer_name' => 'Retailer Jawa Timur',
            'location_id' => $nganjuk->id,
            'date' => now()->toDateString(),
            'status' => 'CONFIRMED',
            'total_amount' => 2250000,
        ]);
        SalesOrderItem::create([
            'sales_order_id' => $so->id,
            'product_id' => $finishedCoffee->id,
            'qty' => 30,
            'price' => 75000,
            'total' => 2250000,
        ]);

        $docPdfService = app(DocumentPdfService::class);
        $invPdf = $docPdfService->generateInvoicePdf($so);
        $soPdf = $docPdfService->generateSalesOrderPdf($so);
        $qrPdf = $docPdfService->generateQrLabelPdf($finishedCoffee);

        Storage::disk('public')->assertExists($invPdf);
        Storage::disk('public')->assertExists($soPdf);
        Storage::disk('public')->assertExists($qrPdf);

        // =========================================================================
        // STEP 8: Mobile Attendance Stamping with GPS & Timestamp Watermark
        // =========================================================================
        $wmService = app(WatermarkService::class);
        $attPhoto = UploadedFile::fake()->image('staff_checkin.jpg', 640, 480);
        $wibNow = Carbon::now()->setTimezone('Asia/Jakarta');
        $lat = -7.604473;
        $lng = 111.904533; // Nganjuk coords

        $stampedPhoto = $wmService->stampAttendancePhoto($attPhoto, $lat, $lng, $wibNow);
        Storage::disk('public')->assertExists($stampedPhoto);

        $attendance = Attendance::create([
            'user_id' => $adminUser->id,
            'location_id' => $nganjuk->id,
            'type' => 'CLOCK_IN',
            'timestamp' => $wibNow,
            'latitude' => $lat,
            'longitude' => $lng,
            'maps_url' => "https://maps.google.com/?q={$lat},{$lng}",
            'photo_path' => $stampedPhoto,
            'is_verified' => true,
        ]);
        $this->assertDatabaseHas('attendances', ['id' => $attendance->id, 'type' => 'CLOCK_IN']);

        // =========================================================================
        // STEP 9: Stock Opname Template, OCR Processing, & Inventory Adjustment
        // =========================================================================
        // Current Bogor stock of rawCoffee was 450 kg
        $opname = StockOpname::create([
            'code' => 'SO-LIFECYCLE-001',
            'location_id' => $bogor->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'created_by' => $adminUser->id,
        ]);

        // Printable template PDF
        $templateView = view('pdf.stock-opname-template', [
            'opname' => $opname->load(['location', 'creator']),
        ])->render();
        $this->assertStringContainsString('corner-marker top-left', $templateView);

        // Upload scanned form with counted quantity: 445 kg (variance -5)
        $formPhoto = 'opnames/lifecycle_form.jpg';
        Storage::disk('public')->put($formPhoto, 'image-data');
        $opnameMockData = json_encode([
            [
                'row' => 1,
                'item_id' => $rawCoffee->id,
                'digits' => '0445',
                'confidence' => 0.98,
                'flagged_manual' => false,
            ],
        ]);
        Storage::disk('public')->put($formPhoto . '.json', $opnameMockData);

        $opname->update(['form_photo_path' => $formPhoto]);
        $ocrJob = new ProcessStockOpnameOcrJob($opname);
        $ocrJob->handle();

        $opname->refresh();
        $this->assertEquals('VERIFIED', $opname->status);

        // Apply opname adjustment
        $adjMovement = $invService->applyStockOpname($opname);
        $this->assertEquals(StockMovementType::ADJUSTMENT, $adjMovement->type);
        $this->assertEquals('APPLIED', $opname->fresh()->status);
        // Stock in Bogor updated from 450 to 445
        $this->assertEquals(445, StockLevel::where('location_id', $bogor->id)->where('item_id', $rawCoffee->id)->value('qty'));

        // =========================================================================
        // STEP 10: Correspondence Letter Numbering & Archive
        // =========================================================================
        $letterService = app(LetterNumberService::class);
        $letterNo = $letterService->generateNextNumber('OUT', 'NGJ');
        $monthRoman = $letterService->toRoman((int) now()->format('n'));
        $this->assertEquals("001/TAI-NGJ/OUT/{$monthRoman}/" . now()->format('Y'), $letterNo);

        $letterDoc = UploadedFile::fake()->create('surat_pengiriman.pdf', 80, 'application/pdf');
        $archivedPath = $letterDoc->store('letters', 'public');

        $letter = Letter::create([
            'letter_number' => $letterNo,
            'direction' => 'OUT',
            'type' => 'SURAT_PENAWARAN',
            'location_id' => $nganjuk->id,
            'subject' => 'Penawaran Kopi Premium ke Distributor',
            'date' => now()->toDateString(),
            'file_path' => $archivedPath,
            'created_by' => $adminUser->id,
        ]);

        $this->assertDatabaseHas('letters', [
            'id' => $letter->id,
            'letter_number' => $letterNo,
            'branch' => 'NGJ',
        ]);
        Storage::disk('public')->assertExists($archivedPath);
    }
}
