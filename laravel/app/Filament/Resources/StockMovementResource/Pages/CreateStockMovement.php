<?php

namespace App\Filament\Resources\StockMovementResource\Pages;

use App\Filament\Resources\StockMovementResource;
use App\Services\InventoryService;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateStockMovement extends CreateRecord
{
    protected static string $resource = StockMovementResource::class;

    protected function handleRecordCreation(array $data): Model
    {
        $user = auth()->user();
        if ($user && method_exists($user, 'hasRole') && ! $user->hasRole('super_admin')) {
            $accessibleLocationIds = $user->locations()->pluck('locations.id')->all();
            if ($user->default_location_id) {
                $accessibleLocationIds[] = $user->default_location_id;
            }
            $accessibleLocationIds = array_unique(array_filter($accessibleLocationIds));

            if (! in_array((int) $data['location_id'], $accessibleLocationIds)) {
                Notification::make()
                    ->title('Akses Ditolak')
                    ->body('Anda tidak memiliki akses ke lokasi gudang yang dipilih.')
                    ->danger()
                    ->send();

                $this->addError('data.location_id', 'Anda tidak memiliki akses ke lokasi gudang yang dipilih.');
                $this->halt();
            }
        }

        try {
            return app(InventoryService::class)->recordMovement($data);
        } catch (\InvalidArgumentException $e) {
            Notification::make()
                ->title('Gagal Mencatat Mutasi')
                ->body($e->getMessage())
                ->danger()
                ->send();

            $this->halt();
        }
    }
}
