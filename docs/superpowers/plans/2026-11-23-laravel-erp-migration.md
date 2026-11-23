# Tridhata ERP Full Stack Migration Implementation Plan (Laravel + Filament Pivot)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Tridhata Agro operational web app from legacy TypeScript monorepo to a standalone, modular Laravel + Filament ERP in the dedicated `laravel/` folder, covering all 109 items across Starter, Business, and Enterprise tiers without third-party SaaS dependencies (no Supabase, Cloudinary, or Gemini Vision).

**Architecture:** A monolithic Laravel 11 application with Filament v3 powering the admin/operational UI, Spatie Laravel Permission handling multi-branch access control (Bogor & Nganjuk), local server disk storage (`storage/app/public`) replacing Cloudinary, asynchronous queued jobs for background image watermarking and PaddleOCR digit extraction, and DomPDF + Simple-QRCode for operational paperwork and labels.

**Tech Stack:**
- **Runtime & Framework:** PHP 8.3, Laravel 11, Filament v3, Livewire 3, Tailwind CSS
- **Database:** MySQL 8.0 / MariaDB 10.11 with InnoDB ACID transactions
- **Authentication:** Laravel Socialite (Google OAuth 2.0) with Pre-provisioned Email Whitelist Policy
- **Authorization & Audit:** `spatie/laravel-permission`, `spatie/laravel-activitylog`
- **Documents & Media:** `barryvdh/laravel-dompdf`, `simplesoftwareio/simple-qrcode`, `intervention/image` (v3)
- **OCR Engine:** On-server PaddleOCR (Python 3.10+ sub-process) wrapped in Laravel Queued Job
- **Testing:** Pest PHP / PHPUnit with in-memory SQLite / MySQL test database

## Global Constraints

- **Folder Isolation:** All new application files MUST reside exclusively in `laravel/`. The legacy folders `apps/api/`, `apps/web/`, and `packages/` remain intact as functional and data references until full migration and user sign-off.
- **Language Policy:** All user-facing UI labels, error messages, and PDF documents MUST be in Bahasa Indonesia. All code identifiers, database columns, filenames, and internal comments MUST be in English.
- **Timezone:** All operational date/time calculations, timestamps, and watermarks MUST use `Asia/Jakarta` (WIB). Never calculate dates using UTC directly.
- **Access Control:** Every route, Filament resource, and action MUST enforce server-side authorization and branch scoping (`location_id`). UI element hiding alone is prohibited.
- **Self-Contained Hosting:** Zero external paid API dependencies (No Supabase, No Cloudinary, No Gemini Vision, No Google Maps Geocoding API).

---

## Architectural Critique & Assumptions Rating

| Decision / Proposal | Rating | Direct Assessment & Honest Reality Check |
|---|---|---|
| **Pivoting from NestJS+React to Laravel+Filament** | **9.5 / 10** | **Outstanding Decision.** Building 109 ERP items (tables, filters, forms, modals, relations, CSV importers, activity logs, PDF exports) in React 19 + shadcn from scratch would take 3-4 months. Filament v3 cuts delivery time by 75% while keeping it 100% PHP/MySQL. |
| **Dropping Supabase & Cloudinary for MySQL & Local Disk** | **9.0 / 10** | **Excellent Decision.** Eliminates monthly vendor bills and vendor lock-in. Storing receipts, PDFs, and photos locally in `storage/app/public` with symlinks is standard, free, and completely self-contained. Automated daily backup (`spatie/laravel-backup`) handles disaster recovery. |
| **Dropping Gemini Vision for On-Server PaddleOCR** | **6.0 / 10** | **Vulnerable Assumption / High Risk.** Gemini Vision costs ~$0.10/month and has zero server load. PaddleOCR with OpenCV and PyTorch CPU inference consumes 1.5 GB to 2.5 GB RAM and spikes CPU to 100%. On a 4 GB VPS with Nginx, PHP-FPM, and MySQL, running PaddleOCR synchronously will trigger the Linux OOM Killer and crash the database. **Non-negotiable requirement:** PaddleOCR MUST run asynchronously via Laravel Queue workers, with 4 GB Linux SWAP enabled on the VPS, and with 4-corner perspective cropping to isolate digit boxes before OCR. |
| **Attendance with Live Photo & Server Watermark (No Paid Geocoding)** | **8.5 / 10** | **Smart Decision.** Stamping server timestamp, latitude/longitude, and a clickable short Google Maps link (`https://maps.google.com/?q={lat},{lng}`) via Intervention Image directly onto the JPEG avoids paid Google Maps Geocoding API costs completely. |
| **Handcrafting raw Blade/Livewire vs. Filament v3** | **4.0 / 10** | **Wrong Approach if chosen.** Writing raw Blade forms and Livewire components for 109 items from scratch is a massive trap. Filament v3 must be the primary application framework; custom Livewire components are reserved only for the mobile camera attendance screen and the OCR box verification canvas. |

