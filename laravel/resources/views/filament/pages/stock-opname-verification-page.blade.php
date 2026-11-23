<x-filament-panels::page>
    @if($stockOpname)
        <div class="space-y-6">
            {{-- Opname Header Information --}}
            <div class="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <span class="text-xs text-gray-500 uppercase tracking-wider">Kode Opname</span>
                        <p class="text-lg font-bold text-gray-900 dark:text-white">{{ $stockOpname->code }}</p>
                    </div>
                    <div>
                        <span class="text-xs text-gray-500 uppercase tracking-wider">Cabang / Lokasi</span>
                        <p class="text-base font-semibold text-gray-900 dark:text-white">{{ $stockOpname->location->name ?? '-' }}</p>
                    </div>
                    <div>
                        <span class="text-xs text-gray-500 uppercase tracking-wider">Tanggal</span>
                        <p class="text-base text-gray-900 dark:text-white">{{ $stockOpname->date ? \Carbon\Carbon::parse($stockOpname->date)->format('d M Y') : '-' }}</p>
                    </div>
                    <div>
                        <span class="text-xs text-gray-500 uppercase tracking-wider">Status</span>
                        <div>
                            @if($stockOpname->status === 'APPLIED')
                                <span class="badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    APPLIED (Diterapkan)
                                </span>
                            @elseif($stockOpname->status === 'VERIFIED')
                                <span class="badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    VERIFIED (Siap Diterapkan)
                                </span>
                            @else
                                <span class="badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    {{ $stockOpname->status }}
                                </span>
                            @endif
                        </div>
                    </div>
                </div>
            </div>

            {{-- Items Verification Table --}}
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">Daftar Barang & Hasil Hitung Fisik</h3>
                    <span class="text-xs text-gray-500">Periksa digit bertanda peringatan sebelum menerapkan</span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                            <tr>
                                <th class="px-4 py-3">No</th>
                                <th class="px-4 py-3">SKU</th>
                                <th class="px-4 py-3">Nama Barang</th>
                                <th class="px-4 py-3 text-center">Stok Sistem</th>
                                <th class="px-4 py-3 text-center">Hasil OCR / Hitung</th>
                                <th class="px-4 py-3 text-center">Selisih</th>
                                <th class="px-4 py-3 text-center">Akurasi OCR</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            @forelse($items as $idx => $row)
                                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td class="px-4 py-3">{{ $idx + 1 }}</td>
                                    <td class="px-4 py-3 font-semibold">{{ $row['sku'] }}</td>
                                    <td class="px-4 py-3">{{ $row['name'] }}</td>
                                    <td class="px-4 py-3 text-center">{{ $row['system_qty'] }} {{ $row['unit'] }}</td>
                                    <td class="px-4 py-3 text-center">
                                        @if($stockOpname->status !== 'APPLIED')
                                            <input
                                                type="number"
                                                wire:model.lazy="items.{{ $idx }}.counted_qty"
                                                value="{{ $row['counted_qty'] }}"
                                                class="w-24 text-center text-sm font-bold rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                                            />
                                        @else
                                            <span class="font-bold text-gray-900 dark:text-white">{{ $row['counted_qty'] }}</span>
                                        @endif
                                    </td>
                                    <td class="px-4 py-3 text-center font-bold {{ $row['variance'] < 0 ? 'text-red-600' : ($row['variance'] > 0 ? 'text-green-600' : 'text-gray-500') }}">
                                        {{ $row['variance'] > 0 ? '+' : '' }}{{ $row['variance'] }}
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        @if(!empty($row['flagged_manual']))
                                            <span class="badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                ⚠ Perlu Periksa Manual ({{ (int)(($row['ocr_confidence'] ?? 0) * 100) }}%)
                                            </span>
                                        @else
                                            <span class="badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                ✓ Akurat ({{ (int)(($row['ocr_confidence'] ?? 1.0) * 100) }}%)
                                            </span>
                                        @endif
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="7" class="px-4 py-6 text-center text-gray-500">
                                        Belum ada data barang pada opname ini.
                                    </td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>

            {{-- Action Buttons --}}
            <div class="flex justify-end gap-3">
                <a
                    href="{{ \App\Filament\Resources\StockOpnameResource::getUrl('index') }}"
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                >
                    Kembali
                </a>

                @if($stockOpname->status !== 'APPLIED')
                    <button
                        type="button"
                        wire:click="applyOpname"
                        wire:loading.attr="disabled"
                        class="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm flex items-center gap-2 focus:ring-4 focus:ring-primary-300"
                    >
                        <span wire:loading.remove wire:target="applyOpname">
                            Terapkan Hasil Opname
                        </span>
                        <span wire:loading wire:target="applyOpname">
                            Menerapkan Penyesuaian...
                        </span>
                    </button>
                @endif
            </div>
        </div>
    @else
        <div class="p-6 text-center text-gray-500 bg-white rounded-xl">
            Pilih rekaman Stock Opname untuk melakukan verifikasi hasil.
        </div>
    @endif
</x-filament-panels::page>
