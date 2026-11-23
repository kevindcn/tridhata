<?php

namespace Tests\Feature;

use App\Enums\StockMovementType;
use App\Filament\Resources\StockMovementResource;
use App\Models\Item;
use App\Models\Location;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\InventoryService;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

class InventoryMovementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_goods_in_increments_stock_level(): void
    {
        $location = Location::factory()->create(['code' => 'BOGOR', 'name' => 'Gudang Bogor']);
        $item = Item::factory()->create(['sku' => 'RAW-001', 'name' => 'Biji Kopi Mentah']);
        $service = app(InventoryService::class);

        $movement = $service->recordMovement([
            'type' => StockMovementType::IN,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'notes' => 'Penerimaan bahan baku',
            'items' => [
                ['item_id' => $item->id, 'qty' => 100, 'unit' => 'kg', 'unit_price' => 25000]
            ]
        ]);

        $this->assertInstanceOf(StockMovement::class, $movement);
        $this->assertEquals(StockMovementType::IN, $movement->type);

        $this->assertDatabaseHas('stock_levels', [
            'item_id' => $item->id,
            'location_id' => $location->id,
            'qty' => 100,
        ]);

        $this->assertDatabaseHas('stock_movement_items', [
            'movement_id' => $movement->id,
            'item_id' => $item->id,
            'qty' => 100,
            'unit' => 'kg',
        ]);
    }

    public function test_goods_out_decrements_stock_level(): void
    {
        $location = Location::factory()->create(['code' => 'BOGOR']);
        $item = Item::factory()->create(['sku' => 'RAW-002']);

        StockLevel::create([
            'item_id' => $item->id,
            'location_id' => $location->id,
            'qty' => 150,
            'min_stock' => 10,
        ]);

        $service = app(InventoryService::class);
        $movement = $service->recordMovement([
            'type' => StockMovementType::OUT,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'items' => [
                ['item_id' => $item->id, 'qty' => 50, 'unit' => 'kg']
            ]
        ]);

        $this->assertDatabaseHas('stock_levels', [
            'item_id' => $item->id,
            'location_id' => $location->id,
            'qty' => 100,
        ]);
    }

    public function test_goods_out_fails_on_insufficient_stock(): void
    {
        $location = Location::factory()->create(['code' => 'BOGOR']);
        $item = Item::factory()->create(['sku' => 'RAW-003']);

        StockLevel::create([
            'item_id' => $item->id,
            'location_id' => $location->id,
            'qty' => 30,
            'min_stock' => 10,
        ]);

        $service = app(InventoryService::class);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/Insufficient stock/i');

        $service->recordMovement([
            'type' => StockMovementType::OUT,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'items' => [
                ['item_id' => $item->id, 'qty' => 50, 'unit' => 'kg']
            ]
        ]);
    }

    public function test_inter_warehouse_transfer_deducts_source_and_increments_destination(): void
    {
        $bogor = Location::factory()->create(['code' => 'BOGOR', 'name' => 'Gudang Bogor']);
        $nganjuk = Location::factory()->create(['code' => 'NGANJUK', 'name' => 'Gudang Nganjuk']);
        $item = Item::factory()->create(['sku' => 'RAW-TRF']);

        StockLevel::create([
            'item_id' => $item->id,
            'location_id' => $bogor->id,
            'qty' => 50,
            'min_stock' => 5,
        ]);

        $service = app(InventoryService::class);
        $movement = $service->transferBetweenWarehouses($bogor->id, $nganjuk->id, [
            ['item_id' => $item->id, 'qty' => 20, 'unit' => 'kg']
        ], 'Transfer Bogor ke Nganjuk');

        $this->assertEquals(30, StockLevel::where('item_id', $item->id)->where('location_id', $bogor->id)->value('qty'));
        $this->assertEquals(20, StockLevel::where('item_id', $item->id)->where('location_id', $nganjuk->id)->value('qty'));
        $this->assertEquals(StockMovementType::TRANSFER, $movement->type);
        $this->assertEquals($bogor->id, $movement->location_id);
        $this->assertEquals($nganjuk->id, $movement->target_location_id);
    }

    public function test_inter_warehouse_transfer_fails_when_source_insufficient(): void
    {
        $bogor = Location::factory()->create(['code' => 'BOGOR']);
        $nganjuk = Location::factory()->create(['code' => 'NGANJUK']);
        $item = Item::factory()->create();

        StockLevel::create([
            'item_id' => $item->id,
            'location_id' => $bogor->id,
            'qty' => 10,
        ]);

        $service = app(InventoryService::class);

        $this->expectException(\InvalidArgumentException::class);
        $service->transferBetweenWarehouses($bogor->id, $nganjuk->id, [
            ['item_id' => $item->id, 'qty' => 25, 'unit' => 'kg']
        ]);
    }

    public function test_return_increments_and_reject_decrements(): void
    {
        $location = Location::factory()->create(['code' => 'BOGOR']);
        $item = Item::factory()->create();

        StockLevel::create([
            'item_id' => $item->id,
            'location_id' => $location->id,
            'qty' => 40,
        ]);

        $service = app(InventoryService::class);

        // Return from customer / production: increments stock
        $service->recordMovement([
            'type' => StockMovementType::RETURN,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'items' => [
                ['item_id' => $item->id, 'qty' => 10, 'unit' => 'kg']
            ]
        ]);
        $this->assertEquals(50, StockLevel::where('item_id', $item->id)->where('location_id', $location->id)->value('qty'));

        // Reject: decrements stock
        $service->recordMovement([
            'type' => StockMovementType::REJECT,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'items' => [
                ['item_id' => $item->id, 'qty' => 15, 'unit' => 'kg']
            ]
        ]);
        $this->assertEquals(35, StockLevel::where('item_id', $item->id)->where('location_id', $location->id)->value('qty'));
    }

    public function test_movement_creates_spatie_activity_log(): void
    {
        $user = User::factory()->create(['email' => 'warehouse@tridhata.com']);
        $this->actingAs($user);

        $location = Location::factory()->create(['code' => 'BOGOR']);
        $item = Item::factory()->create();
        $service = app(InventoryService::class);

        $movement = $service->recordMovement([
            'type' => StockMovementType::IN,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'items' => [
                ['item_id' => $item->id, 'qty' => 50, 'unit' => 'kg']
            ]
        ]);

        $activity = Activity::where('subject_type', StockMovement::class)
            ->where('subject_id', $movement->id)
            ->first();

        $this->assertNotNull($activity);
        $this->assertEquals($user->id, $activity->causer_id);
    }

    public function test_surat_jalan_pdf_generation_stores_file_on_server_disk(): void
    {
        $bogor = Location::factory()->create(['code' => 'BOGOR', 'name' => 'Gudang Bogor', 'address' => 'Jl. Raya Bogor']);
        $nganjuk = Location::factory()->create(['code' => 'NGANJUK', 'name' => 'Gudang Nganjuk', 'address' => 'Jl. Raya Nganjuk']);
        $item = Item::factory()->create(['sku' => 'RAW-KOP', 'name' => 'Kopi Arabika']);

        StockLevel::create([
            'item_id' => $item->id,
            'location_id' => $bogor->id,
            'qty' => 100,
        ]);

        $service = app(InventoryService::class);
        $movement = $service->transferBetweenWarehouses($bogor->id, $nganjuk->id, [
            ['item_id' => $item->id, 'qty' => 40, 'unit' => 'kg']
        ], 'Kirim stok ke pabrik Nganjuk');

        $pdfPath = $service->generateSuratJalanPdf($movement);

        $this->assertNotEmpty($pdfPath);
        $this->assertEquals("surat-jalan/{$movement->code}.pdf", $pdfPath);
        Storage::disk('public')->assertExists($pdfPath);
    }

    public function test_low_stock_alert_detection(): void
    {
        $location = Location::factory()->create(['code' => 'BOGOR']);
        $itemNormal = Item::factory()->create(['name' => 'Aman']);
        $itemLow = Item::factory()->create(['name' => 'Menipis']);
        $itemOut = Item::factory()->create(['name' => 'Habis']);

        // Normal: qty 100, min 20 -> not alert
        StockLevel::create([
            'item_id' => $itemNormal->id,
            'location_id' => $location->id,
            'qty' => 100,
            'min_stock' => 20,
        ]);

        // Low: qty 15, min 20 -> alert!
        $levelLow = StockLevel::create([
            'item_id' => $itemLow->id,
            'location_id' => $location->id,
            'qty' => 15,
            'min_stock' => 20,
        ]);

        // Out: qty 0, min 10 -> alert!
        $levelOut = StockLevel::create([
            'item_id' => $itemOut->id,
            'location_id' => $location->id,
            'qty' => 0,
            'min_stock' => 10,
        ]);

        $service = app(InventoryService::class);
        $alerts = $service->getLowStockAlerts($location->id);

        $this->assertCount(2, $alerts);
        $alertItemIds = $alerts->pluck('item_id')->all();
        $this->assertContains($itemLow->id, $alertItemIds);
        $this->assertContains($itemOut->id, $alertItemIds);
        $this->assertNotContains($itemNormal->id, $alertItemIds);
    }

    public function test_filament_stock_movement_resource_loads(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@tridhata.com',
            'active' => true,
        ]);
        $location = Location::factory()->create(['code' => 'BOGOR']);
        $user->locations()->attach($location);

        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $this->actingAs($user)
            ->get(StockMovementResource::getUrl('index'))
            ->assertSuccessful();

        $this->actingAs($user)
            ->get(StockMovementResource::getUrl('create'))
            ->assertSuccessful();
    }

    public function test_can_create_stock_movement_via_filament(): void
    {
        $user = User::factory()->create(['email' => 'creator@tridhata.com', 'active' => true]);
        $location = Location::factory()->create(['code' => 'BOGOR']);
        $item = Item::factory()->create(['sku' => 'TEST-01']);

        $this->actingAs($user);

        \Livewire\Livewire::test(StockMovementResource\Pages\CreateStockMovement::class)
            ->fillForm([
                'type' => StockMovementType::IN->value,
                'location_id' => $location->id,
                'date' => now()->toDateString(),
                'items' => [
                    [
                        'item_id' => $item->id,
                        'qty' => 75,
                        'unit' => 'kg',
                        'unit_price' => 1000,
                    ]
                ],
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('stock_levels', [
            'item_id' => $item->id,
            'location_id' => $location->id,
            'qty' => 75,
        ]);
    }
}
