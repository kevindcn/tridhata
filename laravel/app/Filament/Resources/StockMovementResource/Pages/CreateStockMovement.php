<?php

namespace App\Filament\Resources\StockMovementResource\Pages;

use App\Filament\Resources\StockMovementResource;
use App\Services\InventoryService;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateStockMovement extends CreateRecord
{
    protected static string $resource = StockMovementResource::class;

    protected function handleRecordCreation(array $data): Model
    {
        return app(InventoryService::class)->recordMovement($data);
    }
}
