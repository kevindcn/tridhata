<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ProductionTeam extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'location_id',
        'name',
        'leader_name',
        'member_count',
        'daily_capacity',
        'is_active',
    ];

    protected $casts = [
        'member_count' => 'integer',
        'daily_capacity' => 'integer',
        'is_active' => 'boolean',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(ProductionSchedule::class, 'team_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(ProductionLog::class, 'team_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['location_id', 'name', 'leader_name', 'member_count', 'daily_capacity', 'is_active'])
            ->logOnlyDirty()
            ->useLogName('production')
            ->dontSubmitEmptyLogs();
    }
}
