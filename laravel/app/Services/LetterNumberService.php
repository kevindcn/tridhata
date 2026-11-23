<?php

namespace App\Services;

use App\Models\Letter;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class LetterNumberService
{
    /**
     * Convert 1-based month number to Roman numeral.
     */
    public function toRoman(int $month): string
    {
        $map = [
            1 => 'I',
            2 => 'II',
            3 => 'III',
            4 => 'IV',
            5 => 'V',
            6 => 'VI',
            7 => 'VII',
            8 => 'VIII',
            9 => 'IX',
            10 => 'X',
            11 => 'XI',
            12 => 'XII',
        ];

        return $map[$month] ?? 'I';
    }

    /**
     * Generate the next auto-incremented standard letter number.
     * Format: {seq3}/TAI-{branchCode}/{direction}/{roman_month}/{year}
     * (e.g. 001/TAI-BGR/OUT/XI/2026)
     */
    public function generateNextNumber(
        string $direction,
        string $branchCode,
        ?Carbon $date = null,
        ?string $type = null
    ): string {
        $date = $date ? $date->copy() : Carbon::now();
        $year = (int) $date->format('Y');
        $month = (int) $date->format('n');
        $romanMonth = $this->toRoman($month);

        $normalizedBranch = match (strtoupper(trim($branchCode))) {
            'BOGOR', 'BGR' => 'BGR',
            'NGANJUK', 'NGJ' => 'NGJ',
            default => strtoupper(trim($branchCode)),
        };

        $normalizedDirection = match (strtoupper(trim($direction))) {
            'SURAT_KELUAR', 'KELUAR', 'OUT' => 'OUT',
            'SURAT_MASUK', 'MASUK', 'IN' => 'IN',
            default => strtoupper(trim($direction)),
        };

        return DB::transaction(function () use ($normalizedBranch, $normalizedDirection, $romanMonth, $year) {
            $existingLetterNumbers = Letter::where(function ($query) use ($normalizedBranch, $year) {
                $query->where('letter_number', 'like', "%/TAI-{$normalizedBranch}/%/{$year}")
                    ->orWhere(function ($q) use ($normalizedBranch, $year) {
                        $q->where('branch', $normalizedBranch)
                            ->whereYear('date', $year);
                    });
            })
                ->lockForUpdate()
                ->pluck('letter_number');

            $maxSeq = 0;
            foreach ($existingLetterNumbers as $num) {
                if (preg_match('/^(\d+)\//', $num, $matches)) {
                    $seq = (int) $matches[1];
                    if ($seq > $maxSeq) {
                        $maxSeq = $seq;
                    }
                }
            }

            $nextSeq = $maxSeq + 1;
            $seq3 = str_pad((string) $nextSeq, 3, '0', STR_PAD_LEFT);

            return "{$seq3}/TAI-{$normalizedBranch}/{$normalizedDirection}/{$romanMonth}/{$year}";
        });
    }
}
