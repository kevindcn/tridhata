<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AttendanceResource\Pages;
use App\Models\Attendance;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class AttendanceResource extends Resource
{
    protected static ?string $model = Attendance::class;

    protected static ?string $navigationIcon = 'heroicon-o-identification';

    protected static ?string $navigationGroup = 'Presensi';

    protected static ?string $navigationLabel = 'Data Presensi';

    protected static ?string $modelLabel = 'Presensi';

    protected static ?string $pluralModelLabel = 'Data Presensi';

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
                Forms\Components\Section::make('Detail Presensi')
                    ->schema([
                        Forms\Components\Select::make('user_id')
                            ->relationship('user', 'name')
                            ->label('Karyawan / Pengguna')
                            ->disabled(),
                        Forms\Components\Select::make('location_id')
                            ->relationship('location', 'name')
                            ->label('Lokasi Cabang')
                            ->disabled(),
                        Forms\Components\TextInput::make('type')
                            ->label('Jenis Presensi')
                            ->disabled(),
                        Forms\Components\DateTimePicker::make('timestamp')
                            ->label('Waktu Server (WIB)')
                            ->disabled(),
                        Forms\Components\TextInput::make('latitude')
                            ->label('Latitude')
                            ->disabled(),
                        Forms\Components\TextInput::make('longitude')
                            ->label('Longitude')
                            ->disabled(),
                        Forms\Components\TextInput::make('maps_url')
                            ->label('Google Maps URL')
                            ->url()
                            ->disabled(),
                        Forms\Components\Toggle::make('is_verified')
                            ->label('Terverifikasi')
                            ->disabled(),
                        Forms\Components\Textarea::make('notes')
                            ->label('Catatan')
                            ->disabled(),
                        Forms\Components\FileUpload::make('photo_path')
                            ->label('Foto Presensi (Watermark)')
                            ->disk('public')
                            ->image()
                            ->disabled()
                            ->columnSpanFull(),
                    ])->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('photo_path')
                    ->label('Foto')
                    ->disk('public')
                    ->square()
                    ->size(60),
                Tables\Columns\TextColumn::make('user.name')
                    ->label('Karyawan')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('location.name')
                    ->label('Lokasi / Cabang')
                    ->sortable()
                    ->placeholder('-'),
                Tables\Columns\TextColumn::make('type')
                    ->label('Tipe')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'CLOCK_IN' => 'Masuk',
                        'CLOCK_OUT' => 'Keluar',
                        default => $state,
                    })
                    ->color(fn (string $state): string => match ($state) {
                        'CLOCK_IN' => 'success',
                        'CLOCK_OUT' => 'warning',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('timestamp')
                    ->label('Waktu (WIB)')
                    ->dateTime('d M Y H:i:s')
                    ->sortable(),
                Tables\Columns\TextColumn::make('maps_url')
                    ->label('Lokasi GPS')
                    ->formatStateUsing(fn ($record) => $record->latitude ? number_format($record->latitude, 5) . ', ' . number_format($record->longitude, 5) : '-')
                    ->url(fn ($record) => $record->maps_url, true)
                    ->openUrlInNewTab()
                    ->color('primary')
                    ->icon('heroicon-m-map-pin'),
                Tables\Columns\IconColumn::make('is_verified')
                    ->label('Valid')
                    ->boolean(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Tercatat')
                    ->dateTime('d M Y H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('timestamp', 'desc')
            ->filters([
                Tables\Filters\SelectFilter::make('type')
                    ->label('Jenis Presensi')
                    ->options([
                        'CLOCK_IN' => 'Masuk (CLOCK_IN)',
                        'CLOCK_OUT' => 'Keluar (CLOCK_OUT)',
                    ]),
                Tables\Filters\SelectFilter::make('location_id')
                    ->label('Lokasi Cabang')
                    ->relationship('location', 'name'),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
            ])
            ->bulkActions([]);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAttendances::route('/'),
        ];
    }
}
