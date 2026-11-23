<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Attendance extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'user_id',
        'location_id',
        'type',
        'timestamp',
        'latitude',
        'longitude',
        'maps_url',
        'photo_path',
        'is_verified',
        'notes',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'is_verified' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'user_id',
                'location_id',
                'type',
                'timestamp',
                'latitude',
                'longitude',
                'maps_url',
                'photo_path',
                'is_verified',
                'notes',
            ])
            ->logOnlyDirty()
            ->useLogName('attendance')
            ->dontSubmitEmptyLogs();
    }
}
