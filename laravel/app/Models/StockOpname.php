<?php

namespace App\Models;

use App\Services\InventoryService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class StockOpname extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'code',
        'location_id',
        'date',
        'status',
        'form_photo_path',
        'cropped_photo_path',
        'total_variance',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'total_variance' => 'integer',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockOpnameItem::class, 'stock_opname_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Applies this verified opname to align inventory levels.
     */
    public function apply(): StockMovement
    {
        return app(InventoryService::class)->applyStockOpname($this);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['code', 'location_id', 'status', 'total_variance'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
