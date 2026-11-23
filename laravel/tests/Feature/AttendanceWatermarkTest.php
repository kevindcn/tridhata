<?php

namespace Tests\Feature;

use App\Filament\Pages\AttendancePage;
use App\Filament\Resources\AttendanceResource;
use App\Jobs\StampAttendancePhotoJob;
use App\Models\Attendance;
use App\Models\Location;
use App\Models\User;
use App\Services\WatermarkService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AttendanceWatermarkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'kepala_cabang', 'guard_name' => 'web']);
    }

    public function test_stamps_photo_with_server_time_coords_and_maps_url(): void
    {
        $fakePhoto = UploadedFile::fake()->image('attendance.jpg', 800, 600);

        $service = app(WatermarkService::class);
        $serverTime = Carbon::now()->setTimezone('Asia/Jakarta');

        $stampedPath = $service->stampAttendancePhoto(
            $fakePhoto,
            -6.597147,
            106.806039,
            $serverTime
        );

        $this->assertNotEmpty($stampedPath);
        $this->assertStringStartsWith('attendance/', $stampedPath);
        $this->assertStringEndsWith('.jpg', $stampedPath);
        $this->assertFileExists(storage_path('app/public/' . $stampedPath));
    }

    public function test_stamp_attendance_photo_job_processes_watermarking(): void
    {
        $user = User::factory()->create();
        $fakePhoto = UploadedFile::fake()->image('raw_attendance.jpg', 640, 480);
        $tempPath = $fakePhoto->store('temp_attendance', 'public');

        $attendance = Attendance::create([
            'user_id' => $user->id,
            'type' => 'CLOCK_IN',
            'timestamp' => now(),
            'latitude' => -6.200000,
            'longitude' => 106.816666,
            'maps_url' => 'https://maps.google.com/?q=-6.200000,106.816666',
            'photo_path' => $tempPath,
            'is_verified' => false,
        ]);

        $job = new StampAttendancePhotoJob($attendance->id, storage_path('app/public/' . $tempPath));
        $job->handle(app(WatermarkService::class));

        $attendance->refresh();
        $this->assertStringStartsWith('attendance/', $attendance->photo_path);
        $this->assertFileExists(storage_path('app/public/' . $attendance->photo_path));
        $this->assertTrue($attendance->is_verified);
    }

    public function test_attendance_submission_saves_record_with_stamped_photo_and_maps_url(): void
    {
        $location = Location::factory()->create(['name' => 'Kebun Percobaan']);
        $user = User::factory()->create([
            'default_location_id' => $location->id,
        ]);
        $user->locations()->attach($location->id);

        $this->actingAs($user);

        $photo = UploadedFile::fake()->image('selfie.jpg', 640, 480);

        Livewire::test(AttendancePage::class)
            ->set('type', 'CLOCK_IN')
            ->set('photo', $photo)
            ->set('latitude', -6.597147)
            ->set('longitude', 106.806039)
            ->set('location_id', $location->id)
            ->call('submit')
            ->assertHasNoErrors()
            ->assertDispatched('attendance-submitted');

        $this->assertDatabaseHas('attendances', [
            'user_id' => $user->id,
            'location_id' => $location->id,
            'type' => 'CLOCK_IN',
            'latitude' => -6.597147,
            'longitude' => 106.806039,
        ]);

        $attendance = Attendance::where('user_id', $user->id)->latest()->first();
        $this->assertNotNull($attendance);
        $this->assertNotNull($attendance->photo_path);
        $this->assertStringContainsString('maps.google.com/?q=-6.597147,106.806039', $attendance->maps_url);
        $this->assertFileExists(storage_path('app/public/' . $attendance->photo_path));
    }

    public function test_attendance_validation_requires_photo_and_coordinates(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        Livewire::test(AttendancePage::class)
            ->set('type', 'CLOCK_IN')
            ->set('photo', null)
            ->set('latitude', null)
            ->set('longitude', null)
            ->call('submit')
            ->assertHasErrors(['photo', 'latitude', 'longitude']);
    }

    public function test_branch_scoping_on_attendance_resource(): void
    {
        $locationA = Location::factory()->create(['name' => 'Cabang Bogor']);
        $locationB = Location::factory()->create(['name' => 'Cabang Nganjuk']);

        $userBogor = User::factory()->create(['default_location_id' => $locationA->id]);
        $userBogor->locations()->attach($locationA->id);
        $userBogor->assignRole('kepala_cabang');

        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super_admin');

        $attendanceA = Attendance::create([
            'user_id' => $userBogor->id,
            'location_id' => $locationA->id,
            'type' => 'CLOCK_IN',
            'timestamp' => now(),
            'latitude' => -6.597147,
            'longitude' => 106.806039,
            'maps_url' => 'https://maps.google.com/?q=-6.597147,106.806039',
            'photo_path' => 'attendance/sample_a.jpg',
            'is_verified' => true,
        ]);

        $attendanceB = Attendance::create([
            'user_id' => $superAdmin->id,
            'location_id' => $locationB->id,
            'type' => 'CLOCK_IN',
            'timestamp' => now(),
            'latitude' => -7.600000,
            'longitude' => 112.000000,
            'maps_url' => 'https://maps.google.com/?q=-7.600000,112.000000',
            'photo_path' => 'attendance/sample_b.jpg',
            'is_verified' => true,
        ]);

        // Restricted user query scope
        $this->actingAs($userBogor);
        $this->assertTrue(AttendanceResource::getEloquentQuery()->where('id', $attendanceA->id)->exists());
        $this->assertFalse(AttendanceResource::getEloquentQuery()->where('id', $attendanceB->id)->exists());

        // Super admin sees all
        $this->actingAs($superAdmin);
        $this->assertTrue(AttendanceResource::getEloquentQuery()->where('id', $attendanceA->id)->exists());
        $this->assertTrue(AttendanceResource::getEloquentQuery()->where('id', $attendanceB->id)->exists());
    }
}
