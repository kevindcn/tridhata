<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RequestResource\Pages;
use App\Models\Item;
use App\Models\Location;
use App\Models\Request as ErpRequest;
use App\Services\ApprovalService;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Forms\Set;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class RequestResource extends Resource
{
    protected static ?string $model = ErpRequest::class;

    protected static ?string $navigationIcon = 'heroicon-o-document-check';

    protected static ?string $navigationGroup = 'Pengajuan & Pembelian';

    protected static ?string $navigationLabel = 'Pengajuan & Persetujuan';

    protected static ?string $modelLabel = 'Pengajuan';

    protected static ?string $pluralModelLabel = 'Pengajuan & Persetujuan';

    public static function getNavigationBadge(): ?string
    {
        $user = auth()->user();
        if (! $user) {
            return null;
        }

        $count = app(ApprovalService::class)->getPendingApprovalsCount($user);

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function getEloquentQuery(): Builder
    {
        $query = parent::getEloquentQuery();
        $user = auth()->user();

        if (! $user) {
            return $query;
        }

        $service = app(ApprovalService::class);
        if ($service->canViewAllBranches($user)) {
            return $query;
        }

        $locationIds = $service->getUserLocationIds($user);
        if (empty($locationIds)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('location_id', $locationIds);
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Informasi Pengajuan')
                    ->schema([
                        Forms\Components\Select::make('type')
                            ->label('Tipe Pengajuan')
                            ->options([
                                'RAW_MATERIAL' => 'Bahan Baku',
                                'OFFICE' => 'Operasional Kantor',
                                'RND' => 'RnD',
                                'TRANSFER' => 'Transfer Gudang',
                            ])
                            ->default('RAW_MATERIAL')
                            ->required(),
                        Forms\Components\Select::make('location_id')
                            ->label('Cabang / Lokasi')
                            ->options(function () {
                                $user = auth()->user();
                                if (! $user || app(ApprovalService::class)->canViewAllBranches($user)) {
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
                        Forms\Components\TextInput::make('title')
                            ->label('Judul Pengajuan')
                            ->placeholder('Contoh: Pengadaan bahan baku kopi Arabika')
                            ->required()
                            ->maxLength(255),
                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan Tambahan')
                            ->columnSpanFull(),
                    ])
                    ->columns(3),

                Forms\Components\Section::make('Rincian Barang / Biaya')
                    ->schema([
                        Forms\Components\Repeater::make('items')
                            ->relationship('items')
                            ->schema([
                                Forms\Components\Select::make('item_id')
                                    ->label('Barang (Opsional)')
                                    ->options(Item::where('is_active', true)->pluck('name', 'id'))
                                    ->searchable()
                                    ->nullable(),
                                Forms\Components\TextInput::make('qty')
                                    ->label('Jumlah')
                                    ->numeric()
                                    ->default(1)
                                    ->required()
                                    ->live()
                                    ->afterStateUpdated(function (Get $get, Set $set) {
                                        $qty = (float) $get('qty');
                                        $price = (float) $get('estimated_price');
                                        $set('total_price', $qty * $price);
                                    }),
                                Forms\Components\TextInput::make('estimated_price')
                                    ->label('Estimasi Harga Satuan (Rp)')
                                    ->numeric()
                                    ->default(0)
                                    ->required()
                                    ->live()
                                    ->afterStateUpdated(function (Get $get, Set $set) {
                                        $qty = (float) $get('qty');
                                        $price = (float) $get('estimated_price');
                                        $set('total_price', $qty * $price);
                                    }),
                                Forms\Components\TextInput::make('total_price')
                                    ->label('Total Harga (Rp)')
                                    ->numeric()
                                    ->readOnly()
                                    ->default(0),
                            ])
                            ->columns(4)
                            ->defaultItems(1),
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
                    ->sortable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('requester.name')
                    ->label('Pemohon')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('location.name')
                    ->label('Cabang / Lokasi')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('type')
                    ->label('Tipe')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'RAW_MATERIAL' => 'Bahan Baku',
                        'OFFICE' => 'Operasional Kantor',
                        'RND' => 'RnD',
                        'TRANSFER' => 'Transfer Gudang',
                        default => $state,
                    })
                    ->colors([
                        'primary' => 'RAW_MATERIAL',
                        'info' => 'OFFICE',
                        'warning' => 'RND',
                        'gray' => 'TRANSFER',
                    ]),
                Tables\Columns\TextColumn::make('amount')
                    ->label('Jumlah (Rp)')
                    ->formatStateUsing(fn ($state) => 'Rp ' . number_format((float) $state, 0, ',', '.'))
                    ->sortable(),
                Tables\Columns\TextColumn::make('current_approval_step')
                    ->label('Tahap')
                    ->badge()
                    ->formatStateUsing(fn (int $state): string => "Tahap {$state}"),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'PENDING' => 'warning',
                        'APPROVED' => 'success',
                        'REJECTED' => 'danger',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Tanggal')
                    ->dateTime('d M Y H:i')
                    ->sortable(),
            ])
            ->actions([
                Tables\Actions\Action::make('approve')
                    ->label('Setujui')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (ErpRequest $record): bool =>
                        $record->status === 'PENDING' &&
                        auth()->user() !== null &&
                        app(ApprovalService::class)->canApproveStep(auth()->user(), $record->current_approval_step)
                    )
                    ->form([
                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan Persetujuan (Opsional)')
                            ->placeholder('Catatan atau keterangan persetujuan...'),
                    ])
                    ->action(function (ErpRequest $record, array $data): void {
                        app(ApprovalService::class)->processDecision(
                            $record,
                            auth()->user(),
                            $record->current_approval_step,
                            'APPROVED',
                            $data['notes'] ?? null
                        );
                        Notification::make()
                            ->title('Pengajuan berhasil disetujui')
                            ->success()
                            ->send();
                    }),

                Tables\Actions\Action::make('reject')
                    ->label('Tolak')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (ErpRequest $record): bool =>
                        $record->status === 'PENDING' &&
                        auth()->user() !== null &&
                        app(ApprovalService::class)->canApproveStep(auth()->user(), $record->current_approval_step)
                    )
                    ->form([
                        Forms\Components\Textarea::make('notes')
                            ->label('Alasan Penolakan')
                            ->placeholder('Alasan mengapa pengajuan ditolak...')
                            ->required(),
                    ])
                    ->action(function (ErpRequest $record, array $data): void {
                        app(ApprovalService::class)->processDecision(
                            $record,
                            auth()->user(),
                            $record->current_approval_step,
                            'REJECTED',
                            $data['notes']
                        );
                        Notification::make()
                            ->title('Pengajuan ditolak')
                            ->danger()
                            ->send();
                    }),

                Tables\Actions\Action::make('uploadReceipt')
                    ->label('Upload Bukti Transfer / Nota')
                    ->icon('heroicon-o-arrow-up-tray')
                    ->color('primary')
                    ->form([
                        Forms\Components\FileUpload::make('receipt')
                            ->label('File Bukti Transfer / Nota')
                            ->disk('public')
                            ->directory('requests')
                            ->visibility('public')
                            ->acceptedFileTypes(['image/*', 'application/pdf'])
                            ->required(),
                    ])
                    ->action(function (ErpRequest $record, array $data): void {
                        app(ApprovalService::class)->attachReceipt($record, $data['receipt']);

                        Notification::make()
                            ->title('Bukti pembayaran berhasil diunggah')
                            ->success()
                            ->send();
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRequests::route('/'),
            'create' => Pages\CreateRequest::route('/create'),
        ];
    }
}
