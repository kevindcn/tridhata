<?php

namespace App\Filament\Resources;

use App\Filament\Resources\BomResource\Pages;
use App\Models\Bom;
use App\Models\Item;
use App\Models\Product;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class BomResource extends Resource
{
    protected static ?string $model = Bom::class;

    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-list';

    protected static ?string $navigationGroup = 'Produksi';

    protected static ?string $navigationLabel = 'Resep Produksi (BOM)';

    protected static ?string $modelLabel = 'Resep BOM';

    protected static ?string $pluralModelLabel = 'Resep Produksi (BOM)';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Informasi Resep (BOM)')
                    ->schema([
                        Forms\Components\Select::make('product_id')
                            ->label('Produk Jadi')
                            ->options(Product::pluck('name', 'id'))
                            ->searchable()
                            ->required(),
                        Forms\Components\TextInput::make('code')
                            ->label('Kode Resep / BOM')
                            ->required()
                            ->unique(ignoreRecord: true)
                            ->maxLength(255),
                        Forms\Components\TextInput::make('name')
                            ->label('Nama Resep')
                            ->required()
                            ->maxLength(255),
                        Forms\Components\TextInput::make('batch_size')
                            ->label('Ukuran Batch')
                            ->numeric()
                            ->default(1)
                            ->required(),
                        Forms\Components\TextInput::make('yield_unit')
                            ->label('Satuan Hasil')
                            ->default('pcs')
                            ->required()
                            ->maxLength(50),
                        Forms\Components\Toggle::make('is_active')
                            ->label('Status Aktif')
                            ->default(true),
                    ])->columns(2),

                Forms\Components\Section::make('Daftar Bahan Baku (BOM Items)')
                    ->schema([
                        Forms\Components\Repeater::make('items')
                            ->relationship('items')
                            ->schema([
                                Forms\Components\Select::make('item_id')
                                    ->label('Bahan Baku')
                                    ->options(Item::where('is_raw_material', true)->pluck('name', 'id'))
                                    ->searchable()
                                    ->required(),
                                Forms\Components\TextInput::make('quantity')
                                    ->label('Jumlah / Takaran')
                                    ->numeric()
                                    ->required(),
                                Forms\Components\TextInput::make('unit')
                                    ->label('Satuan')
                                    ->default('kg')
                                    ->required()
                                    ->maxLength(50),
                            ])
                            ->columns(3)
                            ->defaultItems(1)
                            ->addActionLabel('Tambah Bahan Baku'),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('code')
                    ->label('Kode')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('name')
                    ->label('Nama Resep')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('product.name')
                    ->label('Produk Jadi')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('batch_size')
                    ->label('Ukuran Batch')
                    ->sortable(),
                Tables\Columns\TextColumn::make('yield_unit')
                    ->label('Satuan'),
                Tables\Columns\IconColumn::make('is_active')
                    ->label('Status')
                    ->boolean(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Dibuat')
                    ->dateTime('d M Y H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active')
                    ->label('Status Aktif'),
            ])
            ->actions([
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
            'index' => Pages\ListBoms::route('/'),
            'create' => Pages\CreateBom::route('/create'),
            'edit' => Pages\EditBom::route('/{record}/edit'),
        ];
    }
}
