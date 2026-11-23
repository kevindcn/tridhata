<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ProductionSchedule extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'location_id',
        'period',
        'date',
        'product_id',
        'bom_id',
        'team_id',
        'target_qty',
        'status',
    ];

    protected $casts = [
        'target_qty' => 'integer',
        'date' => 'date',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function bom(): BelongsTo
    {
        return $this->belongsTo(Bom::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(ProductionTeam::class, 'team_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(ProductionLog::class, 'schedule_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['location_id', 'period', 'date', 'product_id', 'bom_id', 'team_id', 'target_qty', 'status'])
            ->logOnlyDirty()
            ->useLogName('production')
            ->dontSubmitEmptyLogs();
    }
}