---

## Database Schema Architecture (Ported & Expanded from Prisma)

The schema spans 24 core tables in MySQL:
1. `users` (id, name, email, google_id, avatar, division, default_location_id, active, timestamps)
2. `locations` (id, code [BOGOR, NGANJUK], name, address, timestamps)
3. `location_user` (pivot table: user_id, location_id)
4. `roles`, `permissions`, `model_has_roles`, `model_has_permissions` (Spatie package)
5. `categories` & `units` (unified units: pcs, kg, sak, botol, roll, etc.)
6. `items` (id, sku, name, category, unit, min_stock, safety_stock, is_raw_material, is_active)
7. `products` (id, sku, name, unit, selling_price, cogs_price, min_stock, is_active)
8. `vendors` (id, code, name, contact_person, phone, email, address, payment_terms)
9. `stock_levels` (id, item_id, product_id, location_id, qty, min_stock, safety_stock)
10. `stock_movements` (id, code, type [IN, OUT, TRANSFER, RETURN, REJECT, ADJUSTMENT], location_id, target_location_id, reference_type, reference_id, date, notes, receipt_path, status, created_by)
11. `stock_movement_items` (id, movement_id, item_id, product_id, qty, unit, unit_price, total_price)
12. `requests` (id, code, requester_id, location_id, type [RAW_MATERIAL, OFFICE, RND, TRANSFER], title, amount, status [PENDING, APPROVED, REJECTED], current_approval_step, notes, receipt_path)
13. `request_items` (id, request_id, item_id, qty, estimated_price, total_price)
14. `approvals` (id, request_id, approver_id, step, decision [APPROVED, REJECTED], notes, decided_at)
15. `boms` (id, product_id, code, name, batch_size, yield_unit, is_active)
16. `bom_items` (id, bom_id, item_id, quantity, unit)
17. `production_teams` (id, location_id, name, leader_name, member_count, daily_capacity)
18. `production_schedules` (id, location_id, period [YYYY-MM], date, product_id, bom_id, team_id, target_qty, status)
19. `production_logs` (id, schedule_id, product_id, team_id, actual_qty, reject_qty, date, notes, created_by)
20. `sales_orders` (id, so_number, po_number, customer_name, channel, location_id, date, status, total_amount, pdf_path)
21. `sales_order_items` (id, sales_order_id, product_id, qty, price, total)
22. `deliveries` / `surat_jalan` (id, sj_number, sales_order_id, location_id, date, driver_name, vehicle_no, status, pdf_path)
23. `attendances` (id, user_id, location_id, type [CLOCK_IN, CLOCK_OUT], timestamp, latitude, longitude, maps_url, photo_path, is_verified)
24. `stock_opnames` (id, code, location_id, date, status [DRAFT, OCR_PROCESSING, VERIFIED, APPLIED], form_photo_path, cropped_photo_path, total_variance, notes, created_by)
25. `stock_opname_items` (id, stock_opname_id, item_id, product_id, system_qty, counted_qty, variance, ocr_confidence, flagged_manual)
26. `letters` / `correspondence` (id, letter_number, type, direction [IN, OUT], subject, sender, recipient, date, file_path)

---

## File Structure Map (Target `laravel/`)

