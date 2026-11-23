<?php

namespace App\Filament\Pages;

use App\Models\Attendance;
use App\Models\Location;
use App\Services\WatermarkService;
use Carbon\Carbon;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Livewire\WithFileUploads;

class AttendancePage extends Page
{
    use WithFileUploads;

    protected static ?string $navigationIcon = 'heroicon-o-camera';

    protected static ?string $navigationGroup = 'Presensi';

    protected static ?string $navigationLabel = 'Presensi Lapangan';

    protected static ?string $title = 'Presensi Lapangan (Foto Kamera & GPS)';

    protected static string $view = 'livewire.attendance-camera';

    public string $type = 'CLOCK_IN';
    public $photo = null;
    public $latitude = null;
    public $longitude = null;
    public ?int $location_id = null;
    public ?string $notes = null;
    public ?string $gpsError = null;
    public ?string $successMessage = null;

    public function mount(): void
    {
        $user = auth()->user();
        if ($user) {
            $this->location_id = $user->default_location_id;
        }
    }

    public function updatedPhoto(): void
    {
        $this->validateOnly('photo', [
            'photo' => ['image', 'max:10240'],
        ], [
            'photo.image' => 'File harus berupa foto/gambar.',
            'photo.max' => 'Ukuran foto maksimal 10 MB.',
        ]);
    }

    public function submit(WatermarkService $watermarkService): void
    {
        $this->validate([
            'type' => ['required', 'in:CLOCK_IN,CLOCK_OUT'],
            'photo' => ['required', 'image', 'max:10240'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'location_id' => ['nullable', 'exists:locations,id'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'photo.required' => 'Foto presensi wajib diambil melalui kamera.',
            'photo.image' => 'File harus berupa foto/gambar.',
            'photo.max' => 'Ukuran foto maksimal 10 MB.',
            'latitude.required' => 'Koordinat GPS wajib diizinkan. Silakan aktifkan lokasi perangkat Anda.',
            'longitude.required' => 'Koordinat GPS wajib diizinkan. Silakan aktifkan lokasi perangkat Anda.',
            'type.required' => 'Pilih jenis presensi (Masuk atau Keluar).',
        ]);

        $serverTime = Carbon::now();
        $lat = (float) $this->latitude;
        $lng = (float) $this->longitude;

        $stampedPath = $watermarkService->stampAttendancePhoto(
            $this->photo,
            $lat,
            $lng,
            $serverTime
        );

        $mapsUrl = "https://maps.google.com/?q={$lat},{$lng}";
        $user = auth()->user();
        $locationId = $this->location_id ?: $user?->default_location_id;

        Attendance::create([
            'user_id' => auth()->id(),
            'location_id' => $locationId,
            'type' => $this->type,
            'timestamp' => $serverTime,
            'latitude' => $lat,
            'longitude' => $lng,
            'maps_url' => $mapsUrl,
            'photo_path' => $stampedPath,
            'is_verified' => true,
            'notes' => $this->notes,
        ]);

        $label = $this->type === 'CLOCK_IN' ? 'Masuk' : 'Keluar';
        $this->successMessage = "Presensi {$label} berhasil dicatat pada " . $serverTime->setTimezone('Asia/Jakarta')->format('d M Y H:i:s') . ' WIB.';

        Notification::make()
            ->title('Presensi Berhasil')
            ->body($this->successMessage)
            ->success()
            ->send();

        $this->dispatch('attendance-submitted');

        $this->reset(['photo', 'notes']);
    }

    public function getLocationsProperty()
    {
        $user = auth()->user();
        if (! $user) {
            return collect();
        }

        if (method_exists($user, 'hasRole') && $user->hasRole('super_admin')) {
            return Location::orderBy('name')->get();
        }

        $assigned = $user->locations()->orderBy('name')->get();
        if ($user->default_location_id && ! $assigned->contains('id', $user->default_location_id)) {
            $defaultLoc = Location::find($user->default_location_id);
            if ($defaultLoc) {
                $assigned->push($defaultLoc);
            }
        }

        return $assigned->isNotEmpty() ? $assigned : Location::orderBy('name')->get();
    }
}
