<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ProductionLog extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'schedule_id',
        'product_id',
        'team_id',
        'actual_qty',
        'reject_qty',
        'date',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'actual_qty' => 'integer',
        'reject_qty' => 'integer',
        'date' => 'date',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(ProductionSchedule::class, 'schedule_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(ProductionTeam::class, 'team_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['schedule_id', 'product_id', 'team_id', 'actual_qty', 'reject_qty', 'date', 'notes', 'created_by'])
            ->logOnlyDirty()
            ->useLogName('production')
            ->dontSubmitEmptyLogs();
    }
}
