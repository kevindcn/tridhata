<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SalesOrderResource\Pages;
use App\Models\Location;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Services\DocumentPdfService;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Forms\Set;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class SalesOrderResource extends Resource
{
    protected static ?string $model = SalesOrder::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-cart';

    protected static ?string $navigationGroup = 'Penjualan';

    protected static ?string $navigationLabel = 'Pesanan Penjualan (SO)';

    protected static ?string $modelLabel = 'Pesanan Penjualan';

    protected static ?string $pluralModelLabel = 'Pesanan Penjualan (SO)';

    public static function getEloquentQuery(): Builder
    {
        $query = parent::getEloquentQuery();
        $user = auth()->user();

        if (! $user) {
            return $query;
        }

        if (method_exists($user, 'hasRole') && $user->hasRole('super_admin')) {
            return $query;
        }

        $locationIds = $user->locations()->pluck('locations.id')->all();
        if ($user->default_location_id) {
            $locationIds[] = $user->default_location_id;
        }
        $locationIds = array_unique(array_filter($locationIds));

        if (empty($locationIds)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('location_id', $locationIds);
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Informasi Pesanan (SO)')
                    ->schema([
                        Forms\Components\TextInput::make('so_number')
                            ->label('Nomor SO')
                            ->required()
                            ->unique(ignoreRecord: true)
                            ->default(fn () => 'SO-' . date('Ymd') . '-' . rand(1000, 9999))
                            ->maxLength(255),
                        Forms\Components\TextInput::make('po_number')
                            ->label('Nomor PO Pelanggan')
                            ->placeholder('PO-XXX (Opsional)')
                            ->maxLength(255),
                        Forms\Components\TextInput::make('customer_name')
                            ->label('Nama Pelanggan / Institusi')
                            ->required()
                            ->maxLength(255),
                        Forms\Components\Select::make('channel')
                            ->label('Saluran Penjualan')
                            ->options([
                                'OFFLINE' => 'Penjualan Langsung / Offline',
                                'TOKOPEDIA' => 'Tokopedia',
                                'SHOPEE' => 'Shopee',
                                'TIKTOK' => 'TikTok Shop',
                                'DISTRIBUTOR' => 'Distributor / Agen',
                                'DIRECT' => 'Direct B2B',
                            ])
                            ->default('OFFLINE')
                            ->required(),
                        Forms\Components\Select::make('location_id')
                            ->label('Cabang / Lokasi')
                            ->options(function () {
                                $user = auth()->user();
                                if (! $user || (method_exists($user, 'hasRole') && $user->hasRole('super_admin'))) {
                                    return Location::pluck('name', 'id');
                                }
                                $locations = $user->locations;
                                if ($user->default_location_id && ! $locations->contains('id', $user->default_location_id)) {
                                    $defaultLoc = Location::find($user->default_location_id);
                                    if ($defaultLoc) {
                                        $locations = $locations->push($defaultLoc);
                                    }
                                }
                                return $locations->pluck('name', 'id');
                            })
                            ->default(fn () => auth()->user()?->default_location_id ?? auth()->user()?->locations()->first()?->id)
                            ->required(),
                        Forms\Components\DatePicker::make('date')
                            ->label('Tanggal Pesanan')
                            ->default(now())
                            ->required(),
                        Forms\Components\Select::make('status')
                            ->label('Status')
                            ->options([
                                'DRAFT' => 'Draft',
                                'CONFIRMED' => 'Terkonfirmasi (Confirmed)',
                                'PROCESSING' => 'Diproses (Processing)',
                                'SHIPPED' => 'Dikirim (Shipped)',
                                'COMPLETED' => 'Selesai (Completed)',
                                'CANCELLED' => 'Dibatalkan (Cancelled)',
                            ])
                            ->default('DRAFT')
                            ->required(),
                        Forms\Components\TextInput::make('total_amount')
                            ->label('Total Pesanan (Rp)')
                            ->numeric()
                            ->prefix('Rp')
                            ->default(0)
                            ->required(),
                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan Tambahan')
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Forms\Components\Section::make('Rincian Item Pesanan')
                    ->schema([
                        Forms\Components\Repeater::make('items')
                            ->relationship('items')
                            ->schema([
                                Forms\Components\Select::make('product_id')
                                    ->label('Produk')
                                    ->options(Product::where('is_active', true)->pluck('name', 'id'))
                                    ->searchable()
                                    ->required()
                                    ->live()
                                    ->afterStateUpdated(function (Get $get, Set $set, ?string $state) {
                                        if ($state) {
                                            $product = Product::find($state);
                                            if ($product) {
                                                $price = (float) $product->selling_price;
                                                $set('price', $price);
                                                $qty = (float) ($get('qty') ?? 1);
                                                $set('total', $price * $qty);
                                            }
                                        }
                                    }),
                                Forms\Components\TextInput::make('qty')
                                    ->label('Jumlah')
                                    ->numeric()
                                    ->default(1)
                                    ->required()
                                    ->live()
                                    ->afterStateUpdated(function (Get $get, Set $set) {
                                        $qty = (float) ($get('qty') ?? 0);
                                        $price = (float) ($get('price') ?? 0);
                                        $set('total', $qty * $price);
                                    }),
                                Forms\Components\TextInput::make('price')
                                    ->label('Harga Satuan (Rp)')
                                    ->numeric()
                                    ->prefix('Rp')
                                    ->default(0)
                                    ->required()
                                    ->live()
                                    ->afterStateUpdated(function (Get $get, Set $set) {
                                        $qty = (float) ($get('qty') ?? 0);
                                        $price = (float) ($get('price') ?? 0);
                                        $set('total', $qty * $price);
                                    }),
                                Forms\Components\TextInput::make('total')
                                    ->label('Total (Rp)')
                                    ->numeric()
                                    ->prefix('Rp')
                                    ->readOnly()
                                    ->default(0),
                            ])
                            ->columns(4)
                            ->defaultItems(1)
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('so_number')
                    ->label('Nomor SO')
                    ->searchable()
                    ->sortable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('date')
                    ->label('Tanggal')
                    ->date('d M Y')
                    ->sortable(),
                Tables\Columns\TextColumn::make('customer_name')
                    ->label('Pelanggan')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('channel')
                    ->label('Saluran')
                    ->badge()
                    ->color('info'),
                Tables\Columns\TextColumn::make('location.name')
                    ->label('Cabang')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'DRAFT' => 'gray',
                        'CONFIRMED' => 'info',
                        'PROCESSING' => 'warning',
                        'SHIPPED' => 'primary',
                        'COMPLETED' => 'success',
                        'CANCELLED' => 'danger',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('total_amount')
                    ->label('Total (Rp)')
                    ->money('IDR', locale: 'id')
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Dibuat')
                    ->dateTime('d M Y H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->label('Status')
                    ->options([
                        'DRAFT' => 'Draft',
                        'CONFIRMED' => 'Confirmed',
                        'PROCESSING' => 'Processing',
                        'SHIPPED' => 'Shipped',
                        'COMPLETED' => 'Completed',
                        'CANCELLED' => 'Cancelled',
                    ]),
                Tables\Filters\SelectFilter::make('channel')
                    ->label('Saluran')
                    ->options([
                        'OFFLINE' => 'Offline',
                        'TOKOPEDIA' => 'Tokopedia',
                        'SHOPEE' => 'Shopee',
                        'TIKTOK' => 'TikTok Shop',
                        'DISTRIBUTOR' => 'Distributor',
                        'DIRECT' => 'Direct B2B',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('downloadSalesOrder')
                    ->label('Unduh Sales Order (PDF)')
                    ->icon('heroicon-o-document-arrow-down')
                    ->color('primary')
                    ->action(function (SalesOrder $record) {
                        $pdfPath = app(DocumentPdfService::class)->generateSalesOrderPdf($record);

                        return response()->download(storage_path('app/public/' . $pdfPath), "{$record->so_number}.pdf");
                    }),

                Tables\Actions\Action::make('downloadInvoice')
                    ->label('Unduh Invoice (PDF)')
                    ->icon('heroicon-o-banknotes')
                    ->color('success')
                    ->action(function (SalesOrder $record) {
                        $pdfPath = app(DocumentPdfService::class)->generateInvoicePdf($record);

                        return response()->download(storage_path('app/public/' . $pdfPath), "INV-{$record->so_number}.pdf");
                    }),

                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSalesOrders::route('/'),
            'create' => Pages\CreateSalesOrder::route('/create'),
            'edit' => Pages\EditSalesOrder::route('/{record}/edit'),
        ];
    }
}
