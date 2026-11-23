<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockOpnameItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_opname_id',
        'item_id',
        'product_id',
        'system_qty',
        'counted_qty',
        'variance',
        'ocr_confidence',
        'flagged_manual',
    ];

    protected $casts = [
        'system_qty' => 'integer',
        'counted_qty' => 'integer',
        'variance' => 'integer',
        'ocr_confidence' => 'float',
        'flagged_manual' => 'boolean',
    ];

    public function stockOpname(): BelongsTo
    {
        return $this->belongsTo(StockOpname::class, 'stock_opname_id');
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
