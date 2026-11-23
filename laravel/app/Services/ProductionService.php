<?php

namespace App\Services;

use App\Models\Bom;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductionLog;
use App\Models\ProductionSchedule;
use App\Models\ProductionTeam;
use App\Models\StockLevel;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProductionService
{
    /**
     * Atomically records production output, deducting raw materials and incrementing finished goods.
     *
     * @param array<string, mixed> $data
     * @return ProductionLog
     * @throws \InvalidArgumentException
     */
    public function recordProduction(array $data): ProductionLog
    {
        return DB::transaction(function () use ($data) {
            $locationId = (int) $data['location_id'];
            $productId = (int) $data['product_id'];
            $producedQty = (float) $data['produced_qty'];
            $rejectQty = isset($data['reject_qty']) ? (float) $data['reject_qty'] : 0.0;
            $date = $data['date'] ?? now()->toDateString();
            $scheduleId = ! empty($data['schedule_id']) ? (int) $data['schedule_id'] : null;
            $teamId = ! empty($data['team_id']) ? (int) $data['team_id'] : null;
            $notes = $data['notes'] ?? null;
            $createdBy = $data['created_by'] ?? auth()->id();

            if ($producedQty <= 0) {
                throw new \InvalidArgumentException('Jumlah produksi harus lebih besar dari 0.');
            }

            // Resolve BOM
            if (! empty($data['bom_id'])) {
                $bom = Bom::with('items.item')->findOrFail($data['bom_id']);
            } else {
                $bom = Bom::with('items.item')
                    ->where('product_id', $productId)
                    ->where('is_active', true)
                    ->first();

                if (! $bom) {
                    throw new \InvalidArgumentException("Resep BOM aktif tidak ditemukan untuk produk ID {$productId}.");
                }
            }

            $batchSize = (float) ($bom->batch_size > 0 ? $bom->batch_size : 1);
            $multiplier = $producedQty / $batchSize;

            // 1. Validate raw material availability atomically
            foreach ($bom->items as $bomItem) {
                $requiredQty = $multiplier * (float) $bomItem->quantity;
                $rawStock = StockLevel::where('location_id', $locationId)
                    ->where('item_id', $bomItem->item_id)
                    ->lockForUpdate()
                    ->first();

                $availableQty = $rawStock ? (float) $rawStock->qty : 0.0;
                if ($availableQty < $requiredQty) {
                    $itemName = $bomItem->item?->name ?? "Item ID {$bomItem->item_id}";
                    throw new \InvalidArgumentException(
                        "Stok bahan baku tidak mencukupi untuk {$itemName}. Dibutuhkan: {$requiredQty}, Tersedia: {$availableQty}"
                    );
                }
            }

            // 2. Decrement raw material stocks
            foreach ($bom->items as $bomItem) {
                $requiredQty = $multiplier * (float) $bomItem->quantity;
                $rawStock = StockLevel::where('location_id', $locationId)
                    ->where('item_id', $bomItem->item_id)
                    ->lockForUpdate()
                    ->first();

                if ($rawStock) {
                    $rawStock->qty = (float) $rawStock->qty - $requiredQty;
                    $rawStock->version = ($rawStock->version ?? 1) + 1;
                    $rawStock->save();
                }
            }

            // 3. Atomically increment finished good stock
            $productStock = StockLevel::where('location_id', $locationId)
                ->where('product_id', $productId)
                ->lockForUpdate()
                ->first();

            if (! $productStock) {
                $masterProduct = Product::find($productId);
                $productStock = StockLevel::create([
                    'location_id' => $locationId,
                    'product_id' => $productId,
                    'qty' => 0,
                    'min_stock' => (float) ($masterProduct?->min_stock ?? 0),
                    'safety_stock' => 0,
                    'version' => 1,
                ]);
            }

            $productStock->qty = (float) $productStock->qty + $producedQty;
            $productStock->version = ($productStock->version ?? 1) + 1;
            $productStock->save();

            // 4. Create ProductionLog
            $log = ProductionLog::create([
                'schedule_id' => $scheduleId,
                'product_id' => $productId,
                'team_id' => $teamId,
                'actual_qty' => (int) round($producedQty),
                'reject_qty' => (int) round($rejectQty),
                'date' => $date,
                'notes' => $notes,
                'created_by' => $createdBy,
            ]);

            // 5. Update ProductionSchedule if supplied
            if ($scheduleId) {
                $schedule = ProductionSchedule::find($scheduleId);
                if ($schedule) {
                    $totalProduced = (int) $schedule->logs()->sum('actual_qty');
                    if ($schedule->target_qty > 0 && $totalProduced >= $schedule->target_qty) {
                        $schedule->status = 'COMPLETED';
                    } else {
                        $schedule->status = 'IN_PROGRESS';
                    }
                    $schedule->save();
                }
            }

            // 6. Record Spatie Activity log
            activity('production')
                ->performedOn($log)
                ->causedBy($createdBy ? User::find($createdBy) : null)
                ->withProperties([
                    'location_id' => $locationId,
                    'product_id' => $productId,
                    'bom_id' => $bom->id,
                    'produced_qty' => $producedQty,
                    'reject_qty' => $rejectQty,
                    'schedule_id' => $scheduleId,
                ])
                ->log("Mencatat hasil produksi: {$producedQty} unit untuk produk ID {$productId}");

            return $log;
        });
    }

    /**
     * Calculates raw material needs based on BOM recipe for a target quantity.
     *
     * @param Product $product
     * @param float $targetQty
     * @param Bom|null $bom
     * @return Collection
     */
    public function calculateMaterialRequirements(Product $product, float $targetQty, ?Bom $bom = null): Collection
    {
        if ($bom === null) {
            $bom = Bom::with('items.item')
                ->where('product_id', $product->id)
                ->where('is_active', true)
                ->first();

            if (! $bom) {
                throw new \InvalidArgumentException("Resep BOM aktif tidak ditemukan untuk produk {$product->name}.");
            }
        } else {
            $bom->loadMissing('items.item');
        }

        $batchSize = (float) ($bom->batch_size > 0 ? $bom->batch_size : 1);
        $multiplier = $targetQty / $batchSize;

        return collect($bom->items->map(function ($bomItem) use ($multiplier) {
            $required = (float) ($multiplier * (float) $bomItem->quantity);

            return [
                'item_id' => $bomItem->item_id,
                'item' => $bomItem->item,
                'item_name' => $bomItem->item?->name,
                'item_sku' => $bomItem->item?->sku,
                'quantity_per_batch' => (float) $bomItem->quantity,
                'required_qty' => $required,
                'unit' => $bomItem->unit,
            ];
        }));
    }

    /**
     * Calculates actual vs target productivity and reject rate per team.
     *
     * @param string $locationId
     * @param string|null $period
     * @return Collection
     */
    public function getTeamProductivitySummary(string $locationId, ?string $period = null): Collection
    {
        $period = $period ?? now()->format('Y-m');

        $teams = ProductionTeam::where('location_id', $locationId)->get();

        return collect($teams->map(function (ProductionTeam $team) use ($locationId, $period) {
            $targetQty = (int) ProductionSchedule::where('team_id', $team->id)
                ->where('location_id', $locationId)
                ->where('period', $period)
                ->sum('target_qty');

            $logsQuery = ProductionLog::where('team_id', $team->id)
                ->where(function ($q) use ($period, $locationId) {
                    $q->where('date', 'like', "{$period}%")
                        ->orWhereHas('schedule', function ($sq) use ($period, $locationId) {
                            $sq->where('period', $period)
                                ->where('location_id', $locationId);
                        });
                });

            $actualQty = (int) (clone $logsQuery)->sum('actual_qty');
            $rejectQty = (int) (clone $logsQuery)->sum('reject_qty');

            $achievementPct = $targetQty > 0
                ? round(($actualQty / $targetQty) * 100, 2)
                : 0.0;

            $totalProduced = $actualQty + $rejectQty;
            $rejectRatePct = $totalProduced > 0
                ? round(($rejectQty / $totalProduced) * 100, 2)
                : 0.0;

            return [
                'team_id' => $team->id,
                'team_name' => $team->name,
                'leader_name' => $team->leader_name,
                'member_count' => $team->member_count,
                'daily_capacity' => $team->daily_capacity,
                'target_qty' => $targetQty,
                'actual_qty' => $actualQty,
                'reject_qty' => $rejectQty,
                'achievement_pct' => $achievementPct,
                'reject_rate_pct' => $rejectRatePct,
            ];
        }));
    }
}
