<?php

namespace App\Models;

use App\Enums\StockMovementType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class StockMovement extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'code',
        'type',
        'location_id',
        'target_location_id',
        'reference_type',
        'reference_id',
        'date',
        'notes',
        'receipt_path',
        'status',
        'created_by',
    ];

    protected $casts = [
        'type' => StockMovementType::class,
        'date' => 'date',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function targetLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'target_location_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockMovementItem::class, 'movement_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['code', 'type', 'location_id', 'target_location_id', 'status'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
