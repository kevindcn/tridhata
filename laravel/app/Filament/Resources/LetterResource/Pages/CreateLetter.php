<?php

namespace App\Filament\Resources\LetterResource\Pages;

use App\Filament\Resources\LetterResource;
use App\Models\Location;
use App\Services\LetterNumberService;
use Filament\Resources\Pages\CreateRecord;

class CreateLetter extends CreateRecord
{
    protected static string $resource = LetterResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        if (empty($data['created_by'])) {
            $data['created_by'] = auth()->id();
        }

        if (empty($data['branch']) && ! empty($data['location_id'])) {
            $data['branch'] = Location::find($data['location_id'])?->code ?? 'BGR';
        }

        if (empty($data['letter_number'])) {
            $data['letter_number'] = app(LetterNumberService::class)->generateNextNumber(
                $data['direction'] ?? 'OUT',
                $data['branch'] ?? 'BGR',
                isset($data['date']) ? \Carbon\Carbon::parse($data['date']) : null,
                $data['type'] ?? null
            );
        }

        return $data;
    }
}
