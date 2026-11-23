<?php

namespace App\Filament\Resources;

use App\Filament\Resources\LetterResource\Pages;
use App\Models\Letter;
use App\Models\Location;
use App\Services\LetterNumberService;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Forms\Set;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;

class LetterResource extends Resource
{
    protected static ?string $model = Letter::class;

    protected static ?string $navigationIcon = 'heroicon-o-document-duplicate';

    protected static ?string $navigationGroup = 'Korespondensi';

    protected static ?string $navigationLabel = 'Arsip Surat & Dokumen';

    protected static ?string $modelLabel = 'Arsip Surat';

    protected static ?string $pluralModelLabel = 'Arsip Surat & Dokumen';

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

        $locationCodes = Location::whereIn('id', $locationIds)->pluck('code')->filter()->all();

        return $query->where(function (Builder $q) use ($locationIds, $locationCodes) {
            $q->whereIn('location_id', $locationIds);
            if (! empty($locationCodes)) {
                $q->orWhereIn('branch', $locationCodes);
            }
        });
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Informasi Dokumen Surat')
                    ->schema([
                        Forms\Components\Select::make('direction')
                            ->label('Arah Surat')
                            ->options([
                                'OUT' => 'Surat Keluar (OUT)',
                                'IN' => 'Surat Masuk (IN)',
                            ])
                            ->default('OUT')
                            ->required()
                            ->reactive()
                            ->afterStateUpdated(function (Set $set, Get $get, $state) {
                                self::autoUpdateLetterNumber($set, $get);
                            }),

                        Forms\Components\Select::make('location_id')
                            ->label('Cabang')
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
                            ->required()
                            ->reactive()
                            ->afterStateUpdated(function (Set $set, Get $get, $state) {
                                if ($state) {
                                    $loc = Location::find($state);
                                    if ($loc) {
                                        $set('branch', $loc->code ?? 'BGR');
                                    }
                                }
                                self::autoUpdateLetterNumber($set, $get);
                            }),

                        Forms\Components\Hidden::make('branch')
                            ->default('BGR'),

                        Forms\Components\Select::make('type')
                            ->label('Jenis Surat')
                            ->options([
                                'SURAT_TUGAS' => 'Surat Tugas',
                                'SURAT_PENAWARAN' => 'Surat Penawaran',
                                'SURAT_PERJANJIAN' => 'Surat Perjanjian',
                                'SURAT_MASUK_DINAS' => 'Surat Masuk Dinas',
                                'SURAT_KETERANGAN' => 'Surat Keterangan',
                                'SURAT_UNDANGAN' => 'Surat Undangan',
                                'LAINNYA' => 'Lainnya / Umum',
                            ])
                            ->default('SURAT_TUGAS')
                            ->required()
                            ->searchable(),

                        Forms\Components\TextInput::make('letter_number')
                            ->label('Nomor Surat')
                            ->required()
                            ->unique(ignoreRecord: true)
                            ->maxLength(255)
                            ->suffixAction(
                                Forms\Components\Actions\Action::make('generate_number')
                                    ->label('Generate')
                                    ->icon('heroicon-m-arrow-path')
                                    ->tooltip('Generate nomor surat otomatis sesuai urutan cabang')
                                    ->action(function (Set $set, Get $get) {
                                        $direction = $get('direction') ?? 'OUT';
                                        $locId = $get('location_id');
                                        $branchCode = $locId ? (Location::find($locId)?->code ?? 'BGR') : ($get('branch') ?? 'BGR');
                                        $date = $get('date') ? \Carbon\Carbon::parse($get('date')) : null;
                                        $type = $get('type');

                                        $number = app(LetterNumberService::class)->generateNextNumber(
                                            $direction,
                                            $branchCode,
                                            $date,
                                            $type
                                        );
                                        $set('letter_number', $number);
                                    })
                            ),

                        Forms\Components\DatePicker::make('date')
                            ->label('Tanggal Surat')
                            ->default(now())
                            ->required()
                            ->reactive()
                            ->afterStateUpdated(function (Set $set, Get $get, $state) {
                                self::autoUpdateLetterNumber($set, $get);
                            }),

                        Forms\Components\TextInput::make('subject')
                            ->label('Perihal Surat')
                            ->required()
                            ->maxLength(255)
                            ->columnSpanFull(),

                        Forms\Components\TextInput::make('sender')
                            ->label('Pengirim')
                            ->placeholder('PT Tridhata Agro / Pihak Luar')
                            ->maxLength(255),

                        Forms\Components\TextInput::make('recipient')
                            ->label('Penerima')
                            ->placeholder('Nama Lembaga / Karyawan')
                            ->maxLength(255),
                    ])->columns(2),

