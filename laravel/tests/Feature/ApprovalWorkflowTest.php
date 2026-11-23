<?php

namespace Tests\Feature;

use App\Filament\Resources\RequestResource;
use App\Models\Approval;
use App\Models\Item;
use App\Models\Location;
use App\Models\Request as ErpRequest;
use App\Models\RequestItem;
use App\Models\User;
use App\Services\ApprovalService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ApprovalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected Role $financeRole;
    protected Role $directorRole;
    protected Role $superAdminRole;
    protected Role $staffRole;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::firstOrCreate(['name' => 'approve_requests', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'approve_finance', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'approve_director', 'guard_name' => 'web']);

        $this->superAdminRole = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $this->financeRole = Role::firstOrCreate(['name' => 'finance', 'guard_name' => 'web']);
        $this->financeRole->syncPermissions(['approve_requests', 'approve_finance']);

        $this->directorRole = Role::firstOrCreate(['name' => 'director', 'guard_name' => 'web']);
        $this->directorRole->syncPermissions(['approve_director', 'approve_requests']);

        $this->staffRole = Role::firstOrCreate(['name' => 'staff_gudang', 'guard_name' => 'web']);
    }

    public function test_submitting_request_creates_pending_status_at_step_1(): void
    {
        $location = Location::factory()->create(['name' => 'Gudang Bogor']);
        $requester = User::factory()->create([
            'default_location_id' => $location->id,
            'active' => true,
        ]);
        $requester->locations()->attach($location);

        $item1 = Item::factory()->create(['name' => 'Bahan A']);
        $item2 = Item::factory()->create(['name' => 'Bahan B']);

        $service = app(ApprovalService::class);

        $request = $service->submitRequest([
            'location_id' => $location->id,
            'type' => 'RAW_MATERIAL',
            'title' => 'Pengajuan Bahan Baku Produksi',
            'notes' => 'Kebutuhan minggu pertama',
            'items' => [
                [
                    'item_id' => $item1->id,
                    'qty' => 10,
                    'estimated_price' => 500000,
                    'total_price' => 5000000,
                ],
                [
                    'item_id' => $item2->id,
                    'qty' => 5,
                    'estimated_price' => 600000,
                    'total_price' => 3000000,
                ],
            ],
        ], $requester);

        $this->assertInstanceOf(ErpRequest::class, $request);
        $this->assertMatchesRegularExpression('/^REQ-\d{6}-\d{4}$/', $request->code);
        $this->assertEquals('PENDING', $request->status);
        $this->assertEquals(1, $request->current_approval_step);
        $this->assertEquals(8000000, $request->amount);
        $this->assertEquals($requester->id, $request->requester_id);
        $this->assertEquals($location->id, $request->location_id);
        $this->assertCount(2, $request->items);

        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'code' => $request->code,
            'status' => 'PENDING',
            'current_approval_step' => 1,
            'amount' => 8000000,
        ]);

        $this->assertDatabaseHas('request_items', [
            'request_id' => $request->id,
            'item_id' => $item1->id,
            'qty' => 10,
            'total_price' => 5000000,
        ]);

        $this->assertDatabaseHas('activity_log', [
            'log_name' => 'request',
            'subject_id' => $request->id,
        ]);
    }

    public function test_request_advances_through_multi_step_approval_chain(): void
    {
        $requester = User::factory()->create();
        $finance = User::factory()->create(['division' => 'finance']);
        $finance->assignRole($this->financeRole);
        $director = User::factory()->create(['division' => 'director']);
        $director->assignRole($this->directorRole);

        $request = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'amount' => 15000000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        $service = app(ApprovalService::class);

        // Step 1: Finance Approves
        $approval1 = $service->processDecision($request, $finance, 1, 'APPROVED', 'Disetujui keuangan');
        $request->refresh();
        $this->assertEquals(2, $request->current_approval_step);
        $this->assertEquals('PENDING', $request->status);
        $this->assertInstanceOf(Approval::class, $approval1);
        $this->assertEquals('APPROVED', $approval1->decision);
        $this->assertEquals($finance->id, $approval1->approver_id);
        $this->assertEquals(1, $approval1->step);

        // Step 2: Director Approves (Final)
        $approval2 = $service->processDecision($request, $director, 2, 'APPROVED', 'Disetujui direktur');
        $request->refresh();
        $this->assertEquals('APPROVED', $request->status);
        $this->assertNotNull($request->decided_at);
        $this->assertInstanceOf(Approval::class, $approval2);
        $this->assertEquals('APPROVED', $approval2->decision);
        $this->assertEquals($director->id, $approval2->approver_id);
        $this->assertEquals(2, $approval2->step);

        $this->assertCount(2, $request->approvals);
    }

    public function test_single_step_request_approved_immediately_at_step_1(): void
    {
        $requester = User::factory()->create();
        $finance = User::factory()->create(['division' => 'finance']);
        $finance->assignRole($this->financeRole);

        // Amount under threshold (Rp 5.000.000) and type OFFICE
        $request = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'type' => 'OFFICE',
            'amount' => 1500000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        $service = app(ApprovalService::class);

        $service->processDecision($request, $finance, 1, 'APPROVED', 'Biaya operasional kantor disetujui');
        $request->refresh();

        $this->assertEquals('APPROVED', $request->status);
        $this->assertNotNull($request->decided_at);
        $this->assertEquals(1, $request->current_approval_step);
    }

    public function test_rejection_at_any_step_sets_status_to_rejected_immediately(): void
    {
        $requester = User::factory()->create();
        $finance = User::factory()->create(['division' => 'finance']);
        $finance->assignRole($this->financeRole);
        $director = User::factory()->create(['division' => 'director']);
        $director->assignRole($this->directorRole);

        $service = app(ApprovalService::class);

        // 1. Rejection at Step 1
        $request1 = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'amount' => 10000000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        $service->processDecision($request1, $finance, 1, 'REJECTED', 'Anggaran tidak mencukupi');
        $request1->refresh();

        $this->assertEquals('REJECTED', $request1->status);
        $this->assertNotNull($request1->decided_at);
        $this->assertDatabaseHas('approvals', [
            'request_id' => $request1->id,
            'approver_id' => $finance->id,
            'step' => 1,
            'decision' => 'REJECTED',
            'notes' => 'Anggaran tidak mencukupi',
        ]);

        // 2. Rejection at Step 2
        $request2 = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'amount' => 20000000,
            'status' => 'PENDING',
            'current_approval_step' => 2,
        ]);

        $service->processDecision($request2, $director, 2, 'REJECTED', 'Ditolak direktur: tunda proyek');
        $request2->refresh();

        $this->assertEquals('REJECTED', $request2->status);
        $this->assertNotNull($request2->decided_at);
        $this->assertDatabaseHas('approvals', [
            'request_id' => $request2->id,
            'approver_id' => $director->id,
            'step' => 2,
            'decision' => 'REJECTED',
        ]);
    }

    public function test_unauthorized_user_cannot_approve_a_step(): void
    {
        $requester = User::factory()->create();
        $staff = User::factory()->create(['division' => 'gudang']);
        $staff->assignRole($this->staffRole);

        $finance = User::factory()->create(['division' => 'finance']);
        $finance->assignRole($this->financeRole);

        $request = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'amount' => 10000000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        $service = app(ApprovalService::class);

        // Staff gudang cannot approve step 1
        $this->expectException(AuthorizationException::class);
        $service->processDecision($request, $staff, 1, 'APPROVED', 'Disetujui staff');
    }

    public function test_finance_user_cannot_approve_step_2(): void
    {
        $requester = User::factory()->create();
        $finance = User::factory()->create(['division' => 'finance']);
        $finance->assignRole($this->financeRole);

        $request = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'amount' => 10000000,
            'status' => 'PENDING',
            'current_approval_step' => 2,
        ]);

        $service = app(ApprovalService::class);

        // Finance cannot approve step 2 (director only)
        $this->expectException(AuthorizationException::class);
        $service->processDecision($request, $finance, 2, 'APPROVED', 'Disetujui finance pada step 2');
    }

    public function test_cannot_process_wrong_step_or_non_pending_request(): void
    {
        $requester = User::factory()->create();
        $director = User::factory()->create(['division' => 'director']);
        $director->assignRole($this->directorRole);

        $request = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'amount' => 10000000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        $service = app(ApprovalService::class);

        // Cannot process step 2 when current_approval_step is 1
        try {
            $service->processDecision($request, $director, 2, 'APPROVED');
            $this->fail('Should throw InvalidArgumentException when step does not match');
        } catch (\InvalidArgumentException $e) {
            $this->assertStringContainsString('Tahap persetujuan tidak sesuai', $e->getMessage());
        }

        // Cannot process non-pending request
        $request->update(['status' => 'APPROVED']);
        try {
            $service->processDecision($request, $director, 1, 'APPROVED');
            $this->fail('Should throw InvalidArgumentException when request is not pending');
        } catch (\InvalidArgumentException $e) {
            $this->assertStringContainsString('sudah berstatus', $e->getMessage());
        }
    }

    public function test_receipt_upload_attachment(): void
    {
        $request = ErpRequest::factory()->create([
            'status' => 'APPROVED',
        ]);

        $file = UploadedFile::fake()->create('bukti_transfer.pdf', 100, 'application/pdf');

        $service = app(ApprovalService::class);
        $savedPath = $service->attachReceipt($request, $file);

        $request->refresh();
        $this->assertEquals($savedPath, $request->receipt_path);
        Storage::disk('public')->assertExists($savedPath);
        $this->assertStringStartsWith('requests/', $savedPath);

        $this->assertDatabaseHas('activity_log', [
            'log_name' => 'request',
            'subject_id' => $request->id,
        ]);
    }

    public function test_branch_scoping_query_on_requests(): void
    {
        $bogor = Location::factory()->create(['code' => 'BOGOR', 'name' => 'Gudang Bogor']);
        $nganjuk = Location::factory()->create(['code' => 'NGANJUK', 'name' => 'Gudang Nganjuk']);

        $bogorUser = User::factory()->create(['active' => true]);
        $bogorUser->locations()->attach($bogor);

        $nganjukUser = User::factory()->create(['active' => true]);
        $nganjukUser->locations()->attach($nganjuk);

        $financeUser = User::factory()->create(['active' => true]);
        $financeUser->assignRole($this->financeRole);

        $superAdminUser = User::factory()->create(['active' => true]);
        $superAdminUser->assignRole($this->superAdminRole);

        $bogorRequest = ErpRequest::factory()->create([
            'location_id' => $bogor->id,
            'title' => 'Pengajuan Cabang Bogor',
        ]);

        $nganjukRequest = ErpRequest::factory()->create([
            'location_id' => $nganjuk->id,
            'title' => 'Pengajuan Cabang Nganjuk',
        ]);

        // Bogor User sees only Bogor requests
        $this->actingAs($bogorUser);
        $bogorIds = RequestResource::getEloquentQuery()->pluck('id')->all();
        $this->assertContains($bogorRequest->id, $bogorIds);
        $this->assertNotContains($nganjukRequest->id, $bogorIds);

        // Nganjuk User sees only Nganjuk requests
        $this->actingAs($nganjukUser);
        $nganjukIds = RequestResource::getEloquentQuery()->pluck('id')->all();
        $this->assertContains($nganjukRequest->id, $nganjukIds);
        $this->assertNotContains($bogorRequest->id, $nganjukIds);

        // Finance User sees all requests across branches
        $this->actingAs($financeUser);
        $financeIds = RequestResource::getEloquentQuery()->pluck('id')->all();
        $this->assertContains($bogorRequest->id, $financeIds);
        $this->assertContains($nganjukRequest->id, $financeIds);

        // SuperAdmin User sees all requests across branches
        $this->actingAs($superAdminUser);
        $adminIds = RequestResource::getEloquentQuery()->pluck('id')->all();
        $this->assertContains($bogorRequest->id, $adminIds);
        $this->assertContains($nganjukRequest->id, $adminIds);
    }

    public function test_pending_approvals_count_and_filament_navigation_badge(): void
    {
        $bogor = Location::factory()->create(['code' => 'BOGOR']);

        $financeUser = User::factory()->create(['active' => true, 'division' => 'finance']);
        $financeUser->assignRole($this->financeRole);

        $directorUser = User::factory()->create(['active' => true, 'division' => 'director']);
        $directorUser->assignRole($this->directorRole);

        $superAdminUser = User::factory()->create(['active' => true]);
        $superAdminUser->assignRole($this->superAdminRole);

        $staffUser = User::factory()->create(['active' => true]);
        $staffUser->assignRole($this->staffRole);
        $staffUser->locations()->attach($bogor);

        // 2 pending at step 1
        ErpRequest::factory()->create([
            'location_id' => $bogor->id,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);
        ErpRequest::factory()->create([
            'location_id' => $bogor->id,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        // 1 pending at step 2
        ErpRequest::factory()->create([
            'location_id' => $bogor->id,
            'status' => 'PENDING',
            'current_approval_step' => 2,
        ]);

        // 1 already approved
        ErpRequest::factory()->create([
            'location_id' => $bogor->id,
            'status' => 'APPROVED',
            'current_approval_step' => 2,
        ]);

        $service = app(ApprovalService::class);

        $this->assertEquals(2, $service->getPendingApprovalsCount($financeUser));
        $this->assertEquals(1, $service->getPendingApprovalsCount($directorUser));
        $this->assertEquals(3, $service->getPendingApprovalsCount($superAdminUser));
        $this->assertEquals(0, $service->getPendingApprovalsCount($staffUser));

        $this->actingAs($financeUser);
        $this->assertEquals('2', RequestResource::getNavigationBadge());

        $this->actingAs($directorUser);
        $this->assertEquals('1', RequestResource::getNavigationBadge());

        $this->actingAs($staffUser);
        $this->assertNull(RequestResource::getNavigationBadge());
    }

    public function test_filament_table_actions_approve_reject_and_upload(): void
    {
        $bogor = Location::factory()->create(['code' => 'BOGOR']);

        $financeUser = User::factory()->create(['active' => true, 'division' => 'finance']);
        $financeUser->assignRole($this->financeRole);

        $request = ErpRequest::factory()->create([
            'location_id' => $bogor->id,
            'amount' => 1000000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        $this->actingAs($financeUser);

        // Approve action via Filament Table
        \Livewire\Livewire::test(RequestResource\Pages\ListRequests::class)
            ->callTableAction('approve', $request, data: [
                'notes' => 'Disetujui dari table action',
            ])
            ->assertHasNoTableActionErrors();

        $request->refresh();
        $this->assertEquals('APPROVED', $request->status);
        $this->assertDatabaseHas('approvals', [
            'request_id' => $request->id,
            'approver_id' => $financeUser->id,
            'step' => 1,
            'decision' => 'APPROVED',
            'notes' => 'Disetujui dari table action',
        ]);

        // Create new request for rejection
        $request2 = ErpRequest::factory()->create([
            'location_id' => $bogor->id,
            'amount' => 2000000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
        ]);

        \Livewire\Livewire::test(RequestResource\Pages\ListRequests::class)
            ->callTableAction('reject', $request2, data: [
                'notes' => 'Ditolak dari table action',
            ])
            ->assertHasNoTableActionErrors();

        $request2->refresh();
        $this->assertEquals('REJECTED', $request2->status);
        $this->assertDatabaseHas('approvals', [
            'request_id' => $request2->id,
            'approver_id' => $financeUser->id,
            'step' => 1,
            'decision' => 'REJECTED',
            'notes' => 'Ditolak dari table action',
        ]);
    }
}
