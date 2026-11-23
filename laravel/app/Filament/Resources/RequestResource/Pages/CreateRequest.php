<?php

namespace App\Filament\Resources\RequestResource\Pages;

use App\Filament\Resources\RequestResource;
use App\Services\ApprovalService;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateRequest extends CreateRecord
{
    protected static string $resource = RequestResource::class;

    protected function handleRecordCreation(array $data): Model
    {
        $user = auth()->user();
        $service = app(ApprovalService::class);

        if ($user && ! $service->canViewAllBranches($user)) {
            $accessibleLocationIds = $service->getUserLocationIds($user);

            if (! in_array((int) $data['location_id'], $accessibleLocationIds)) {
                Notification::make()
                    ->title('Akses Ditolak')
                    ->body('Anda tidak memiliki akses ke cabang / lokasi yang dipilih.')
                    ->danger()
                    ->send();

                $this->addError('data.location_id', 'Anda tidak memiliki akses ke cabang / lokasi yang dipilih.');
                $this->halt();
            }
        }

        try {
            return $service->submitRequest($data, $user);
        } catch (\Exception $e) {
            Notification::make()
                ->title('Gagal Membuat Pengajuan')
                ->body($e->getMessage())
                ->danger()
                ->send();

            $this->halt();
        }
    }
}
