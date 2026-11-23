<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use HasFactory;

    protected $fillable = [
        'sku',
        'name',
        'category',
        'unit',
        'min_stock',
        'safety_stock',
        'is_raw_material',
        'is_active',
    ];

    protected $casts = [
        'min_stock' => 'integer',
        'safety_stock' => 'integer',
        'is_raw_material' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function requestItems(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(RequestItem::class, 'item_id');
    }

    public function bomItems(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(BomItem::class, 'item_id');
    }
}
