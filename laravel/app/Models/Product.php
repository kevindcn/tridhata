<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
}