```
laravel/
├── app/
│   ├── Enums/
│   │   ├── LocationCode.php
│   │   ├── StockMovementType.php
│   │   ├── RequestType.php
│   │   └── ApprovalDecision.php
│   ├── Filament/
│   │   ├── Pages/
│   │   │   ├── Dashboard.php
│   │   │   ├── AttendancePage.php
│   │   │   └── StockOpnameVerificationPage.php
│   │   ├── Resources/
│   │   │   ├── ItemResource.php
│   │   │   ├── ProductResource.php
│   │   │   ├── VendorResource.php
│   │   │   ├── StockMovementResource.php
│   │   │   ├── RequestResource.php
│   │   │   ├── BomResource.php
│   │   │   ├── ProductionScheduleResource.php
│   │   │   ├── SalesOrderResource.php
│   │   │   ├── AttendanceResource.php
│   │   │   ├── StockOpnameResource.php
│   │   │   └── LetterResource.php
│   │   └── Widgets/
│   │       ├── StockOverviewWidget.php
│   │       ├── ProductionTargetWidget.php
│   │       └── PendingApprovalsWidget.php
│   ├── Http/
│   │   └── Controllers/
│   │       └── Auth/
│   │           └── GoogleAuthController.php
│   ├── Jobs/
│   │   ├── StampAttendancePhotoJob.php
│   │   └── ProcessStockOpnameOcrJob.php
│   ├── Models/
│   │   ├── User.php
│   │   ├── Location.php
│   │   ├── Item.php
│   │   ├── Product.php
│   │   ├── StockLevel.php
│   │   ├── StockMovement.php
│   │   ├── Request.php
│   │   ├── Approval.php
│   │   ├── Bom.php
│   │   ├── ProductionSchedule.php
│   │   ├── ProductionLog.php
│   │   ├── SalesOrder.php
│   │   ├── Delivery.php
│   │   ├── Attendance.php
│   │   ├── StockOpname.php
│   │   └── Letter.php
│   └── Services/
│       ├── InventoryService.php
│       ├── ApprovalService.php
│       ├── DocumentPdfService.php
│       └── WatermarkService.php
├── config/
│   ├── services.php
│   └── permission.php
├── database/
│   ├── migrations/
│   └── seeders/
│       ├── DatabaseSeeder.php
│       ├── RoleAndPermissionSeeder.php
│       ├── LocationSeeder.php
│       └── MasterDataSeeder.php
├── resources/
│   └── views/
│       ├── livewire/
│       │   ├── attendance-camera.blade.php
│       │   └── ocr-verification-grid.blade.php
│       └── pdf/
│           ├── surat-jalan.blade.php
│           ├── sales-order.blade.php
│           ├── invoice.blade.php
│           ├── qr-label.blade.php
│           └── stock-opname-template.blade.php
├── scripts/
│   └── ocr/
│       ├── requirements.txt
│       ├── crop_boxes.py
│       └── digit_reader.py
└── tests/
    ├── Feature/
    │   ├── GoogleAuthTest.php
    │   ├── InventoryMovementTest.php
    │   ├── ApprovalWorkflowTest.php
    │   ├── BomProductionTest.php
    │   └── StockOpnameOcrTest.php
    └── Unit/
```

---

## Tasks Breakdown

### Task 1: Environment Scaffolding & Host Runtime Setup

**Files:**
- Create: `laravel/composer.json`
- Create: `laravel/.env.example`
- Create: `laravel/config/app.php`

**Interfaces:**
- Consumes: PHP 8.3 CLI & Composer on host machine
- Produces: Bootstrapped Laravel 11 application in `laravel/`

- [ ] **Step 1: Check host PHP and install PHP 8.3 via winget if missing**
Run: `winget install PHP.PHP.8.3 --accept-source-agreements --accept-package-agreements`
Expected: PHP 8.3 installed on host machine.

- [ ] **Step 2: Scaffold Laravel 11 in `laravel/`**
Run: `composer create-project laravel/laravel:^11.0 laravel --prefer-dist --no-interaction`
Expected: Clean Laravel 11 project scaffolded in `laravel/`.

- [ ] **Step 3: Require core ERP packages**
Run: `cd laravel && composer require filament/filament:"^3.2" laravel/socialite:"^5.16" spatie/laravel-permission:"^6.9" spatie/laravel-activitylog:"^4.8" barryvdh/laravel-dompdf:"^3.0" simplesoftwareio/simple-qrcode:"^4.2" intervention/image:"^3.8"`
Expected: Packages installed cleanly without dependency lock conflicts.

- [ ] **Step 4: Commit foundation scaffolding**
```bash
git add laravel/
git commit -m "chore(laravel): initialize laravel 11 project with filament and core dependencies"
```

---

### Task 2: Core Database Schema & Migrations

**Files:**
- Create: `laravel/database/migrations/2026_11_23_000001_create_locations_table.php`
- Create: `laravel/database/migrations/2026_11_23_000002_create_master_tables.php`
- Create: `laravel/database/migrations/2026_11_23_000003_create_inventory_tables.php`
- Create: `laravel/database/migrations/2026_11_23_000004_create_production_tables.php`
- Create: `laravel/database/migrations/2026_11_23_000005_create_sales_tables.php`
- Create: `laravel/database/migrations/2026_11_23_000006_create_field_attendance_tables.php`
- Create: `laravel/database/migrations/2026_11_23_000007_create_stock_opname_tables.php`
- Create: `laravel/database/migrations/2026_11_23_000008_create_correspondence_tables.php`
- Test: `laravel/tests/Feature/DatabaseMigrationTest.php`

**Interfaces:**
- Consumes: Reference Prisma schema (`apps/api/prisma/schema.prisma`)
- Produces: MySQL / SQLite compatible migrations with foreign key constraints and indexes

- [ ] **Step 1: Write failing migration test**
```php
namespace Tests\Feature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_core_tables_are_created_successfully(): void
    {
        $tables = [
            'users', 'locations', 'location_user', 'items', 'products', 'vendors',
            'stock_levels', 'stock_movements', 'stock_movement_items', 'requests',
            'approvals', 'boms', 'bom_items', 'production_schedules', 'production_logs',
            'sales_orders', 'sales_order_items', 'deliveries', 'attendances',
            'stock_opnames', 'stock_opname_items', 'letters'
        ];

        foreach ($tables as $table) {
            $this->assertTrue(Schema::hasTable($table), "Missing table: {$table}");
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=DatabaseMigrationTest`
Expected: FAIL with "Missing table: locations"

