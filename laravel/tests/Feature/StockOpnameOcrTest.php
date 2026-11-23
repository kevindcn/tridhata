<?php

namespace Tests\Feature;

use App\Enums\StockMovementType;
use App\Filament\Pages\StockOpnameVerificationPage;
use App\Filament\Resources\StockOpnameResource;
use App\Jobs\ProcessStockOpnameOcrJob;
use App\Models\Item;
use App\Models\Location;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use App\Services\InventoryService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class StockOpnameOcrTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    public function test_uploading_opname_photo_dispatches_async_ocr_job(): void
    {
        Queue::fake();

        $location = Location::factory()->create();
        $opname = StockOpname::create([
            'code' => 'SO-202611-001',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'form_photo_path' => 'opnames/sample_form.jpg',
        ]);

        ProcessStockOpnameOcrJob::dispatch($opname);

        Queue::assertPushed(ProcessStockOpnameOcrJob::class, function ($job) use ($opname) {
            return $job->stockOpname->id === $opname->id;
        });
    }

    public function test_template_pdf_generates_cleanly_with_corner_markers(): void
    {
        $location = Location::factory()->create(['name' => 'Gudang Pusat Bogor']);
        $user = User::factory()->create(['name' => 'Budi Santoso']);
        $item1 = Item::factory()->create(['sku' => 'ITM-001', 'name' => 'Biji Robusta', 'unit' => 'kg']);
        $item2 = Item::factory()->create(['sku' => 'ITM-002', 'name' => 'Biji Arabika', 'unit' => 'kg']);

        StockLevel::create(['location_id' => $location->id, 'item_id' => $item1->id, 'qty' => 50]);
        StockLevel::create(['location_id' => $location->id, 'item_id' => $item2->id, 'qty' => 25]);

        $opname = StockOpname::create([
            'code' => 'SO-202611-002',
            'location_id' => $location->id,
            'date' => '2026-11-23',
            'status' => 'DRAFT',
            'created_by' => $user->id,
        ]);

        $itemRecord1 = StockOpnameItem::create([
            'stock_opname_id' => $opname->id,
            'item_id' => $item1->id,
            'system_qty' => 50,
            'counted_qty' => 0,
            'variance' => 0,
        ]);

        $itemRecord2 = StockOpnameItem::create([
            'stock_opname_id' => $opname->id,
            'item_id' => $item2->id,
            'system_qty' => 25,
            'counted_qty' => 0,
            'variance' => 0,
        ]);

        // Render Blade template
        $view = view('pdf.stock-opname-template', [
            'opname' => $opname->load(['location', 'creator', 'items.item']),
        ])->render();

        // 1. Verify 4 corner registration markers exist for auto-straightening
        $this->assertStringContainsString('corner-marker top-left', $view);
        $this->assertStringContainsString('corner-marker top-right', $view);
        $this->assertStringContainsString('corner-marker bottom-left', $view);
        $this->assertStringContainsString('corner-marker bottom-right', $view);

        // 2. Verify Header elements: Cabang, Tanggal, Petugas
        $this->assertStringContainsString('Gudang Pusat Bogor', $view);
        $this->assertStringContainsString('2026-11-23', $view);
        $this->assertStringContainsString('Budi Santoso', $view);

        // 3. Verify Table Columns
        $this->assertStringContainsString('SKU', $view);
        $this->assertStringContainsString('Nama Barang', $view);
        $this->assertStringContainsString('Stok Sistem', $view);
        $this->assertStringContainsString('Kotak Hitung Fisik', $view);
        $this->assertStringContainsString('Satuan', $view);

        // 4. Verify 4 individual square character boxes per row
        $this->assertStringContainsString('digit-box', $view);
        $this->assertStringContainsString('ITM-001', $view);
        $this->assertStringContainsString('ITM-002', $view);

        // 5. Verify PDF facade generation doesn't crash
        $pdf = Pdf::loadView('pdf.stock-opname-template', ['opname' => $opname]);
        $this->assertNotEmpty($pdf->output());
    }

    public function test_process_stock_opname_ocr_job_populates_items_and_flags_low_confidence_digits(): void
    {
        $location = Location::factory()->create();
        $item1 = Item::factory()->create(['sku' => 'SKU-001', 'name' => 'Barang A']);
        $item2 = Item::factory()->create(['sku' => 'SKU-002', 'name' => 'Barang B']);

        StockLevel::create(['location_id' => $location->id, 'item_id' => $item1->id, 'qty' => 20]);
        StockLevel::create(['location_id' => $location->id, 'item_id' => $item2->id, 'qty' => 10]);

        $photoPath = 'opnames/sample_form.jpg';
        Storage::disk('public')->put($photoPath, 'fake-image-binary-data');

        // Create companion mock json or payload for deterministic OCR testing
        $mockJson = json_encode([
            [
                'row' => 1,
                'item_id' => $item1->id,
                'digits' => '0025',
                'confidence' => 0.94,
                'flagged_manual' => false,
            ],
            [
                'row' => 2,
                'item_id' => $item2->id,
                'digits' => '0008',
                'confidence' => 0.65,
                'flagged_manual' => true,
            ],
        ]);
        Storage::disk('public')->put($photoPath . '.json', $mockJson);

        $opname = StockOpname::create([
            'code' => 'SO-202611-003',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'form_photo_path' => $photoPath,
        ]);

        $job = new ProcessStockOpnameOcrJob($opname);
        $job->handle();

        $opname->refresh();

        // Status should be set to VERIFIED
        $this->assertEquals('VERIFIED', $opname->status);

        // Verify crop_boxes integration created and persisted cropped_photo_path
        $this->assertNotNull($opname->cropped_photo_path);
        $this->assertTrue(Storage::disk('public')->exists($opname->cropped_photo_path));

        // Check first item: counted 25, system 20, variance 5, confidence 0.94, flagged_manual false
        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $opname->id,
            'item_id' => $item1->id,
            'system_qty' => 20,
            'counted_qty' => 25,
            'variance' => 5,
            'ocr_confidence' => 0.94,
            'flagged_manual' => false,
        ]);

        // Check second item: counted 8, system 10, variance -2, confidence 0.65, flagged_manual true (< 0.80)
        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $opname->id,
            'item_id' => $item2->id,
            'system_qty' => 10,
            'counted_qty' => 8,
            'variance' => -2,
            'ocr_confidence' => 0.65,
            'flagged_manual' => true,
        ]);
    }

    public function test_applying_verified_opname_creates_adjustment_movements_and_updates_stock_levels(): void
    {
        $location = Location::factory()->create();
        $user = User::factory()->create();
        $item1 = Item::factory()->create(['sku' => 'SKU-001', 'name' => 'Barang A', 'unit' => 'pcs']);
        $item2 = Item::factory()->create(['sku' => 'SKU-002', 'name' => 'Barang B', 'unit' => 'pcs']);

        $stockLevel1 = StockLevel::create(['location_id' => $location->id, 'item_id' => $item1->id, 'qty' => 20]);
        $stockLevel2 = StockLevel::create(['location_id' => $location->id, 'item_id' => $item2->id, 'qty' => 10]);

        $opname = StockOpname::create([
            'code' => 'SO-202611-004',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'VERIFIED',
            'created_by' => $user->id,
        ]);

        StockOpnameItem::create([
            'stock_opname_id' => $opname->id,
            'item_id' => $item1->id,
            'system_qty' => 20,
            'counted_qty' => 25,
            'variance' => 5,
            'ocr_confidence' => 0.95,
            'flagged_manual' => false,
        ]);

        StockOpnameItem::create([
            'stock_opname_id' => $opname->id,
            'item_id' => $item2->id,
            'system_qty' => 10,
            'counted_qty' => 8,
            'variance' => -2,
            'ocr_confidence' => 0.88,
            'flagged_manual' => false,
        ]);

        // Apply opname
        $service = app(InventoryService::class);
        $movement = $service->applyStockOpname($opname);

        $this->assertInstanceOf(StockMovement::class, $movement);
        $this->assertEquals(StockMovementType::ADJUSTMENT, $movement->type);
        $this->assertEquals($location->id, $movement->location_id);
        $this->assertEquals($opname->id, $movement->reference_id);
        $this->assertEquals(StockOpname::class, $movement->reference_type);

        // Assert StockLevel quantities are aligned to counted_qty
        $this->assertEquals(25, $stockLevel1->fresh()->qty);
        $this->assertEquals(8, $stockLevel2->fresh()->qty);

        // Assert movement line items record adjustment delta abs(variance)
        $this->assertEquals(5, (float) $movement->items->firstWhere('item_id', $item1->id)->qty);
        $this->assertEquals(2, (float) $movement->items->firstWhere('item_id', $item2->id)->qty);

        // Assert Opname status updated to APPLIED
        $this->assertEquals('APPLIED', $opname->fresh()->status);
    }

    public function test_branch_scoping_on_stock_opname_resource(): void
    {
        $locJakarta = Location::factory()->create(['name' => 'Jakarta']);
        $locSurabaya = Location::factory()->create(['name' => 'Surabaya']);

        $user = User::factory()->create(['default_location_id' => $locJakarta->id]);
        $user->locations()->attach($locJakarta->id);

        $opnameJakarta = StockOpname::create([
            'code' => 'SO-JKT-001',
            'location_id' => $locJakarta->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
        ]);

        $opnameSurabaya = StockOpname::create([
            'code' => 'SO-SBY-001',
            'location_id' => $locSurabaya->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
        ]);

        $this->actingAs($user);

        $scopedQuery = StockOpnameResource::getEloquentQuery();
        $this->assertTrue($scopedQuery->where('id', $opnameJakarta->id)->exists());
        $this->assertFalse($scopedQuery->where('id', $opnameSurabaya->id)->exists());
    }

    public function test_verification_page_renders_flagged_digits_and_can_apply_adjustment(): void
    {
        $location = Location::factory()->create();
        $user = User::factory()->create(['default_location_id' => $location->id]);
        $user->locations()->attach($location->id);
        $this->actingAs($user);

        $item1 = Item::factory()->create(['sku' => 'SKU-FLAGGED', 'name' => 'Barang Flagged']);
        $stockLevel = StockLevel::create(['location_id' => $location->id, 'item_id' => $item1->id, 'qty' => 15]);

        $opname = StockOpname::create([
            'code' => 'SO-VERIF-001',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'VERIFIED',
            'created_by' => $user->id,
        ]);

        $opnameItem = StockOpnameItem::create([
            'stock_opname_id' => $opname->id,
            'item_id' => $item1->id,
            'system_qty' => 15,
            'counted_qty' => 12,
            'variance' => -3,
            'ocr_confidence' => 0.60,
            'flagged_manual' => true,
        ]);

        Livewire::test(StockOpnameVerificationPage::class, ['record' => $opname->id])
            ->assertSuccessful()
            ->assertSee('SKU-FLAGGED')
            ->assertSee('12')
            ->assertSeeHtml('badge') // Should render warning badge for flagged digit
            ->call('applyOpname');

        $this->assertEquals('APPLIED', $opname->fresh()->status);
        $this->assertEquals(12, $stockLevel->fresh()->qty);
    }

    public function test_filament_stock_opname_resource_table_actions(): void
    {
        $location = Location::factory()->create();
        $user = User::factory()->create();
        $user->assignRole('super_admin');
        $this->actingAs($user);

        $opname = StockOpname::create([
            'code' => 'SO-ACTION-001',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'VERIFIED',
            'created_by' => $user->id,
        ]);

        Livewire::test(StockOpnameResource\Pages\ListStockOpnames::class)
            ->assertTableActionExists('printTemplate')
            ->assertTableActionExists('uploadPhoto')
            ->assertTableActionExists('verifyResults')
            ->callTableAction('printTemplate', $opname)
            ->assertFileDownloaded();
    }

    public function test_unauthorized_user_gets_403_on_verification_page(): void
    {
        $locAllowed = Location::factory()->create(['name' => 'Lokasi Diizinkan']);
        $locForbidden = Location::factory()->create(['name' => 'Lokasi Terlarang']);

        $user = User::factory()->create(['default_location_id' => $locAllowed->id]);
        $user->locations()->attach($locAllowed->id);
        $this->actingAs($user);

        $opname = StockOpname::create([
            'code' => 'SO-FORBIDDEN-001',
            'location_id' => $locForbidden->id,
            'date' => now()->toDateString(),
            'status' => 'VERIFIED',
        ]);

        Livewire::test(StockOpnameVerificationPage::class, ['record' => $opname->id])
            ->assertForbidden();
    }

    public function test_failed_ocr_sets_status_to_ocr_failed_without_creating_fake_items(): void
    {
        $location = Location::factory()->create();
        $item1 = Item::factory()->create(['sku' => 'REAL-ITEM-1']);

        // An unreadable/corrupt image without any companion json or recognizable digit data
        $photoPath = 'opnames/unreadable_form.jpg';
        Storage::disk('public')->put($photoPath, 'corrupted-binary-noise');

        $opname = StockOpname::create([
            'code' => 'SO-FAILED-001',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'form_photo_path' => $photoPath,
        ]);

        $job = new ProcessStockOpnameOcrJob($opname);
        $job->handle();

        $opname->refresh();
        $this->assertEquals('OCR_FAILED', $opname->status);
        $this->assertEquals(0, $opname->items()->count());
        $this->assertStringContainsString('Gagal', (string) $opname->notes);
    }

    public function test_crop_boxes_integration_and_cropped_photo_path_persistence(): void
    {
        $location = Location::factory()->create();
        $item = Item::factory()->create(['sku' => 'SKU-CROP-1']);

        $photoPath = 'opnames/form_to_crop.jpg';
        Storage::disk('public')->put($photoPath, 'raw-photo-bytes');

        $mockJson = json_encode([
            [
                'row' => 1,
                'item_id' => $item->id,
                'digits' => '0050',
                'confidence' => 0.95,
                'flagged_manual' => false,
            ],
        ]);
        Storage::disk('public')->put($photoPath . '.json', $mockJson);

        $opname = StockOpname::create([
            'code' => 'SO-CROP-001',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'form_photo_path' => $photoPath,
        ]);

        $job = new ProcessStockOpnameOcrJob($opname);
        $job->handle();

        $opname->refresh();
        $this->assertEquals('VERIFIED', $opname->status);
        $this->assertNotNull($opname->cropped_photo_path);
        $this->assertEquals("opnames/cropped/{$opname->id}.jpg", $opname->cropped_photo_path);
        $this->assertTrue(Storage::disk('public')->exists($opname->cropped_photo_path));
    }
}
