<?php

namespace App\Enums;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

enum StockMovementType: string implements HasLabel, HasColor
{
    case IN = 'IN';
    case OUT = 'OUT';
    case TRANSFER = 'TRANSFER';
    case RETURN = 'RETURN';
    case REJECT = 'REJECT';
    case ADJUSTMENT = 'ADJUSTMENT';

    public function getLabel(): ?string
    {
        return match ($this) {
            self::IN => 'Barang Masuk (IN)',
            self::OUT => 'Barang Keluar (OUT)',
            self::TRANSFER => 'Perpindahan / Transfer (TRANSFER)',
            self::RETURN => 'Pengembalian / Retur (RETURN)',
            self::REJECT => 'Barang Ditolak / Reject (REJECT)',
            self::ADJUSTMENT => 'Penyesuaian Stok (ADJUSTMENT)',
        };
    }

    public function getColor(): string | array | null
    {
        return match ($this) {
            self::IN => 'success',
            self::OUT => 'danger',
            self::TRANSFER => 'info',
            self::RETURN => 'warning',
            self::REJECT => 'danger',
            self::ADJUSTMENT => 'gray',
        };
    }
}
