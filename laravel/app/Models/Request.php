<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Request extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'requests';

    protected $fillable = [
        'code',
        'requester_id',
        'location_id',
        'type',
        'title',
        'amount',
        'status',
        'current_approval_step',
        'notes',
        'receipt_path',
        'decided_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'current_approval_step' => 'integer',
        'decided_at' => 'datetime',
    ];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(RequestItem::class, 'request_id');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(Approval::class, 'request_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'code',
                'requester_id',
                'location_id',
                'type',
                'title',
                'amount',
                'status',
                'current_approval_step',
                'receipt_path',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
