<?php

namespace Tests\Feature;

use App\Filament\Resources\BomResource;
use App\Filament\Resources\ProductionScheduleResource;
use App\Models\Bom;
use App\Models\BomItem;
use App\Models\Item;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductionLog;
use App\Models\ProductionSchedule;
use App\Models\ProductionTeam;
use App\Models\StockLevel;
use App\Models\User;
use App\Services\ProductionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BomProductionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'kepala_cabang', 'guard_name' => 'web']);
    }

    public function test_logging_production_deducts_raw_materials_based_on_bom(): void
    {
        $location = Location::factory()->create();
        $product = Product::factory()->create(['sku' => 'PROD-01']);
        $rawMaterial = Item::factory()->create(['sku' => 'RAW-01', 'name' => 'Bahan Baku Kimia']);

        StockLevel::create(['item_id' => $rawMaterial->id, 'location_id' => $location->id, 'qty' => 500]);

        $bom = Bom::create([
            'product_id' => $product->id,
            'code' => 'BOM-PROD-01',
            'name' => 'Resep Standar',
            'batch_size' => 10, // 10 units finished goods
            'yield_unit' => 'pcs',
            'is_active' => true,
        ]);
        BomItem::create([
            'bom_id' => $bom->id,
            'item_id' => $rawMaterial->id,
            'quantity' => 50, // 50kg per 10 units = 5kg per unit
            'unit' => 'kg',
        ]);

        $user = User::factory()->create();

        $service = app(ProductionService::class);
        $log = $service->recordProduction([
            'location_id' => $location->id,
            'product_id' => $product->id,
            'bom_id' => $bom->id,
            'produced_qty' => 20, // 20 units produced -> requires 100kg raw material
            'reject_qty' => 1,
            'date' => now()->toDateString(),
            'notes' => 'Produksi batch pagi',
            'created_by' => $user->id,
        ]);

        // Check raw material deducted: 500 - 100 = 400
        $this->assertEquals(400, StockLevel::where('item_id', $rawMaterial->id)->where('location_id', $location->id)->value('qty'));
        // Check finished goods added: 20
        $this->assertEquals(20, StockLevel::where('product_id', $product->id)->where('location_id', $location->id)->value('qty'));

        // Check production log created
        $this->assertDatabaseHas('production_logs', [
            'id' => $log->id,
            'product_id' => $product->id,
            'actual_qty' => 20,
            'reject_qty' => 1,
        ]);

        // Check Spatie Activity log recorded
        $this->assertDatabaseHas('activity_log', [
            'log_name' => 'production',
            'subject_id' => $log->id,
        ]);
    }

    public function test_insufficient_raw_material_triggers_indonesian_exception(): void
    {
        $location = Location::factory()->create();
        $product = Product::factory()->create(['sku' => 'PROD-02']);
        $rawMaterial = Item::factory()->create(['sku' => 'RAW-02', 'name' => 'Pupuk Dasar']);

        // Only 30kg available
        StockLevel::create(['item_id' => $rawMaterial->id, 'location_id' => $location->id, 'qty' => 30]);

        $bom = Bom::create([
            'product_id' => $product->id,
            'code' => 'BOM-PROD-02',
            'name' => 'Resep Khusus',
            'batch_size' => 10,
            'yield_unit' => 'pcs',
            'is_active' => true,
        ]);
        BomItem::create([
            'bom_id' => $bom->id,
            'item_id' => $rawMaterial->id,
            'quantity' => 50, // requires 50kg for 10 units
            'unit' => 'kg',
        ]);

        $service = app(ProductionService::class);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/stok bahan baku tidak mencukupi untuk/i');

        try {
            $service->recordProduction([
                'location_id' => $location->id,
                'product_id' => $product->id,
                'bom_id' => $bom->id,
                'produced_qty' => 10,
                'date' => now()->toDateString(),
            ]);
        } finally {
            // Ensure stock level was not changed due to rollback
            $this->assertEquals(30, StockLevel::where('item_id', $rawMaterial->id)->where('location_id', $location->id)->value('qty'));
            $this->assertDatabaseCount('production_logs', 0);
        }
    }

    public function test_calculate_material_requirements(): void
    {
        $product = Product::factory()->create(['sku' => 'PROD-03']);
        $rawMaterial1 = Item::factory()->create(['sku' => 'RAW-A', 'name' => 'Bahan A']);
        $rawMaterial2 = Item::factory()->create(['sku' => 'RAW-B', 'name' => 'Bahan B']);

        $bom = Bom::create([
            'product_id' => $product->id,
            'code' => 'BOM-PROD-03',
            'name' => 'Resep 03',
            'batch_size' => 10,
            'is_active' => true,
        ]);

        BomItem::create(['bom_id' => $bom->id, 'item_id' => $rawMaterial1->id, 'quantity' => 20, 'unit' => 'kg']);
        BomItem::create(['bom_id' => $bom->id, 'item_id' => $rawMaterial2->id, 'quantity' => 5, 'unit' => 'liter']);

        $service = app(ProductionService::class);
        $requirements = $service->calculateMaterialRequirements($product, 25, $bom);

        $this->assertCount(2, $requirements);

        $req1 = $requirements->firstWhere('item_id', $rawMaterial1->id);
        $req2 = $requirements->firstWhere('item_id', $rawMaterial2->id);

        $this->assertNotNull($req1);
        $this->assertNotNull($req2);

        // 25 / 10 * 20 = 50 kg
        $this->assertEquals(50.0, (float) $req1['required_qty']);
        $this->assertEquals('kg', $req1['unit']);

        // 25 / 10 * 5 = 12.5 liter
        $this->assertEquals(12.5, (float) $req2['required_qty']);
        $this->assertEquals('liter', $req2['unit']);
    }

    public function test_get_team_productivity_summary(): void
    {
        $location = Location::factory()->create();
        $team = ProductionTeam::create([
            'location_id' => $location->id,
            'name' => 'Tim Bravo',
            'leader_name' => 'Budi',
            'member_count' => 5,
            'daily_capacity' => 100,
            'is_active' => true,
        ]);

        $product = Product::factory()->create();
        $rawMaterial = Item::factory()->create();
        StockLevel::create(['item_id' => $rawMaterial->id, 'location_id' => $location->id, 'qty' => 1000]);

        $bom = Bom::create([
            'product_id' => $product->id,
            'code' => 'BOM-PROD-04',
            'name' => 'Resep 04',
            'batch_size' => 1,
            'is_active' => true,
        ]);
        BomItem::create(['bom_id' => $bom->id, 'item_id' => $rawMaterial->id, 'quantity' => 1, 'unit' => 'kg']);

        $period = now()->format('Y-m');
        $schedule = ProductionSchedule::create([
            'location_id' => $location->id,
            'period' => $period,
            'date' => now()->toDateString(),
            'product_id' => $product->id,
            'bom_id' => $bom->id,
            'team_id' => $team->id,
            'target_qty' => 100,
            'status' => 'SCHEDULED',
        ]);

        $service = app(ProductionService::class);
        $service->recordProduction([
            'location_id' => $location->id,
            'schedule_id' => $schedule->id,
            'product_id' => $product->id,
            'bom_id' => $bom->id,
            'team_id' => $team->id,
            'produced_qty' => 80,
            'reject_qty' => 5,
            'date' => now()->toDateString(),
        ]);

        $summary = $service->getTeamProductivitySummary((string) $location->id, $period);

        $this->assertNotEmpty($summary);
        $teamSummary = $summary->firstWhere('team_id', $team->id);
        $this->assertNotNull($teamSummary);
        $this->assertEquals('Tim Bravo', $teamSummary['team_name']);
        $this->assertEquals(100, $teamSummary['target_qty']);
        $this->assertEquals(80, $teamSummary['actual_qty']);
        $this->assertEquals(5, $teamSummary['reject_qty']);
        $this->assertEquals(80.0, (float) $teamSummary['achievement_pct']);
        $this->assertEquals(5.88, round((float) $teamSummary['reject_rate_pct'], 2)); // 5 / (80+5) = 5.88% or 5 / 80 = 6.25%
    }

    public function test_branch_scoping_on_schedules(): void
    {
        $bogor = Location::factory()->create(['name' => 'Bogor']);
        $nganjuk = Location::factory()->create(['name' => 'Nganjuk']);

        $product = Product::factory()->create();

        $scheduleBogor = ProductionSchedule::create([
            'location_id' => $bogor->id,
            'period' => '2026-11',
            'product_id' => $product->id,
            'target_qty' => 50,
            'status' => 'SCHEDULED',
        ]);

        $scheduleNganjuk = ProductionSchedule::create([
            'location_id' => $nganjuk->id,
            'period' => '2026-11',
            'product_id' => $product->id,
            'target_qty' => 60,
            'status' => 'SCHEDULED',
        ]);

        $userBogor = User::factory()->create(['active' => true, 'default_location_id' => $bogor->id]);
        $userBogor->locations()->attach($bogor->id);
        $userBogor->assignRole('kepala_cabang');

        $this->actingAs($userBogor);

        $scopedQuery = ProductionScheduleResource::getEloquentQuery();
        $this->assertTrue($scopedQuery->where('id', $scheduleBogor->id)->exists());
        $this->assertFalse($scopedQuery->where('id', $scheduleNganjuk->id)->exists());
    }

    public function test_filament_schedule_record_production_modal_action(): void
    {
        $location = Location::factory()->create();
        $product = Product::factory()->create();
        $rawMaterial = Item::factory()->create(['sku' => 'RAW-ACTION', 'name' => 'Bahan Action']);
        StockLevel::create(['item_id' => $rawMaterial->id, 'location_id' => $location->id, 'qty' => 1000]);

        $bom = Bom::create([
            'product_id' => $product->id,
            'code' => 'BOM-ACT-01',
            'name' => 'Resep Action',
            'batch_size' => 1,
            'is_active' => true,
        ]);
        BomItem::create(['bom_id' => $bom->id, 'item_id' => $rawMaterial->id, 'quantity' => 2, 'unit' => 'kg']);

        $schedule = ProductionSchedule::create([
            'location_id' => $location->id,
            'period' => '2026-11',
            'product_id' => $product->id,
            'bom_id' => $bom->id,
            'target_qty' => 100,
            'status' => 'SCHEDULED',
        ]);

        $admin = User::factory()->create(['active' => true]);
        $admin->assignRole('super_admin');
        $this->actingAs($admin);

        Livewire::test(ProductionScheduleResource\Pages\ListProductionSchedules::class)
            ->callTableAction('recordProduction', $schedule, data: [
                'produced_qty' => 40,
                'reject_qty' => 2,
                'notes' => 'Catat hasil produksi dari modal Filament',
            ])
            ->assertHasNoTableActionErrors();

        // Check raw material deducted: 1000 - (40 * 2) = 920
        $this->assertEquals(920, StockLevel::where('item_id', $rawMaterial->id)->where('location_id', $location->id)->value('qty'));
        // Check finished goods added: 40
        $this->assertEquals(40, StockLevel::where('product_id', $product->id)->where('location_id', $location->id)->value('qty'));

        $schedule->refresh();
        $this->assertEquals('IN_PROGRESS', $schedule->status);

        $this->assertDatabaseHas('production_logs', [
            'schedule_id' => $schedule->id,
            'actual_qty' => 40,
            'reject_qty' => 2,
        ]);
    }
}
