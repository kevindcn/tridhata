<?php

namespace App\Filament\Resources;

use App\Enums\StockMovementType;
use App\Filament\Resources\StockMovementResource\Pages;
use App\Models\StockMovement;
use App\Services\InventoryService;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Storage;

class StockMovementResource extends Resource
{
    protected static ?string $model = StockMovement::class;

    protected static ?string $navigationIcon = 'heroicon-o-arrows-right-left';

    protected static ?string $navigationGroup = 'Manajemen Stok';

    protected static ?string $navigationLabel = 'Mutasi & Perpindahan Stok';

    protected static ?string $modelLabel = 'Mutasi Stok';

    protected static ?string $pluralModelLabel = 'Mutasi & Perpindahan Stok';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Informasi Mutasi')
                    ->schema([
                        Forms\Components\Select::make('type')
                            ->label('Tipe Mutasi')
                            ->options(StockMovementType::class)
                            ->required()
                            ->live(),
                        Forms\Components\Select::make('location_id')
                            ->label('Lokasi Asal / Gudang')
                            ->relationship('location', 'name')
                            ->searchable()
                            ->preload()
                            ->required(),
                        Forms\Components\Select::make('target_location_id')
                            ->label('Lokasi Tujuan (Gudang Penerima)')
                            ->relationship('targetLocation', 'name')
                            ->searchable()
                            ->preload()
                            ->visible(fn(Get $get) => in_array($get('type'), [
                                'TRANSFER',
                                StockMovementType::TRANSFER->value,
                                StockMovementType::TRANSFER,
                            ]))
                            ->required(fn(Get $get) => in_array($get('type'), [
                                'TRANSFER',
                                StockMovementType::TRANSFER->value,
                                StockMovementType::TRANSFER,
                            ])),
                        Forms\Components\DatePicker::make('date')
                            ->label('Tanggal Mutasi')
                            ->default(now())
                            ->required(),
                        Forms\Components\FileUpload::make('receipt_path')
                            ->label('Unggah Bukti / Surat Jalan')
                            ->disk('public')
                            ->directory('receipts')
                            ->acceptedFileTypes(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
                            ->columnSpanFull(),
                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan / Keterangan')
                            ->rows(3)
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Forms\Components\Section::make('Daftar Item')
                    ->schema([
                        Forms\Components\Repeater::make('items')
                            ->label('Item / Komoditas')
                            ->schema([
                                Forms\Components\Select::make('item_id')
                                    ->label('Bahan / Komoditas')
                                    ->options(fn () => \App\Models\Item::all()->mapWithKeys(fn ($item) => [$item->id => "[{$item->sku}] {$item->name}"]))
                                    ->searchable()
                                    ->required(),
                                Forms\Components\TextInput::make('qty')
                                    ->label('Jumlah')
                                    ->numeric()
                                    ->required()
                                    ->minValue(1),
                                Forms\Components\TextInput::make('unit')
                                    ->label('Satuan')
                                    ->default('kg')
                                    ->required(),
                                Forms\Components\TextInput::make('unit_price')
                                    ->label('Harga Satuan (Opsional)')
                                    ->numeric()
                                    ->default(0),
                            ])
                            ->columns(4)
                            ->defaultItems(1)
                            ->required(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('code')
                    ->label('Kode Mutasi')
                    ->searchable()
                    ->sortable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('type')
                    ->label('Tipe Mutasi')
                    ->badge()
                    ->sortable(),
                Tables\Columns\TextColumn::make('location.name')
                    ->label('Lokasi Asal')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('targetLocation.name')
                    ->label('Lokasi Tujuan')
                    ->placeholder('-')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('date')
                    ->label('Tanggal')
                    ->date('d M Y')
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn(string $state): string => match ($state) {
                        'COMPLETED' => 'success',
                        'PENDING' => 'warning',
                        'CANCELLED' => 'danger',
                        default => 'gray',
                    }),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('location_id')
                    ->label('Lokasi Gudang')
                    ->relationship('location', 'name'),
                Tables\Filters\SelectFilter::make('type')
                    ->label('Tipe Mutasi')
                    ->options(StockMovementType::class),
                Tables\Filters\Filter::make('date')
                    ->label('Rentang Tanggal')
                    ->form([
                        Forms\Components\DatePicker::make('from')->label('Dari Tanggal'),
                        Forms\Components\DatePicker::make('until')->label('Sampai Tanggal'),
                    ])
                    ->query(function ($query, array $data) {
                        return $query
                            ->when($data['from'], fn($q, $d) => $q->whereDate('date', '>=', $d))
                            ->when($data['until'], fn($q, $d) => $q->whereDate('date', '<=', $d));
                    }),
            ])
            ->actions([
                Tables\Actions\Action::make('download_surat_jalan')
                    ->label('Unduh Surat Jalan (PDF)')
                    ->icon('heroicon-o-document-arrow-down')
                    ->color('success')
                    ->visible(fn(StockMovement $record) => in_array($record->type, [
                        StockMovementType::OUT,
                        StockMovementType::TRANSFER,
                        'OUT',
                        'TRANSFER',
                    ]))
                    ->action(function (StockMovement $record, InventoryService $service) {
                        $path = $service->generateSuratJalanPdf($record);
                        return response()->download(Storage::disk('public')->path($path));
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStockMovements::route('/'),
            'create' => Pages\CreateStockMovement::route('/create'),
        ];
    }
}
