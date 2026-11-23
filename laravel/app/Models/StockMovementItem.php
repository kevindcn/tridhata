<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovementItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'movement_id',
        'item_id',
        'product_id',
        'qty',
        'unit',
        'unit_price',
        'total_price',
    ];

    protected $casts = [
        'qty' => 'float',
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function movement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'movement_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class, 'item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
