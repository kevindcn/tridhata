<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Item;
use App\Models\Location;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\StockOpname;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class InventoryService
{
    /**
     * Atomically records a stock movement, updating stock levels with pessimistic locking.
     *
     * @param array<string, mixed> $data
     * @return StockMovement
     * @throws \InvalidArgumentException
     */
    public function recordMovement(array $data): StockMovement
    {
        return DB::transaction(function () use ($data) {
            $type = $data['type'] instanceof StockMovementType
                ? $data['type']
                : StockMovementType::from((string) $data['type']);

            $locationId = (int) $data['location_id'];
            $targetLocationId = ! empty($data['target_location_id']) ? (int) $data['target_location_id'] : null;

            // Transfer validation & guard
            if ($type === StockMovementType::TRANSFER) {
                if (empty($targetLocationId)) {
                    throw new \InvalidArgumentException('Lokasi tujuan wajib dipilih untuk mutasi transfer.');
                }
                if ($locationId === $targetLocationId) {
                    throw new \InvalidArgumentException('Lokasi tujuan tidak boleh sama dengan lokasi asal.');
                }
            }

            $code = $data['code'] ?? $this->generateMovementCode($type);
            $userId = $data['created_by'] ?? auth()->id();

            $movement = StockMovement::create([
                'code' => $code,
                'type' => $type,
                'location_id' => $locationId,
                'target_location_id' => $targetLocationId,
                'reference_type' => $data['reference_type'] ?? null,
                'reference_id' => $data['reference_id'] ?? null,
                'date' => $data['date'] ?? now()->toDateString(),
                'notes' => $data['notes'] ?? null,
                'receipt_path' => $data['receipt_path'] ?? null,
                'status' => $data['status'] ?? 'COMPLETED',
                'created_by' => $userId,
            ]);

            $items = $data['items'] ?? [];

            // Helper to lock or create StockLevel for given location & item/product
            $getOrLockStockLevel = function (int $locId, ?int $itemId, ?int $productId): StockLevel {
                $stockLevel = StockLevel::where('location_id', $locId)
                    ->when($itemId, fn($q) => $q->where('item_id', $itemId))
                    ->when($productId, fn($q) => $q->where('product_id', $productId))
                    ->lockForUpdate()
                    ->first();

                if (! $stockLevel) {
                    $minStock = 0;
                    $safetyStock = 0;
                    if ($itemId) {
                        $masterItem = Item::find($itemId);
                        $minStock = (float) ($masterItem?->min_stock ?? 0);
                        $safetyStock = (float) ($masterItem?->safety_stock ?? 0);
                    } elseif ($productId) {
                        $masterProduct = Product::find($productId);
                        $minStock = (float) ($masterProduct?->min_stock ?? 0);
                    }

                    $stockLevel = StockLevel::create([
                        'location_id' => $locId,
                        'item_id' => $itemId,
                        'product_id' => $productId,
                        'qty' => 0,
                        'min_stock' => $minStock,
                        'safety_stock' => $safetyStock,
                        'version' => 1,
                    ]);
                }

                return $stockLevel;
            };

            foreach ($items as $itemData) {
                $itemId = ! empty($itemData['item_id']) ? (int) $itemData['item_id'] : null;
                $productId = ! empty($itemData['product_id']) ? (int) $itemData['product_id'] : null;
                $qty = round((float) ($itemData['qty'] ?? 0), 4);
                $unit = $itemData['unit'] ?? 'pcs';
                $unitPrice = (float) ($itemData['unit_price'] ?? 0);
                $totalPrice = (float) ($itemData['total_price'] ?? ($qty * $unitPrice));

                // Positive quantity validation
                if ($qty <= 0) {
                    throw new \InvalidArgumentException('Jumlah barang harus lebih besar dari 0.');
                }

                $entityName = $itemId
                    ? (Item::find($itemId)?->name ?? "Item #{$itemId}")
                    : (Product::find($productId)?->name ?? "Produk #{$productId}");

                // Apply movement logic with deterministic locking
                if ($type === StockMovementType::TRANSFER) {
                    // Deterministic lock ordering to avoid relational deadlocks
                    $firstLocId = min($locationId, $targetLocationId);
                    $secondLocId = max($locationId, $targetLocationId);

                    $firstLevel = $getOrLockStockLevel($firstLocId, $itemId, $productId);
                    $secondLevel = $getOrLockStockLevel($secondLocId, $itemId, $productId);

                    $sourceLevel = ($locationId === $firstLocId) ? $firstLevel : $secondLevel;
                    $targetLevel = ($targetLocationId === $firstLocId) ? $firstLevel : $secondLevel;

                    if ($sourceLevel->qty < $qty) {
                        throw new \InvalidArgumentException(
                            "Stok tidak mencukupi untuk {$entityName} di gudang asal. Stok tersedia: {$sourceLevel->qty}, jumlah diminta: {$qty}."
                        );
                    }

                    $sourceLevel->qty = round($sourceLevel->qty - $qty, 4);
                    $sourceLevel->version += 1;
                    $sourceLevel->save();

                    $targetLevel->qty = round($targetLevel->qty + $qty, 4);
                    $targetLevel->version += 1;
                    $targetLevel->save();
                } else {
                    $stockLevel = $getOrLockStockLevel($locationId, $itemId, $productId);

                    switch ($type) {
                        case StockMovementType::IN:
                        case StockMovementType::RETURN:
                            $stockLevel->qty = round($stockLevel->qty + $qty, 4);
                            $stockLevel->version += 1;
                            $stockLevel->save();
                            break;

                        case StockMovementType::OUT:
                        case StockMovementType::REJECT:
                            if ($stockLevel->qty < $qty) {
                                throw new \InvalidArgumentException(
                                    "Stok tidak mencukupi untuk {$entityName}. Stok tersedia: {$stockLevel->qty}, jumlah diminta: {$qty}."
                                );
                            }
                            $stockLevel->qty = round($stockLevel->qty - $qty, 4);
                            $stockLevel->version += 1;
                            $stockLevel->save();
                            break;

                        case StockMovementType::ADJUSTMENT:
                            $stockLevel->qty = round($stockLevel->qty + $qty, 4);
                            $stockLevel->version += 1;
                            $stockLevel->save();
                            break;
                    }
                }

                // Record movement line item
                $movement->items()->create([
                    'item_id' => $itemId,
                    'product_id' => $productId,
                    'qty' => $qty,
                    'unit' => $unit,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                ]);
            }

            // Log Spatie Activity
            $typeString = $type->value;
            activity('inventory')
                ->performedOn($movement)
                ->causedBy(auth()->user() ?? $movement->creator)
                ->withProperties([
                    'code' => $movement->code,
                    'type' => $typeString,
                    'location_id' => $movement->location_id,
                    'target_location_id' => $movement->target_location_id,
                    'items_count' => count($items),
                ])
                ->log("Stock movement recorded: {$movement->code} ({$typeString})");

            return $movement->loadMissing(['items.item', 'items.product', 'location', 'targetLocation', 'creator']);
        });
    }

    /**
     * Inter-warehouse stock transfer helper.
     *
     * @param string|int $sourceLocationId
     * @param string|int $targetLocationId
     * @param array<int, array<string, mixed>> $items
     * @param string|null $notes
     * @return StockMovement
     */
    public function transferBetweenWarehouses(
        string|int $sourceLocationId,
        string|int $targetLocationId,
        array $items,
        ?string $notes = null
    ): StockMovement {
        return $this->recordMovement([
            'type' => StockMovementType::TRANSFER,
            'location_id' => $sourceLocationId,
            'target_location_id' => $targetLocationId,
            'date' => now()->toDateString(),
            'notes' => $notes,
            'items' => $items,
        ]);
    }

    /**
     * Generates a Surat Jalan PDF and stores it on the public storage disk.
     *
     * @param StockMovement $movement
     * @return string Relative path in public storage: surat-jalan/{code}.pdf
     */
    public function generateSuratJalanPdf(StockMovement $movement): string
    {
        $movement->loadMissing(['location', 'targetLocation', 'items.item', 'items.product', 'creator']);

        $pdf = Pdf::loadView('pdf.surat-jalan', [
            'movement' => $movement,
        ]);

        $relativeDirectory = 'surat-jalan';
        Storage::disk('public')->makeDirectory($relativeDirectory);

        $relativePath = "{$relativeDirectory}/{$movement->code}.pdf";
        Storage::disk('public')->put($relativePath, $pdf->output());

        return $relativePath;
    }

    /**
     * Retrieves all stock levels currently below or equal to their configured min_stock.
     *
     * @param string|int $locationId
     * @return Collection<int, StockLevel>
     */
    public function getLowStockAlerts(string|int $locationId): Collection
    {
        return StockLevel::with(['item', 'product', 'location'])
            ->where('location_id', $locationId)
            ->whereRaw('qty <= min_stock')
            ->get();
    }

    /**
     * Applies a verified Stock Opname by creating an ADJUSTMENT StockMovement
     * and aligning actual StockLevels to counted quantities.
     *
     * @param StockOpname $opname
     * @return StockMovement
     */
    public function applyStockOpname(StockOpname $opname): StockMovement
    {
        return DB::transaction(function () use ($opname) {
            $opname->loadMissing(['items.item', 'items.product']);

            $userId = auth()->id() ?? $opname->created_by;
            $movementCode = $this->generateMovementCode(StockMovementType::ADJUSTMENT);

            $movement = StockMovement::create([
                'code' => $movementCode,
                'type' => StockMovementType::ADJUSTMENT,
                'location_id' => $opname->location_id,
                'target_location_id' => null,
                'reference_type' => StockOpname::class,
                'reference_id' => $opname->id,
                'date' => now()->toDateString(),
                'notes' => "Penyesuaian stok dari hasil Stock Opname {$opname->code}",
                'status' => 'COMPLETED',
                'created_by' => $userId,
            ]);

            foreach ($opname->items as $opnameItem) {
                $stockLevel = StockLevel::where('location_id', $opname->location_id)
                    ->when($opnameItem->item_id, fn ($q) => $q->where('item_id', $opnameItem->item_id))
                    ->when($opnameItem->product_id, fn ($q) => $q->where('product_id', $opnameItem->product_id))
                    ->lockForUpdate()
                    ->first();

                if (! $stockLevel) {
                    $stockLevel = StockLevel::create([
                        'location_id' => $opname->location_id,
                        'item_id' => $opnameItem->item_id,
                        'product_id' => $opnameItem->product_id,
                        'qty' => 0,
                        'version' => 1,
                    ]);
                }

                // Align stock level directly to counted_qty
                $stockLevel->qty = round((float) $opnameItem->counted_qty, 4);
                $stockLevel->version += 1;
                $stockLevel->synced_at = now();
                $stockLevel->save();

                $movement->items()->create([
                    'item_id' => $opnameItem->item_id,
                    'product_id' => $opnameItem->product_id,
                    'qty' => (float) $opnameItem->counted_qty,
                    'unit' => $opnameItem->item?->unit ?? 'pcs',
                    'unit_price' => 0,
                    'total_price' => 0,
                ]);
            }

            $opname->update(['status' => 'APPLIED']);

            activity('inventory')
                ->performedOn($movement)
                ->causedBy(auth()->user() ?? $opname->creator)
                ->withProperties([
                    'code' => $movement->code,
                    'type' => StockMovementType::ADJUSTMENT->value,
                    'stock_opname_id' => $opname->id,
                    'items_count' => $opname->items->count(),
                ])
                ->log("Stock Opname applied: {$opname->code} with adjustment {$movement->code}");

            return $movement->loadMissing(['items.item', 'items.product', 'location', 'creator']);
        });
    }

    /**
     * Generates a unique, readable movement code.
     */
    protected function generateMovementCode(StockMovementType $type): string
    {
        $prefix = match ($type) {
            StockMovementType::IN => 'SM-IN',
            StockMovementType::OUT => 'SM-OUT',
            StockMovementType::TRANSFER => 'SM-TRF',
            StockMovementType::RETURN => 'SM-RET',
            StockMovementType::REJECT => 'SM-REJ',
            StockMovementType::ADJUSTMENT => 'SM-ADJ',
        };

        $date = now()->format('Ymd');
        $random = strtoupper(bin2hex(random_bytes(3)));

        return "{$prefix}-{$date}-{$random}";
    }
}