- [ ] **Step 3: Implement migration files for all 24 entities**
Write full migrations with proper foreign keys (`onDelete('cascade')` or `restrict`), decimal precisions `decimal(18, 2)`, and branch isolation indices `index(['location_id', 'created_at'])`.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=DatabaseMigrationTest`
Expected: PASS (All tables verified)

- [ ] **Step 5: Commit migrations**
```bash
git add laravel/database/migrations laravel/tests/Feature/DatabaseMigrationTest.php
git commit -m "feat(database): define comprehensive erp schema migrations"
```

---

### Task 3: Google SSO & Pre-provisioned RBAC Authentication

**Files:**
- Create: `laravel/app/Http/Controllers/Auth/GoogleAuthController.php`
- Create: `laravel/app/Models/User.php`
- Create: `laravel/database/seeders/RoleAndPermissionSeeder.php`
- Test: `laravel/tests/Feature/GoogleAuthTest.php`

**Interfaces:**
- Consumes: `laravel/socialite`, `spatie/laravel-permission`
- Produces: Secure Google OAuth login that verifies against pre-provisioned user emails in DB and assigns Spatie roles

- [ ] **Step 1: Write failing test for Google SSO**
```php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_pre_provisioned_user_can_login_via_google(): void
    {
        $user = User::factory()->create([
            'email' => 'operasional@tridhata.com',
            'active' => true,
        ]);

        $abstractUser = Mockery::mock('Laravel\Socialite\Two\User');
        $abstractUser->shouldReceive('getId')->andReturn('google-123456');
        $abstractUser->shouldReceive('getEmail')->andReturn('operasional@tridhata.com');
        $abstractUser->shouldReceive('getName')->andReturn('Staf Operasional');
        $abstractUser->shouldReceive('getAvatar')->andReturn('https://lh3.googleusercontent.com/avatar');

        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('user')->andReturn($abstractUser);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $response = $this->get('/auth/google/callback');
        $response->assertRedirect('/admin');
        $this->assertAuthenticatedAs($user);
    }

    public function test_unregistered_google_account_is_blocked(): void
    {
        $abstractUser = Mockery::mock('Laravel\Socialite\Two\User');
        $abstractUser->shouldReceive('getId')->andReturn('google-999999');
        $abstractUser->shouldReceive('getEmail')->andReturn('stranger@gmail.com');
        $abstractUser->shouldReceive('getName')->andReturn('Stranger');
        $abstractUser->shouldReceive('getAvatar')->andReturn(null);

        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('user')->andReturn($abstractUser);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $response = $this->get('/auth/google/callback');
        $response->assertRedirect('/login');
        $response->assertSessionHas('error', 'Akun Google Anda belum terdaftar di sistem ERP Tridhata.');
        $this->assertGuest();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=GoogleAuthTest`
Expected: FAIL with "Route [auth/google/callback] not defined"

- [ ] **Step 3: Implement GoogleAuthController and routes**
Implement `redirectToGoogle()` and `handleGoogleCallback()` with whitelist validation and role hydration.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=GoogleAuthTest`
Expected: PASS

- [ ] **Step 5: Commit authentication**
```bash
git add laravel/app/Http/Controllers/Auth/ laravel/tests/Feature/GoogleAuthTest.php laravel/routes/
git commit -m "feat(auth): implement google sso with pre-provisioned whitelist policy"
```

---

### Task 4: Master Data & CSV Importer (Starter/Business MD-01 - MD-08)

**Files:**
- Create: `laravel/app/Filament/Resources/ItemResource.php`
- Create: `laravel/app/Filament/Resources/ProductResource.php`
- Create: `laravel/app/Filament/Resources/VendorResource.php`
- Create: `laravel/app/Services/CsvImportService.php`
- Test: `laravel/tests/Feature/CsvImportTest.php`

**Interfaces:**
- Consumes: Cleaned CSV files exported from Google Sheets
- Produces: Batch upsert into `items`, `products`, `vendors`, `boms`, `production_teams`

- [ ] **Step 1: Write failing test for CSV Importer**
```php
namespace Tests\Feature;
use App\Models\Item;
use App\Services\CsvImportService;
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
        $this->assertDatabaseHas('items', ['sku' => 'RAW-001', 'unit' => 'kg']);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=CsvImportTest`
Expected: FAIL with "Class CsvImportService not found"

- [ ] **Step 3: Implement CsvImportService and Filament Import Actions**
Implement streaming CSV parser with header normalization and duplicate prevention.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=CsvImportTest`
Expected: PASS

- [ ] **Step 5: Commit master data & CSV import**
```bash
git add laravel/app/Services/CsvImportService.php laravel/tests/Feature/CsvImportTest.php laravel/app/Filament/Resources/
git commit -m "feat(master-data): implement items, products, vendors and csv importer"
```

---

### Task 5: Stock Movement & Inventory Engine (SI-01 - SI-13)

**Files:**
- Create: `laravel/app/Services/InventoryService.php`
- Create: `laravel/app/Filament/Resources/StockMovementResource.php`
- Create: `laravel/resources/views/pdf/surat-jalan.blade.php`
- Test: `laravel/tests/Feature/InventoryMovementTest.php`

**Interfaces:**
- Consumes: Stock movements (Goods In, Goods Out, Returns, Rejects, Internal & Inter-warehouse transfers)
- Produces: Atomically updated `stock_levels`, Surat Jalan PDF generation, and in-app low stock alerts

- [ ] **Step 1: Write failing test for Inventory Transactions**
```php
namespace Tests\Feature;
use App\Enums\StockMovementType;
use App\Models\Item;
use App\Models\Location;
use App\Models\StockLevel;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryMovementTest extends TestCase
{
    use RefreshDatabase;

    public function test_goods_in_increments_stock_level(): void
    {
        $location = Location::factory()->create(['code' => 'BOGOR']);
        $item = Item::factory()->create(['sku' => 'RAW-001']);
        $service = app(InventoryService::class);

        $service->recordMovement([
            'type' => StockMovementType::IN,
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'items' => [
                ['item_id' => $item->id, 'qty' => 100, 'unit' => 'kg']
            ]
        ]);

        $this->assertDatabaseHas('stock_levels', [
            'item_id' => $item->id,
            'location_id' => $location->id,
            'qty' => 100
        ]);
    }

    public function test_inter_warehouse_transfer_deducts_source_and_increments_destination(): void
    {
        $bogor = Location::factory()->create(['code' => 'BOGOR']);
        $nganjuk = Location::factory()->create(['code' => 'NGANJUK']);
        $item = Item::factory()->create();

        StockLevel::create(['item_id' => $item->id, 'location_id' => $bogor->id, 'qty' => 50]);

        $service = app(InventoryService::class);
        $service->transferBetweenWarehouses($bogor->id, $nganjuk->id, [
            ['item_id' => $item->id, 'qty' => 20, 'unit' => 'kg']
        ]);

        $this->assertEquals(30, StockLevel::where('item_id', $item->id)->where('location_id', $bogor->id)->value('qty'));
        $this->assertEquals(20, StockLevel::where('item_id', $item->id)->where('location_id', $nganjuk->id)->value('qty'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=InventoryMovementTest`
Expected: FAIL with "Class InventoryService not found"

- [ ] **Step 3: Implement InventoryService with DB::transaction**
Implement strict locking (`lockForUpdate()`), movement audit logging, Surat Jalan PDF renderer, and low-stock threshold triggers.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=InventoryMovementTest`
Expected: PASS

- [ ] **Step 5: Commit inventory module**
```bash
git add laravel/app/Services/InventoryService.php laravel/tests/Feature/InventoryMovementTest.php laravel/app/Filament/Resources/StockMovementResource.php
git commit -m "feat(inventory): implement atomic stock movements, transfers, and surat jalan"
```

---

### Task 6: Multi-Step Requests & Approvals Engine (RA-01 - RA-08)

**Files:**
- Create: `laravel/app/Services/ApprovalService.php`
- Create: `laravel/app/Filament/Resources/RequestResource.php`
- Test: `laravel/tests/Feature/ApprovalWorkflowTest.php`

**Interfaces:**
- Consumes: User purchase requests (Raw Material, Office, RnD, Transfer)
- Produces: Multi-step approval chain transitions (e.g., Finance -> Director), status updates, and audit trail

- [ ] **Step 1: Write failing test for multi-step approval**
```php
namespace Tests\Feature;
use App\Models\Approval;
use App\Models\Request as ErpRequest;
use App\Models\User;
use App\Services\ApprovalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApprovalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_request_advances_through_multi_step_approval_chain(): void
    {
        $requester = User::factory()->create();
        $finance = User::factory()->create();
        $director = User::factory()->create();

        $request = ErpRequest::factory()->create([
            'requester_id' => $requester->id,
            'amount' => 15000000,
            'status' => 'PENDING',
            'current_approval_step' => 1
        ]);

        $service = app(ApprovalService::class);

        // Step 1: Finance Approves
        $service->processDecision($request, $finance, 1, 'APPROVED', 'Disetujui keuangan');
        $request->refresh();
        $this->assertEquals(2, $request->current_approval_step);
        $this->assertEquals('PENDING', $request->status);

        // Step 2: Director Approves (Final)
        $service->processDecision($request, $director, 2, 'APPROVED', 'Disetujui direktur');
        $request->refresh();
        $this->assertEquals('APPROVED', $request->status);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=ApprovalWorkflowTest`
Expected: FAIL with "Class ApprovalService not found"

- [ ] **Step 3: Implement ApprovalService & RequestResource**
Implement dynamic approval chains, receipt upload attachments stored on local disk, and in-app pending approval badge counts in Filament navigation.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=ApprovalWorkflowTest`
Expected: PASS

- [ ] **Step 5: Commit approval module**
```bash
git add laravel/app/Services/ApprovalService.php laravel/tests/Feature/ApprovalWorkflowTest.php laravel/app/Filament/Resources/RequestResource.php
git commit -m "feat(approvals): implement multi-step approval workflow and receipt uploads"
```

---

### Task 7: BOM Recipes & Production Engine (PP-01 - PP-07)

**Files:**
- Create: `laravel/app/Services/ProductionService.php`
- Create: `laravel/app/Filament/Resources/BomResource.php`
- Create: `laravel/app/Filament/Resources/ProductionScheduleResource.php`
- Test: `laravel/tests/Feature/BomProductionTest.php`

**Interfaces:**
- Consumes: BOM definitions and production schedule logs
- Produces: Automatic raw material stock deduction according to BOM recipe ratios and team productivity summaries

- [ ] **Step 1: Write failing test for BOM auto-deduction**
```php
namespace Tests\Feature;
use App\Models\Bom;
use App\Models\BomItem;
use App\Models\Item;
use App\Models\Location;
use App\Models\Product;
use App\Models\StockLevel;
use App\Services\ProductionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BomProductionTest extends TestCase
{
    use RefreshDatabase;

    public function test_logging_production_deducts_raw_materials_based_on_bom(): void
    {
        $location = Location::factory()->create();
        $product = Product::factory()->create(['sku' => 'PROD-01']);
        $rawMaterial = Item::factory()->create(['sku' => 'RAW-01']);

        StockLevel::create(['item_id' => $rawMaterial->id, 'location_id' => $location->id, 'qty' => 500]);

        $bom = Bom::create([
            'product_id' => $product->id,
            'code' => 'BOM-PROD-01',
            'name' => 'Resep Standar',
            'batch_size' => 10, // 10 units finished goods
            'is_active' => true
        ]);
        BomItem::create(['bom_id' => $bom->id, 'item_id' => $rawMaterial->id, 'quantity' => 50, 'unit' => 'kg']); // 5kg per unit

        $service = app(ProductionService::class);
        $service->recordProduction([
            'location_id' => $location->id,
            'product_id' => $product->id,
            'bom_id' => $bom->id,
            'produced_qty' => 20, // 20 units produced -> requires 100kg raw material
            'date' => now()->toDateString()
        ]);

        // Check raw material deducted: 500 - 100 = 400
        $this->assertEquals(400, StockLevel::where('item_id', $rawMaterial->id)->where('location_id', $location->id)->value('qty'));
        // Check finished goods added: 20
        $this->assertEquals(20, StockLevel::where('product_id', $product->id)->where('location_id', $location->id)->value('qty'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=BomProductionTest`
Expected: FAIL with "Class ProductionService not found"

- [ ] **Step 3: Implement ProductionService & BOM Resources**
Implement BOM calculation logic, material requirement planning (MRP) forecasting, and team capacity tracking.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=BomProductionTest`
Expected: PASS

- [ ] **Step 5: Commit production engine**
```bash
git add laravel/app/Services/ProductionService.php laravel/tests/Feature/BomProductionTest.php laravel/app/Filament/Resources/BomResource.php
git commit -m "feat(production): implement bom recipes, auto-deduction, and schedules"
```

---

### Task 8: Sales Orders, Documents, QR Labels & Invoices (SD-01 - SD-05, SI-10)

**Files:**
- Create: `laravel/app/Services/DocumentPdfService.php`
- Create: `laravel/app/Filament/Resources/SalesOrderResource.php`
- Create: `laravel/resources/views/pdf/sales-order.blade.php`
- Create: `laravel/resources/views/pdf/invoice.blade.php`
- Create: `laravel/resources/views/pdf/qr-label.blade.php`
- Test: `laravel/tests/Feature/SalesOrderPdfTest.php`

**Interfaces:**
- Consumes: Sales Orders, Goods Out transactions, and Product SKU data
- Produces: PDF files rendered via DomPDF and QR labels rendered via Simple-QRCode

- [ ] **Step 1: Write failing test for PDF and QR generation**
```php
namespace Tests\Feature;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Services\DocumentPdfService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalesOrderPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_sales_order_pdf_and_stores_on_disk(): void
    {
        $order = SalesOrder::factory()->create(['so_number' => 'SO-2026-001']);
        $service = app(DocumentPdfService::class);

        $pdfPath = $service->generateSalesOrderPdf($order);

        $this->assertFileExists(storage_path('app/public/' . $pdfPath));
        $this->assertStringEndsWith('.pdf', $pdfPath);
    }

    public function test_generates_qr_label_for_product(): void
    {
        $product = Product::factory()->create(['sku' => 'PROD-A', 'name' => 'Pupuk Organik']);
        $service = app(DocumentPdfService::class);

        $labelPdf = $service->generateQrLabelPdf($product);
        $this->assertFileExists(storage_path('app/public/' . $labelPdf));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=SalesOrderPdfTest`
Expected: FAIL with "Class DocumentPdfService not found"

- [ ] **Step 3: Implement DocumentPdfService & Blade templates**
Implement clean table layouts for Surat Jalan, Sales Order, Invoice, and QR label sticker sheets.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=SalesOrderPdfTest`
Expected: PASS

- [ ] **Step 5: Commit sales & document module**
```bash
git add laravel/app/Services/DocumentPdfService.php laravel/resources/views/pdf/ laravel/tests/Feature/SalesOrderPdfTest.php
git commit -m "feat(sales): implement sales orders, invoice, surat jalan and qr labels"
```

---

### Task 9: Mobile Photo Attendance & Watermarking (FR-07 - FR-09)

**Files:**
- Create: `laravel/app/Services/WatermarkService.php`
- Create: `laravel/app/Jobs/StampAttendancePhotoJob.php`
- Create: `laravel/resources/views/livewire/attendance-camera.blade.php`
- Create: `laravel/app/Filament/Pages/AttendancePage.php`
- Test: `laravel/tests/Feature/AttendanceWatermarkTest.php`

**Interfaces:**
- Consumes: Mobile browser live photo capture (`input type="file" capture="environment"`) + HTML5 geolocation coordinates
- Produces: Watermarked JPEG stamped with server WIB time, lat/long, and Google Maps URL, saved to `storage/app/public/attendance/`

- [ ] **Step 1: Write failing test for Attendance Watermarking**
```php
namespace Tests\Feature;
use App\Models\Attendance;
use App\Models\User;
use App\Services\WatermarkService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AttendanceWatermarkTest extends TestCase
{
    use RefreshDatabase;

    public function test_stamps_photo_with_server_time_coords_and_maps_url(): void
    {
        $user = User::factory()->create();
        $fakePhoto = UploadedFile::fake()->image('attendance.jpg', 800, 600);

        $service = app(WatermarkService::class);
        $stampedPath = $service->stampAttendancePhoto(
            $fakePhoto,
            -6.597147,
            106.806039,
            now()->setTimezone('Asia/Jakarta')
        );

        $this->assertFileExists(storage_path('app/public/' . $stampedPath));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=AttendanceWatermarkTest`
Expected: FAIL with "Class WatermarkService not found"

- [ ] **Step 3: Implement WatermarkService with Intervention Image**
Render dark semi-transparent banner at bottom-right corner, stamping:
- Line 1: `WIB: 2026-11-23 08:30:15`
- Line 2: `GPS: -6.597147, 106.806039`
- Line 3: `maps.google.com/?q=-6.597147,106.806039`

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=AttendanceWatermarkTest`
Expected: PASS

- [ ] **Step 5: Commit attendance module**
```bash
git add laravel/app/Services/WatermarkService.php laravel/app/Jobs/StampAttendancePhotoJob.php laravel/resources/views/livewire/attendance-camera.blade.php
git commit -m "feat(field): implement live camera attendance with server timestamp and coordinates watermark"
```

---

### Task 10: On-Server PaddleOCR Stock Opname Box Pipeline (OC-01 - OC-08)

**Files:**
- Create: `laravel/resources/views/pdf/stock-opname-template.blade.php`
- Create: `laravel/scripts/ocr/crop_boxes.py`
- Create: `laravel/scripts/ocr/digit_reader.py`
- Create: `laravel/app/Jobs/ProcessStockOpnameOcrJob.php`
- Create: `laravel/app/Filament/Pages/StockOpnameVerificationPage.php`
- Test: `laravel/tests/Feature/StockOpnameOcrTest.php`

**Interfaces:**
- Consumes: Photo of agreed stock opname form template (with corner registration markers and 1-box-per-digit)
- Produces: Asynchronously cropped digit boxes, PaddleOCR predicted digits with confidence scores, and verification grid UI

- [ ] **Step 1: Write failing test for OCR queue dispatch and item parsing**
```php
namespace Tests\Feature;
use App\Jobs\ProcessStockOpnameOcrJob;
use App\Models\Location;
use App\Models\StockOpname;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class StockOpnameOcrTest extends TestCase
{
    use RefreshDatabase;

    public function test_uploading_opname_photo_dispatches_async_ocr_job(): void
    {
        Queue::fake();

        $location = Location::factory()->create();
        $opname = StockOpname::create([
            'code' => 'SO-202611-001',
            'location_id' => $location->id,
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'form_photo_path' => 'opnames/sample_form.jpg'
        ]);

        ProcessStockOpnameOcrJob::dispatch($opname);

        Queue::assertPushed(ProcessStockOpnameOcrJob::class, function ($job) use ($opname) {
            return $job->stockOpname->id === $opname->id;
        });
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=StockOpnameOcrTest`
Expected: FAIL with "Class ProcessStockOpnameOcrJob not found"

- [ ] **Step 3: Implement Python scripts and Laravel Queued Job**
1. `crop_boxes.py`: Uses OpenCV to detect the 4 black square corner markers, computes `getPerspectiveTransform()`, warps image to 2000x2800px standard resolution, and crops the known bounding box grid for digit cells.
2. `digit_reader.py`: Runs PaddleOCR on each cropped digit box, outputs JSON array: `[{ row: 1, item_id: '...', digits: '0025', confidence: 0.94, flagged_manual: false }]`.
3. `ProcessStockOpnameOcrJob`: Calls Python script via `Symfony\Component\Process\Process`, parses JSON, populates `stock_opname_items`, and sets status to `VERIFIED`.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=StockOpnameOcrTest`
Expected: PASS

- [ ] **Step 5: Commit OCR pipeline**
```bash
git add laravel/scripts/ocr/ laravel/app/Jobs/ProcessStockOpnameOcrJob.php laravel/resources/views/pdf/stock-opname-template.blade.php
git commit -m "feat(ocr): implement boxed template, opencv perspective crop, and paddleocr pipeline"
```

---

### Task 11: Correspondence & Letter Numbering (CO-01 - CO-03)

**Files:**
- Create: `laravel/app/Services/LetterNumberService.php`
- Create: `laravel/app/Filament/Resources/LetterResource.php`
- Test: `laravel/tests/Feature/LetterNumberingTest.php`

**Interfaces:**
- Consumes: Letter metadata (type, direction [IN, OUT], branch, date)
- Produces: Auto-incremented standard letter number (e.g. `015/TAI-BGR/OUT/XI/2026`) and file archive

- [ ] **Step 1: Write failing test for letter numbering**
```php
namespace Tests\Feature;
use App\Models\Letter;
use App\Services\LetterNumberService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LetterNumberingTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_sequential_letter_number(): void
    {
        $service = app(LetterNumberService::class);

        $num1 = $service->generateNextNumber('OUT', 'BGR');
        $this->assertStringContainsString('/TAI-BGR/OUT/', $num1);

        Letter::create([
            'letter_number' => $num1,
            'direction' => 'OUT',
            'type' => 'SURAT_TUGAS',
            'subject' => 'Tugas Lapangan',
            'date' => now()->toDateString()
        ]);

        $num2 = $service->generateNextNumber('OUT', 'BGR');
        $this->assertNotEquals($num1, $num2);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd laravel && php artisan test --filter=LetterNumberingTest`
Expected: FAIL with "Class LetterNumberService not found"

- [ ] **Step 3: Implement LetterNumberService & LetterResource**
Implement sequential numbering with Roman numeral months, year resets, and file attachment handling.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd laravel && php artisan test --filter=LetterNumberingTest`
Expected: PASS

- [ ] **Step 5: Commit correspondence module**
```bash
git add laravel/app/Services/LetterNumberService.php laravel/app/Filament/Resources/LetterResource.php laravel/tests/Feature/LetterNumberingTest.php
git commit -m "feat(correspondence): implement letter archive and automatic letter numbering"
```

---

### Task 12: Production Readiness, Verification & Legacy Cleanup Strategy

**Files:**
- Create: `laravel/tests/Feature/E2ETrackerVerificationTest.php`
- Create: `laravel/deploy.sh`
- Create: `laravel/supervisord.conf`

**Interfaces:**
- Consumes: Verification against all 109 checklist items in `erp_development_tracker.md`
- Produces: Clean deployment script for Ubuntu VPS, Supervisor config for queues, and formal legacy deletion sign-off

- [ ] **Step 1: Write E2E verification test covering all 109 tracker capabilities**
- [ ] **Step 2: Run full test suite: `cd laravel && php artisan test`**
- [ ] **Step 3: Verify 100% passing tests**
- [ ] **Step 4: Provide formal user sign-off checklist before removing legacy `apps/api/`, `apps/web/`, and `packages/`**
- [ ] **Step 5: Commit deployment scripts and tracker verification**
```bash
git add laravel/deploy.sh laravel/supervisord.conf laravel/tests/
git commit -m "chore(deployment): add vps deployment scripts, supervisor config, and e2e verification"
```

