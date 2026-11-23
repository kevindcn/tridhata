<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class SalesOrder extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'so_number',
        'po_number',
        'customer_name',
        'channel',
        'location_id',
        'date',
        'status',
        'total_amount',
        'pdf_path',
        'notes',
    ];

    protected $casts = [
        'date' => 'date',
        'total_amount' => 'decimal:2',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class, 'sales_order_id');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class, 'sales_order_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['so_number', 'po_number', 'customer_name', 'channel', 'location_id', 'date', 'status', 'total_amount', 'notes'])
            ->logOnlyDirty()
            ->useLogName('sales')
            ->dontSubmitEmptyLogs();
    }
}
