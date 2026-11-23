<?php

namespace App\Filament\Resources;

use App\Filament\Pages\StockOpnameVerificationPage;
use App\Filament\Resources\StockOpnameResource\Pages;
use App\Jobs\ProcessStockOpnameOcrJob;
use App\Models\Location;
use App\Models\StockOpname;
use Barryvdh\DomPDF\Facade\Pdf;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class StockOpnameResource extends Resource
{
    protected static ?string $model = StockOpname::class;

    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-check';

    protected static ?string $navigationGroup = 'Manajemen Stok';

    protected static ?string $navigationLabel = 'Stock Opname & OCR';

    protected static ?string $modelLabel = 'Stock Opname';

    protected static ?string $pluralModelLabel = 'Stock Opname & OCR';

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
                Forms\Components\Section::make('Informasi Stock Opname')
                    ->schema([
                        Forms\Components\TextInput::make('code')
                            ->label('Kode Opname')
                            ->required()
                            ->unique(ignoreRecord: true)
                            ->default(fn () => 'SO-' . date('Ymd') . '-' . rand(1000, 9999))
                            ->maxLength(255),
                        Forms\Components\Select::make('location_id')
                            ->label('Cabang / Gudang')
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
                            ->label('Tanggal Opname')
                            ->default(now())
                            ->required(),
                        Forms\Components\Select::make('status')
                            ->label('Status')
                            ->options([
                                'DRAFT' => 'Draf',
                                'OCR_PROCESSING' => 'Sedang Diproses OCR',
                                'VERIFIED' => 'Terverifikasi (Siap Terapkan)',
                                'APPLIED' => 'Selesai Diterapkan',
                                'OCR_FAILED' => 'Gagal OCR',
                            ])
                            ->default('DRAFT')
                            ->required(),
                        Forms\Components\FileUpload::make('form_photo_path')
                            ->label('Foto Formulir Opname (Opsional)')
                            ->disk('public')
                            ->directory('opnames')
                            ->image()
                            ->maxSize(10240)
                            ->columnSpanFull(),
                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan')
                            ->columnSpanFull(),
                    ])->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('code')
                    ->label('Kode Opname')
                    ->searchable()
                    ->sortable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('date')
                    ->label('Tanggal')
                    ->date('d M Y')
                    ->sortable(),
                Tables\Columns\TextColumn::make('location.name')
                    ->label('Cabang')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'DRAFT' => 'Draf',
                        'OCR_PROCESSING' => 'Sedang Diproses OCR',
                        'VERIFIED' => 'Terverifikasi',
                        'APPLIED' => 'Selesai Diterapkan',
                        'OCR_FAILED' => 'Gagal OCR',
                        default => $state,
                    })
                    ->color(fn (string $state): string => match ($state) {
                        'DRAFT' => 'gray',
                        'OCR_PROCESSING' => 'warning',
                        'VERIFIED' => 'info',
                        'APPLIED' => 'success',
                        'OCR_FAILED' => 'danger',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('total_variance')
                    ->label('Total Selisih')
                    ->sortable(),
                Tables\Columns\TextColumn::make('creator.name')
                    ->label('Petugas')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
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
                        'DRAFT' => 'Draf',
                        'OCR_PROCESSING' => 'Sedang Diproses OCR',
                        'VERIFIED' => 'Terverifikasi',
                        'APPLIED' => 'Selesai Diterapkan',
                        'OCR_FAILED' => 'Gagal OCR',
                    ]),
                Tables\Filters\SelectFilter::make('location_id')
                    ->label('Cabang')
                    ->relationship('location', 'name'),
            ])
            ->actions([
                Tables\Actions\Action::make('printTemplate')
                    ->label('Cetak Formulir Kosong (PDF)')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->action(function (StockOpname $record) {
                        $record->loadMissing(['location', 'creator', 'items.item', 'items.product']);
                        $pdf = Pdf::loadView('pdf.stock-opname-template', [
                            'opname' => $record,
                        ]);

                        return response()->streamDownload(
                            fn () => print($pdf->output()),
                            "{$record->code}-formulir.pdf"
                        );
                    }),

                Tables\Actions\Action::make('uploadPhoto')
                    ->label('Upload Foto Opname')
                    ->icon('heroicon-o-camera')
                    ->color('warning')
                    ->form([
                        Forms\Components\FileUpload::make('form_photo_path')
                            ->label('Unggah Foto Lembar Opname')
                            ->disk('public')
                            ->directory('opnames')
                            ->image()
                            ->required()
                            ->maxSize(10240),
                    ])
                    ->action(function (StockOpname $record, array $data) {
                        $record->update([
                            'form_photo_path' => $data['form_photo_path'],
                            'status' => 'OCR_PROCESSING',
                        ]);

                        ProcessStockOpnameOcrJob::dispatch($record);

                        Notification::make()
                            ->title('Foto berhasil diunggah. OCR sedang berjalan di latar belakang.')
                            ->info()
                            ->send();
                    }),

                Tables\Actions\Action::make('verifyResults')
                    ->label('Verifikasi Hasil')
                    ->icon('heroicon-o-check-badge')
                    ->color('success')
                    ->url(fn (StockOpname $record): string => StockOpnameVerificationPage::getUrl(['record' => $record->id])),

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
            'index' => Pages\ListStockOpnames::route('/'),
            'create' => Pages\CreateStockOpname::route('/create'),
        ];
    }
}