                Forms\Components\Section::make('Berkas & Lampiran')
                    ->schema([
                        Forms\Components\FileUpload::make('file_path')
                            ->label('Upload Berkas Surat (PDF/Gambar)')
                            ->disk('public')
                            ->directory('letters')
                            ->acceptedFileTypes([
                                'application/pdf',
                                'image/jpeg',
                                'image/png',
                                'application/msword',
                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            ])
                            ->maxSize(10240)
                            ->columnSpanFull(),

                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan Tambahan')
                            ->rows(3)
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    protected static function autoUpdateLetterNumber(Set $set, Get $get): void
    {
        $currentNumber = $get('letter_number');
        if (empty($currentNumber)) {
            $direction = $get('direction') ?? 'OUT';
            $locId = $get('location_id');
            $branchCode = $locId ? (Location::find($locId)?->code ?? 'BGR') : ($get('branch') ?? 'BGR');
            $date = $get('date') ? \Carbon\Carbon::parse($get('date')) : null;
            $type = $get('type');

            $number = app(LetterNumberService::class)->generateNextNumber(
                $direction,
                $branchCode,
                $date,
                $type
            );
            $set('letter_number', $number);
        }
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('letter_number')
                    ->label('Nomor Surat')
                    ->searchable()
                    ->sortable()
                    ->weight('bold'),

                Tables\Columns\TextColumn::make('direction')
                    ->label('Arah')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'IN' => 'success',
                        'OUT' => 'info',
                        default => 'gray',
                    })
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'IN' => 'Surat Masuk',
                        'OUT' => 'Surat Keluar',
                        default => $state,
                    })
                    ->sortable(),

                Tables\Columns\TextColumn::make('branch')
                    ->label('Cabang')
                    ->formatStateUsing(function ($state, Letter $record) {
                        if ($record->location) {
                            return $record->location->name;
                        }

                        return match (strtoupper($state ?? '')) {
                            'BGR' => 'Bogor',
                            'NGJ' => 'Nganjuk',
                            default => $state ?: '-',
                        };
                    })
                    ->sortable(),

                Tables\Columns\TextColumn::make('type')
                    ->label('Jenis')
                    ->badge()
                    ->formatStateUsing(fn ($state) => ucwords(strtolower(str_replace('_', ' ', $state))))
                    ->toggleable(),

                Tables\Columns\TextColumn::make('subject')
                    ->label('Perihal')
                    ->searchable()
                    ->limit(40),

                Tables\Columns\TextColumn::make('date')
                    ->label('Tanggal')
                    ->date('d M Y')
                    ->sortable(),

                Tables\Columns\TextColumn::make('sender')
                    ->label('Pengirim')
                    ->toggleable(isToggledHiddenByDefault: true),

                Tables\Columns\TextColumn::make('recipient')
                    ->label('Penerima')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('direction')
                    ->label('Arah Surat')
                    ->options([
                        'IN' => 'Surat Masuk',
                        'OUT' => 'Surat Keluar',
                    ]),
                Tables\Filters\SelectFilter::make('location_id')
                    ->label('Cabang')
                    ->relationship('location', 'name'),
            ])
            ->actions([
                Tables\Actions\Action::make('download')
                    ->label('Download Berkas')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->color('success')
                    ->visible(fn (Letter $record) => ! empty($record->file_path) && Storage::disk('public')->exists($record->file_path))
                    ->action(fn (Letter $record) => Storage::disk('public')->download($record->file_path)),

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
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLetters::route('/'),
            'create' => Pages\CreateLetter::route('/create'),
            'edit' => Pages\EditLetter::route('/{record}/edit'),
        ];
    }
}
