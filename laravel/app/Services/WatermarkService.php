<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

class WatermarkService
{
    protected ImageManager $manager;

    public function __construct(?ImageManager $manager = null)
    {
        $this->manager = $manager ?? new ImageManager(new Driver());
    }

    /**
     * Stamps an attendance photo with WIB timestamp, GPS coordinates, and Google Maps URL.
     *
     * @param mixed $photo UploadedFile, file path string, or image binary
     * @param float $lat
     * @param float $lng
     * @param Carbon $serverTime
     * @return string Relative public storage path (e.g. attendance/xxx.jpg)
     */
    public function stampAttendancePhoto(mixed $photo, float $lat, float $lng, Carbon $serverTime): string
    {
        $input = $photo;
        if ($photo instanceof UploadedFile) {
            $input = $photo->getRealPath();
        }

        $image = $this->manager->read($input);

        $width = $image->width();
        $height = $image->height();

        // Responsive banner height
        $bannerHeight = max(80, (int) round($height * 0.15));
        $bannerY = $height - $bannerHeight;

        // Dark semi-transparent rectangle banner at bottom
        $image->drawRectangle(0, $bannerY, function ($rectangle) use ($width, $bannerHeight) {
            $rectangle->size($width, $bannerHeight);
            $rectangle->background('rgba(0, 0, 0, 0.7)');
        });

        // Format timestamp in Asia/Jakarta (WIB)
        $wibFormatted = $serverTime->copy()->setTimezone('Asia/Jakarta')->format('Y-m-d H:i:s');
        $gpsFormatted = number_format($lat, 6) . ', ' . number_format($lng, 6);
        $mapsUrl = "maps.google.com/?q={$lat},{$lng}";

        $line1 = "WIB: {$wibFormatted}";
        $line2 = "GPS: {$gpsFormatted}";
        $line3 = $mapsUrl;

        $paddingLeft = max(15, (int) round($width * 0.03));
        $lineSpacing = (int) round($bannerHeight / 4);

        $line1Y = $bannerY + (int) round($lineSpacing * 1.0);
        $line2Y = $bannerY + (int) round($lineSpacing * 2.0);
        $line3Y = $bannerY + (int) round($lineSpacing * 3.0);

        // Draw white text lines
        $image->text($line1, $paddingLeft, $line1Y, function ($font) {
            $font->color('ffffff');
        });

        $image->text($line2, $paddingLeft, $line2Y, function ($font) {
            $font->color('ffffff');
        });

        $image->text($line3, $paddingLeft, $line3Y, function ($font) {
            $font->color('ffffff');
        });

        $encoded = $image->toJpeg(85);
        $encodedString = (string) $encoded;

        $filename = 'attendance/' . uniqid('att_', true) . '.jpg';

        // Store to public storage disk
        Storage::disk('public')->put($filename, $encodedString);

        // Also ensure it is physically written to storage_path('app/public/' . $filename)
        $fullDiskPath = storage_path('app/public/' . $filename);
        if (! file_exists($fullDiskPath)) {
            $directory = dirname($fullDiskPath);
            if (! is_dir($directory)) {
                @mkdir($directory, 0755, true);
            }
            @file_put_contents($fullDiskPath, $encodedString);
        }

        return $filename;
    }
}
