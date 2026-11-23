<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Delivery extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'sj_number',
        'sales_order_id',
        'location_id',
        'date',
        'driver_name',
        'vehicle_no',
        'status',
        'pdf_path',
        'notes',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'sales_order_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['sj_number', 'sales_order_id', 'location_id', 'date', 'driver_name', 'vehicle_no', 'status', 'notes'])
            ->logOnlyDirty()
            ->useLogName('deliveries')
            ->dontSubmitEmptyLogs();
    }
}
