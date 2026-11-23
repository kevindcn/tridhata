<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Item;
use App\Models\Location;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockMovement;
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

            $code = $data['code'] ?? $this->generateMovementCode($type);
            $userId = $data['created_by'] ?? auth()->id();

            $movement = StockMovement::create([
                'code' => $code,
                'type' => $type,
                'location_id' => $data['location_id'],
                'target_location_id' => $data['target_location_id'] ?? null,
                'reference_type' => $data['reference_type'] ?? null,
                'reference_id' => $data['reference_id'] ?? null,
                'date' => $data['date'] ?? now()->toDateString(),
                'notes' => $data['notes'] ?? null,
                'receipt_path' => $data['receipt_path'] ?? null,
                'status' => $data['status'] ?? 'COMPLETED',
                'created_by' => $userId,
            ]);

            $items = $data['items'] ?? [];

            foreach ($items as $itemData) {
                $itemId = $itemData['item_id'] ?? null;
                $productId = $itemData['product_id'] ?? null;
                $qty = (float) $itemData['qty'];
                $unit = $itemData['unit'] ?? 'pcs';
                $unitPrice = (float) ($itemData['unit_price'] ?? 0);
                $totalPrice = (float) ($itemData['total_price'] ?? ($qty * $unitPrice));

                // 1. Lock or initialize source location StockLevel
                $stockLevel = StockLevel::where('location_id', $movement->location_id)
                    ->when($itemId, fn($q) => $q->where('item_id', $itemId))
                    ->when($productId, fn($q) => $q->where('product_id', $productId))
                    ->lockForUpdate()
                    ->first();

                if (!$stockLevel) {
                    $minStock = 0;
                    $safetyStock = 0;
                    if ($itemId) {
                        $masterItem = Item::find($itemId);
                        $minStock = $masterItem?->min_stock ?? 0;
                        $safetyStock = $masterItem?->safety_stock ?? 0;
                    } elseif ($productId) {
                        $masterProduct = Product::find($productId);
                        $minStock = $masterProduct?->min_stock ?? 0;
                    }

                    $stockLevel = StockLevel::create([
                        'location_id' => $movement->location_id,
                        'item_id' => $itemId,
                        'product_id' => $productId,
                        'qty' => 0,
                        'min_stock' => $minStock,
                        'safety_stock' => $safetyStock,
                        'version' => 1,
                    ]);
                }

                // 2. Apply movement type logic
                switch ($type) {
                    case StockMovementType::IN:
                    case StockMovementType::RETURN:
                        $stockLevel->qty += (int) $qty;
                        $stockLevel->version += 1;
                        $stockLevel->save();
                        break;

                    case StockMovementType::OUT:
                    case StockMovementType::REJECT:
                        if ($stockLevel->qty < $qty) {
                            $identifier = $itemId ? "item {$itemId}" : "product {$productId}";
                            throw new \InvalidArgumentException(
                                "Insufficient stock for {$identifier}. Available: {$stockLevel->qty}, requested: {$qty}"
                            );
                        }
                        $stockLevel->qty -= (int) $qty;
                        $stockLevel->version += 1;
                        $stockLevel->save();
                        break;

                    case StockMovementType::TRANSFER:
                        if ($stockLevel->qty < $qty) {
                            $identifier = $itemId ? "item {$itemId}" : "product {$productId}";
                            throw new \InvalidArgumentException(
                                "Insufficient stock for {$identifier} at source warehouse. Available: {$stockLevel->qty}, requested: {$qty}"
                            );
                        }
                        $stockLevel->qty -= (int) $qty;
                        $stockLevel->version += 1;
                        $stockLevel->save();

                        // Target location lock or create
                        if ($movement->target_location_id) {
                            $targetLevel = StockLevel::where('location_id', $movement->target_location_id)
                                ->when($itemId, fn($q) => $q->where('item_id', $itemId))
                                ->when($productId, fn($q) => $q->where('product_id', $productId))
                                ->lockForUpdate()
                                ->first();

                            if (!$targetLevel) {
                                $targetLevel = StockLevel::create([
                                    'location_id' => $movement->target_location_id,
                                    'item_id' => $itemId,
                                    'product_id' => $productId,
                                    'qty' => 0,
                                    'min_stock' => $stockLevel->min_stock,
                                    'safety_stock' => $stockLevel->safety_stock,
                                    'version' => 1,
                                ]);
                            }

                            $targetLevel->qty += (int) $qty;
                            $targetLevel->version += 1;
                            $targetLevel->save();
                        }
                        break;

                    case StockMovementType::ADJUSTMENT:
                        $stockLevel->qty += (int) $qty;
                        $stockLevel->version += 1;
                        $stockLevel->save();
                        break;
                }

                // 3. Record item record
                $movement->items()->create([
                    'item_id' => $itemId,
                    'product_id' => $productId,
                    'qty' => $qty,
                    'unit' => $unit,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                ]);
            }

            // 4. Log Spatie Activity
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
