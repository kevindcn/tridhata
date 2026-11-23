<?php

namespace App\Jobs;

use App\Models\Attendance;
use App\Services\WatermarkService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class StampAttendancePhotoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $attendanceId,
        public ?string $rawPhotoPath = null
    ) {}

    public function handle(WatermarkService $watermarkService): void
    {
        $attendance = Attendance::find($this->attendanceId);
        if (! $attendance) {
            return;
        }

        $photoSource = $this->rawPhotoPath;
        if (! $photoSource && $attendance->photo_path) {
            if (Storage::disk('public')->exists($attendance->photo_path)) {
                $photoSource = Storage::disk('public')->path($attendance->photo_path);
            } else {
                $photoSource = storage_path('app/public/' . $attendance->photo_path);
            }
        }

        if (! $photoSource || ! file_exists($photoSource)) {
            // Check if file contents are in virtual fake storage
            if ($attendance->photo_path && Storage::disk('public')->exists($attendance->photo_path)) {
                $photoSource = Storage::disk('public')->get($attendance->photo_path);
            } else {
                return;
            }
        }

        $stampedPath = $watermarkService->stampAttendancePhoto(
            $photoSource,
            (float) $attendance->latitude,
            (float) $attendance->longitude,
            $attendance->timestamp ? Carbon::parse($attendance->timestamp) : now()
        );

        $attendance->update([
            'photo_path' => $stampedPath,
            'is_verified' => true,
        ]);
    }
}
