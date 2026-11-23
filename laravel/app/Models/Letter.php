<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Letter extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'letter_number',
        'type',
        'direction',
        'location_id',
        'branch',
        'subject',
        'sender',
        'recipient',
        'date',
        'file_path',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logAll()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }

    protected static function booted(): void
    {
        static::saving(function (Letter $letter) {
            // Auto-detect branch from letter_number if empty
            if (empty($letter->branch) && ! empty($letter->letter_number)) {
                if (preg_match('/\/TAI-([A-Z0-9]+)\//i', $letter->letter_number, $matches)) {
                    $letter->branch = strtoupper($matches[1]);
                }
            }

            // Sync location_id from branch code if location_id is empty
            if (empty($letter->location_id) && ! empty($letter->branch)) {
                $location = Location::where('code', $letter->branch)
                    ->orWhere('name', 'like', "%{$letter->branch}%")
                    ->first();
                if ($location) {
                    $letter->location_id = $location->id;
                }
            }

            // Sync branch from location if branch is empty
            if (empty($letter->branch) && ! empty($letter->location_id)) {
                $location = Location::find($letter->location_id);
                if ($location) {
                    $letter->branch = $location->code ?? $location->name;
                }
            }
        });
    }

    /**
     * Location associated with this letter.
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    /**
     * User who created/archived this letter.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
