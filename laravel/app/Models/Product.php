<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'sku',
        'name',
        'unit',
        'selling_price',
        'cogs_price',
        'min_stock',
        'is_active',
    ];

    protected $casts = [
        'selling_price' => 'decimal:2',
        'cogs_price' => 'decimal:2',
        'min_stock' => 'integer',
        'is_active' => 'boolean',
    ];

    public function boms(): HasMany
    {
        return $this->hasMany(Bom::class);
    }

    public function productionSchedules(): HasMany
    {
        return $this->hasMany(ProductionSchedule::class);
    }

    public function productionLogs(): HasMany
    {
        return $this->hasMany(ProductionLog::class);
    }

    public function stockLevels(): HasMany
    {
        return $this->hasMany(StockLevel::class);
    }
}
