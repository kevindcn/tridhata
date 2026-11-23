<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Bom extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'product_id',
        'code',
        'name',
        'batch_size',
        'yield_unit',
        'is_active',
    ];

    protected $casts = [
        'batch_size' => 'integer',
        'is_active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BomItem::class, 'bom_id');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(ProductionSchedule::class, 'bom_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['product_id', 'code', 'name', 'batch_size', 'yield_unit', 'is_active'])
            ->logOnlyDirty()
            ->useLogName('production')
            ->dontSubmitEmptyLogs();
    }
}
