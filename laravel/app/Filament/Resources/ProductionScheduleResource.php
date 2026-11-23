<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductionScheduleResource\Pages;
use App\Models\Bom;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductionSchedule;
use App\Models\ProductionTeam;
use App\Services\ProductionService;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ProductionScheduleResource extends Resource
{
    protected static ?string $model = ProductionSchedule::class;

    protected static ?string $navigationIcon = 'heroicon-o-calendar-days';

    protected static ?string $navigationGroup = 'Produksi';

    protected static ?string $navigationLabel = 'Jadwal & Hasil Produksi';

    protected static ?string $modelLabel = 'Jadwal Produksi';

    protected static ?string $pluralModelLabel = 'Jadwal & Hasil Produksi';

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
                Forms\Components\Section::make('Informasi Rencana Produksi')
                    ->schema([
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

                        Forms\Components\TextInput::make('period')
                            ->label('Periode (YYYY-MM)')
                            ->default(now()->format('Y-m'))
                            ->required()
                            ->maxLength(7),

                        Forms\Components\DatePicker::make('date')
                            ->label('Tanggal Pelaksanaan')
                            ->default(now()->toDateString()),

                        Forms\Components\Select::make('product_id')
                            ->label('Produk Jadi')
                            ->options(Product::pluck('name', 'id'))
                            ->searchable()
                            ->reactive()
                            ->required(),

                        Forms\Components\Select::make('bom_id')
                            ->label('Resep (BOM)')
                            ->options(function (Get $get) {
                                $productId = $get('product_id');
                                if (! $productId) {
                                    return Bom::pluck('name', 'id');
                                }
                                return Bom::where('product_id', $productId)->pluck('name', 'id');
                            })
                            ->searchable(),

                        Forms\Components\Select::make('team_id')
                            ->label('Tim Produksi')
                            ->options(function (Get $get) {
                                $locationId = $get('location_id');
                                if (! $locationId) {
                                    return ProductionTeam::pluck('name', 'id');
                                }
                                return ProductionTeam::where('location_id', $locationId)->pluck('name', 'id');
                            })
                            ->searchable(),

                        Forms\Components\TextInput::make('target_qty')
                            ->label('Target Produksi')
                            ->numeric()
                            ->default(0)
                            ->required(),

                        Forms\Components\Select::make('status')
                            ->label('Status')
                            ->options([
                                'SCHEDULED' => 'Dijadwalkan',
                                'IN_PROGRESS' => 'Sedang Berjalan',
                                'COMPLETED' => 'Selesai',
                                'CANCELLED' => 'Dibatalkan',
                            ])
                            ->default('SCHEDULED')
                            ->required(),
                    ])->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('location.name')
                    ->label('Cabang')
                    ->sortable(),
                Tables\Columns\TextColumn::make('period')
                    ->label('Periode')
                    ->sortable(),
                Tables\Columns\TextColumn::make('date')
                    ->label('Tanggal')
                    ->date('d M Y')
                    ->sortable(),
                Tables\Columns\TextColumn::make('product.name')
                    ->label('Produk Jadi')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('team.name')
                    ->label('Tim Produksi')
                    ->placeholder('Tanpa Tim')
                    ->sortable(),
                Tables\Columns\TextColumn::make('target_qty')
                    ->label('Target')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('actual_qty_sum')
                    ->label('Realisasi')
                    ->getStateUsing(fn (ProductionSchedule $record) => $record->logs()->sum('actual_qty'))
                    ->numeric(),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'SCHEDULED' => 'gray',
                        'IN_PROGRESS' => 'warning',
                        'COMPLETED' => 'success',
                        'CANCELLED' => 'danger',
                        default => 'gray',
                    }),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('location_id')
                    ->label('Cabang')
                    ->relationship('location', 'name'),
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'SCHEDULED' => 'Dijadwalkan',
                        'IN_PROGRESS' => 'Sedang Berjalan',
                        'COMPLETED' => 'Selesai',
                        'CANCELLED' => 'Dibatalkan',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('recordProduction')
                    ->label('Catat Hasil Produksi')
                    ->icon('heroicon-o-plus-circle')
                    ->color('success')
                    ->visible(fn (ProductionSchedule $record): bool => ! in_array($record->status, ['COMPLETED', 'CANCELLED']))
                    ->form([
                        Forms\Components\TextInput::make('produced_qty')
                            ->label('Jumlah Hasil Jadi')
                            ->numeric()
                            ->required()
                            ->minValue(1),
                        Forms\Components\TextInput::make('reject_qty')
                            ->label('Jumlah Rusak / Reject')
                            ->numeric()
                            ->default(0),
                        Forms\Components\DatePicker::make('date')
                            ->label('Tanggal Produksi')
                            ->default(now()->toDateString())
                            ->required(),
                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan Produksi')
                            ->placeholder('Catatan pengerjaan batch produksi...'),
                    ])
                    ->action(function (ProductionSchedule $record, array $data): void {
                        try {
                            app(ProductionService::class)->recordProduction([
                                'location_id' => $record->location_id,
                                'schedule_id' => $record->id,
                                'product_id' => $record->product_id,
                                'bom_id' => $record->bom_id,
                                'team_id' => $record->team_id,
                                'produced_qty' => $data['produced_qty'],
                                'reject_qty' => $data['reject_qty'] ?? 0,
                                'date' => $data['date'] ?? now()->toDateString(),
                                'notes' => $data['notes'] ?? null,
                                'created_by' => auth()->id(),
                            ]);

                            Notification::make()
                                ->title('Hasil produksi berhasil dicatat')
                                ->success()
                                ->send();
                        } catch (\Throwable $e) {
                            Notification::make()
                                ->title('Gagal mencatat hasil produksi')
                                ->body($e->getMessage())
                                ->danger()
                                ->send();
                        }
                    }),
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListProductionSchedules::route('/'),
            'create' => Pages\CreateProductionSchedule::route('/create'),
            'edit' => Pages\EditProductionSchedule::route('/{record}/edit'),
        ];
    }
}
