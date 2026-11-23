<?php

namespace App\Filament\Pages;

use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Services\InventoryService;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

class StockOpnameVerificationPage extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-check';

    protected static ?string $navigationGroup = 'Manajemen Stok';

    protected static ?string $navigationLabel = 'Verifikasi Opname';

    protected static ?string $title = 'Verifikasi Hasil Stock Opname & OCR';

    protected static string $view = 'filament.pages.stock-opname-verification-page';

    public ?int $record = null;
    public ?StockOpname $stockOpname = null;
    public array $items = [];

    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }

    public function mount(?int $record = null): void
    {
        $opnameId = $record ?? (int) request()->query('record');
        $this->record = $opnameId;

        if ($opnameId) {
            $this->stockOpname = StockOpname::with([
                'location',
                'creator',
                'items.item',
                'items.product',
            ])->find($opnameId);

            if ($this->stockOpname) {
                $this->authorizeAccess();
                $this->loadItems();
            }
        }
    }

    protected function authorizeAccess(): void
    {
        $user = auth()->user();
        if (! $user) {
            abort(403, 'Anda tidak memiliki hak akses ke cabang ini.');
        }

        if (method_exists($user, 'hasRole') && $user->hasRole('super_admin')) {
            return;
        }

        if (! $this->stockOpname) {
            return;
        }

        $locationIds = $user->locations()->pluck('locations.id')->all();
        if ($user->default_location_id) {
            $locationIds[] = $user->default_location_id;
        }
        $locationIds = array_unique(array_filter($locationIds));

        if (! in_array($this->stockOpname->location_id, $locationIds)) {
            abort(403, 'Anda tidak memiliki hak akses ke cabang ini.');
        }
    }

    protected function loadItems(): void
    {
        $this->items = $this->stockOpname->items->map(function (StockOpnameItem $item) {
            $master = $item->item ?? $item->product;
            return [
                'id' => $item->id,
                'sku' => $master?->sku ?? '-',
                'name' => $master?->name ?? 'Barang #' . $item->id,
                'unit' => $master?->unit ?? 'pcs',
                'system_qty' => $item->system_qty,
                'counted_qty' => $item->counted_qty,
                'variance' => $item->variance,
                'ocr_confidence' => $item->ocr_confidence,
                'flagged_manual' => (bool) $item->flagged_manual,
            ];
        })->toArray();
    }

    public function updateItemCount(int $index, int $newCount): void
    {
        $this->authorizeAccess();

        if (isset($this->items[$index])) {
            $this->items[$index]['counted_qty'] = $newCount;
            $this->items[$index]['variance'] = $newCount - $this->items[$index]['system_qty'];
            $this->items[$index]['flagged_manual'] = false; // Resolved by user

            // Persist to item
            $itemModel = StockOpnameItem::find($this->items[$index]['id']);
            if ($itemModel) {
                $itemModel->update([
                    'counted_qty' => $newCount,
                    'variance' => $newCount - $itemModel->system_qty,
                    'flagged_manual' => false,
                ]);
            }
        }
    }

    public function applyOpname(): void
    {
        $this->authorizeAccess();

        if (! $this->stockOpname) {
            Notification::make()->title('Data opname tidak ditemukan')->danger()->send();
            return;
        }

        // 1. Sync updated items from UI state
        foreach ($this->items as $row) {
            $itemModel = StockOpnameItem::find($row['id']);
            if ($itemModel) {
                $itemModel->update([
                    'counted_qty' => (int) $row['counted_qty'],
                    'variance' => ((int) $row['counted_qty']) - $itemModel->system_qty,
                    'flagged_manual' => (bool) $row['flagged_manual'],
                ]);
            }
        }

        // 2. Apply Stock Opname to create ADJUSTMENT StockMovement & align StockLevel
        $service = app(InventoryService::class);
        $service->applyStockOpname($this->stockOpname);

        $this->stockOpname->refresh();
        $this->loadItems();

        Notification::make()
            ->title('Hasil stock opname berhasil diterapkan dan stok telah disesuaikan.')
            ->success()
            ->send();
    }
}
