<?php

namespace App\Filament\Widgets;

use App\Models\StockLevel;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;

class LowStockAlertWidget extends BaseWidget
{
    protected static ?int $sort = 2;

    protected int | string | array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->heading('Peringatan Stok Rendah (Low-Stock Alert)')
            ->description('Daftar komoditas dan bahan yang stoknya telah mencapai atau di bawah batas minimum.')
            ->query(function (): Builder {
                $user = auth()->user();
                $query = StockLevel::query()
                    ->with(['item', 'product', 'location'])
                    ->whereRaw('qty <= min_stock');

                if ($user && method_exists($user, 'hasRole') && ! $user->hasRole('super_admin')) {
                    $locationIds = $user->locations()->pluck('locations.id')->all();
                    if ($user->default_location_id) {
                        $locationIds[] = $user->default_location_id;
                    }
                    $locationIds = array_unique(array_filter($locationIds));

                    if (! empty($locationIds)) {
                        $query->whereIn('location_id', $locationIds);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                }

                return $query;
            })
            ->columns([
                Tables\Columns\TextColumn::make('location.name')
                    ->label('Lokasi Gudang')
                    ->sortable(),
                Tables\Columns\TextColumn::make('item_sku')
                    ->label('SKU')
                    ->getStateUsing(fn (StockLevel $record) => $record->item?->sku ?? $record->product?->sku ?? '-'),
                Tables\Columns\TextColumn::make('item_name')
                    ->label('Nama Barang / Produk')
                    ->getStateUsing(fn (StockLevel $record) => $record->item?->name ?? $record->product?->name ?? '-'),
                Tables\Columns\TextColumn::make('qty')
                    ->label('Stok Saat Ini')
                    ->color('danger')
                    ->weight('bold')
                    ->formatStateUsing(fn ($state, StockLevel $record) => number_format((float) $state, 2) . ' ' . ($record->item?->unit ?? $record->product?->unit ?? '')),
                Tables\Columns\TextColumn::make('min_stock')
                    ->label('Batas Minimum')
                    ->formatStateUsing(fn ($state, StockLevel $record) => number_format((float) $state, 2) . ' ' . ($record->item?->unit ?? $record->product?->unit ?? '')),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->getStateUsing(fn (StockLevel $record) => (float) $record->qty <= 0 ? 'HABIS' : 'MENIPIS')
                    ->color(fn (string $state) => $state === 'HABIS' ? 'danger' : 'warning'),
            ]);
    }
}
