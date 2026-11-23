<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockLevel extends Model
{
    use HasFactory;

    protected $fillable = [
        'item_id',
        'product_id',
        'location_id',
        'qty',
        'min_stock',
        'safety_stock',
        'synced_at',
        'version',
    ];

    protected $casts = [
        'qty' => 'integer',
        'min_stock' => 'integer',
        'safety_stock' => 'integer',
        'version' => 'integer',
        'synced_at' => 'datetime',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}
