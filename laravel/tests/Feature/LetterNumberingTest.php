<?php

namespace Tests\Feature;

use App\Filament\Resources\LetterResource;
use App\Filament\Resources\LetterResource\Pages\CreateLetter;
use App\Filament\Resources\LetterResource\Pages\ListLetters;
use App\Models\Letter;
use App\Models\Location;
use App\Models\User;
use App\Services\LetterNumberService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class LetterNumberingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    public function test_generates_sequential_letter_number(): void
    {
        $service = app(LetterNumberService::class);

        $num1 = $service->generateNextNumber('OUT', 'BGR');
        $this->assertStringContainsString('/TAI-BGR/OUT/', $num1);
        $this->assertStringStartsWith('001/', $num1);

        Letter::create([
            'letter_number' => $num1,
            'direction' => 'OUT',
            'type' => 'SURAT_TUGAS',
            'subject' => 'Tugas Lapangan',
            'date' => now()->toDateString(),
        ]);

        $num2 = $service->generateNextNumber('OUT', 'BGR');
        $this->assertNotEquals($num1, $num2);
        $this->assertStringStartsWith('002/', $num2);
    }

    public function test_letter_numbering_uses_roman_numeral_for_months(): void
    {
        $service = app(LetterNumberService::class);

        $janDate = Carbon::create(2026, 1, 15);
        $novDate = Carbon::create(2026, 11, 23);
        $decDate = Carbon::create(2026, 12, 5);

        $numJan = $service->generateNextNumber('OUT', 'BGR', $janDate);
        $this->assertEquals('001/TAI-BGR/OUT/I/2026', $numJan);

        $numNov = $service->generateNextNumber('OUT', 'BGR', $novDate);
        $this->assertEquals('001/TAI-BGR/OUT/XI/2026', $numNov);

        $numDec = $service->generateNextNumber('IN', 'BGR', $decDate);
        $this->assertEquals('001/TAI-BGR/IN/XII/2026', $numDec);

        $this->assertEquals('IV', $service->toRoman(4));
        $this->assertEquals('VIII', $service->toRoman(8));
        $this->assertEquals('IX', $service->toRoman(9));
    }

    public function test_year_change_resets_sequence_to_001(): void
    {
        $service = app(LetterNumberService::class);

        // Year 2026: create two letters
        $date2026 = Carbon::create(2026, 11, 10);
        $num1 = $service->generateNextNumber('OUT', 'BGR', $date2026);
        $this->assertEquals('001/TAI-BGR/OUT/XI/2026', $num1);

        Letter::create([
            'letter_number' => $num1,
            'direction' => 'OUT',
            'branch' => 'BGR',
            'type' => 'SURAT_TUGAS',
            'subject' => 'Surat Tugas 2026-1',
            'date' => $date2026->toDateString(),
        ]);

        $num2 = $service->generateNextNumber('OUT', 'BGR', $date2026);
        $this->assertEquals('002/TAI-BGR/OUT/XI/2026', $num2);

        Letter::create([
            'letter_number' => $num2,
            'direction' => 'OUT',
            'branch' => 'BGR',
            'type' => 'SURAT_PENAWARAN',
            'subject' => 'Penawaran 2026-2',
            'date' => $date2026->toDateString(),
        ]);

        // Year 2027: sequence resets to 001
        $date2027 = Carbon::create(2027, 1, 5);
        $num2027 = $service->generateNextNumber('OUT', 'BGR', $date2027);
        $this->assertEquals('001/TAI-BGR/OUT/I/2027', $num2027);
    }

    public function test_different_branches_maintain_independent_sequences(): void
    {
        $service = app(LetterNumberService::class);
        $date = Carbon::create(2026, 11, 23);

        $numBgr1 = $service->generateNextNumber('OUT', 'BGR', $date);
        $this->assertEquals('001/TAI-BGR/OUT/XI/2026', $numBgr1);

        Letter::create([
            'letter_number' => $numBgr1,
            'direction' => 'OUT',
            'branch' => 'BGR',
            'type' => 'SURAT_TUGAS',
            'subject' => 'Surat Bogor 1',
            'date' => $date->toDateString(),
        ]);

        $numNgj1 = $service->generateNextNumber('OUT', 'NGJ', $date);
        $this->assertEquals('001/TAI-NGJ/OUT/XI/2026', $numNgj1);

        Letter::create([
            'letter_number' => $numNgj1,
            'direction' => 'OUT',
            'branch' => 'NGJ',
            'type' => 'SURAT_TUGAS',
            'subject' => 'Surat Nganjuk 1',
            'date' => $date->toDateString(),
        ]);

        $numBgr2 = $service->generateNextNumber('OUT', 'BGR', $date);
        $this->assertEquals('002/TAI-BGR/OUT/XI/2026', $numBgr2);

        $numNgj2 = $service->generateNextNumber('OUT', 'NGJ', $date);
        $this->assertEquals('002/TAI-NGJ/OUT/XI/2026', $numNgj2);
    }

    public function test_letter_file_upload_and_storage_archive(): void
    {
        $file = UploadedFile::fake()->create('surat_perjanjian.pdf', 150, 'application/pdf');
        $storedPath = $file->store('letters', 'public');

        Storage::disk('public')->assertExists($storedPath);

        $letter = Letter::create([
            'letter_number' => '001/TAI-BGR/OUT/XI/2026',
            'direction' => 'OUT',
            'branch' => 'BGR',
            'type' => 'SURAT_PERJANJIAN',
            'subject' => 'Perjanjian Kerjasama Pupuk',
            'sender' => 'PT Tridhata Agro',
            'recipient' => 'Dinas Pertanian',
            'date' => '2026-11-23',
            'file_path' => $storedPath,
            'notes' => 'Dokumen resmi bermaterai',
        ]);

        $this->assertDatabaseHas('letters', [
            'id' => $letter->id,
            'letter_number' => '001/TAI-BGR/OUT/XI/2026',
            'file_path' => $storedPath,
        ]);
        $this->assertTrue(Storage::disk('public')->exists($letter->file_path));
    }

    public function test_branch_scoping_on_letter_resource(): void
    {
        $locBogor = Location::factory()->create(['name' => 'Cabang Bogor', 'code' => 'BGR']);
        $locNganjuk = Location::factory()->create(['name' => 'Cabang Nganjuk', 'code' => 'NGJ']);

        $userBogor = User::factory()->create(['default_location_id' => $locBogor->id]);
        $userNganjuk = User::factory()->create(['default_location_id' => $locNganjuk->id]);
        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super_admin');
        $userNoLoc = User::factory()->create(['default_location_id' => null]);

        $letterBogor = Letter::create([
            'letter_number' => '001/TAI-BGR/OUT/XI/2026',
            'direction' => 'OUT',
            'location_id' => $locBogor->id,
            'branch' => 'BGR',
            'type' => 'SURAT_TUGAS',
            'subject' => 'Surat Khusus Bogor',
            'date' => '2026-11-23',
        ]);

        $letterNganjuk = Letter::create([
            'letter_number' => '001/TAI-NGJ/OUT/XI/2026',
            'direction' => 'OUT',
            'location_id' => $locNganjuk->id,
            'branch' => 'NGJ',
            'type' => 'SURAT_TUGAS',
            'subject' => 'Surat Khusus Nganjuk',
            'date' => '2026-11-23',
        ]);

        // User Bogor query
        $this->actingAs($userBogor);
        $bogorResults = LetterResource::getEloquentQuery()->pluck('id')->all();
        $this->assertContains($letterBogor->id, $bogorResults);
        $this->assertNotContains($letterNganjuk->id, $bogorResults);

        // User Nganjuk query
        $this->actingAs($userNganjuk);
        $nganjukResults = LetterResource::getEloquentQuery()->pluck('id')->all();
        $this->assertContains($letterNganjuk->id, $nganjukResults);
        $this->assertNotContains($letterBogor->id, $nganjukResults);

        // Super Admin query
        $this->actingAs($superAdmin);
        $adminResults = LetterResource::getEloquentQuery()->pluck('id')->all();
        $this->assertContains($letterBogor->id, $adminResults);
        $this->assertContains($letterNganjuk->id, $adminResults);

        // User without locations query
        $this->actingAs($userNoLoc);
        $noLocResults = LetterResource::getEloquentQuery()->pluck('id')->all();
        $this->assertEmpty($noLocResults);
    }

    public function test_filament_letter_resource_table_and_creation(): void
    {
        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super_admin');
        $this->actingAs($superAdmin);

        $loc = Location::factory()->create(['name' => 'Cabang Bogor', 'code' => 'BGR']);

        $letter = Letter::create([
            'letter_number' => '005/TAI-BGR/OUT/XI/2026',
            'direction' => 'OUT',
            'location_id' => $loc->id,
            'branch' => 'BGR',
            'type' => 'SURAT_PENAWARAN',
            'subject' => 'Penawaran Produk Organik',
            'sender' => 'PT Tridhata Agro',
            'recipient' => 'Koperasi Tani Makmur',
            'date' => '2026-11-23',
            'file_path' => 'letters/sample.pdf',
        ]);

        Livewire::test(ListLetters::class)
            ->assertSuccessful()
            ->assertCanSeeTableRecords([$letter]);

        Livewire::test(CreateLetter::class)
            ->fillForm([
                'direction' => 'OUT',
                'location_id' => $loc->id,
                'branch' => 'BGR',
                'type' => 'SURAT_TUGAS',
                'subject' => 'Surat Perjalanan Dinas',
                'date' => '2026-11-23',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('letters', [
            'subject' => 'Surat Perjalanan Dinas',
            'branch' => 'BGR',
        ]);
    }
}
