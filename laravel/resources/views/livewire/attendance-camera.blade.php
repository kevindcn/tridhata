<x-filament-panels::page>
    <div class="max-w-2xl mx-auto space-y-6" x-data="attendanceCamera()">
        @if ($successMessage)
            <div class="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h4 class="font-semibold">Berhasil!</h4>
                        <p class="text-sm mt-0.5">{{ $successMessage }}</p>
                    </div>
                </div>
            </div>
        @endif

        <div class="bg-white dark:bg-gray-850 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
            <!-- Type Selector: CLOCK_IN / CLOCK_OUT -->
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jenis Presensi</label>
                <div class="grid grid-cols-2 gap-4">
                    <button type="button"
                            wire:click="$set('type', 'CLOCK_IN')"
                            class="py-3 px-4 rounded-lg font-medium text-center border transition {{ $type === 'CLOCK_IN' ? 'bg-primary-600 text-white border-primary-600 shadow' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700' }}">
                        Masuk (Clock In)
                    </button>
                    <button type="button"
                            wire:click="$set('type', 'CLOCK_OUT')"
                            class="py-3 px-4 rounded-lg font-medium text-center border transition {{ $type === 'CLOCK_OUT' ? 'bg-amber-600 text-white border-amber-600 shadow' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700' }}">
                        Keluar (Clock Out)
                    </button>
                </div>
                @error('type')
                    <p class="text-sm text-red-600 mt-1">{{ $message }}</p>
                @enderror
            </div>

            <!-- Location Selector -->
            <div>
                <label for="location_id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi / Cabang</label>
                <select id="location_id" wire:model="location_id"
                        class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500">
                    <option value="">-- Pilih Lokasi Cabang --</option>
                    @foreach ($this->locations as $loc)
                        <option value="{{ $loc->id }}">{{ $loc->name }} ({{ $loc->code }})</option>
                    @endforeach
                </select>
                @error('location_id')
                    <p class="text-sm text-red-600 mt-1">{{ $message }}</p>
                @enderror
            </div>

            <!-- Camera Capture Section -->
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto Kamera Langsung</label>
                <div class="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900">
                    @if ($photo)
                        <div class="relative w-full max-w-sm rounded-lg overflow-hidden shadow mb-4">
                            <img src="{{ $photo->temporaryUrl() }}" alt="Preview Foto" class="w-full h-auto object-cover rounded-lg">
                        </div>
                    @endif

                    <input type="file"
                           accept="image/*"
                           capture="environment"
                           wire:model="photo"
                           id="cameraCaptureInput"
                           class="hidden">

                    <button type="button"
                            onclick="document.getElementById('cameraCaptureInput').click()"
                            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-sm transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{{ $photo ? 'Ambil Ulang Foto' : 'Buka Kamera & Ambil Foto' }}</span>
                    </button>

                    <div wire:loading wire:target="photo" class="text-sm text-primary-600 mt-2">
                        Mengunggah foto...
                    </div>
                </div>
                @error('photo')
                    <p class="text-sm text-red-600 mt-1">{{ $message }}</p>
                @enderror
            </div>

            <!-- GPS Coordinates Section -->
            <div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="font-medium text-gray-800 dark:text-gray-200">Koordinat GPS</h4>
                        @if ($latitude && $longitude)
                            <p class="text-sm text-green-700 dark:text-green-400 mt-0.5">
                                Terdeteksi: {{ number_format($latitude, 6) }}, {{ number_format($longitude, 6) }}
                            </p>
                        @else
                            <p class="text-sm text-gray-500 mt-0.5">Menunggu deteksi lokasi...</p>
                        @endif
                    </div>
                    <button type="button"
                            @click="detectLocation()"
                            class="text-xs px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                        Perbarui GPS
                    </button>
                </div>

                <!-- GPS Error Banner (FR-09) -->
                <div x-show="errorMessage" x-cloak class="mt-3 p-3 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                    <span x-text="errorMessage"></span>
                </div>
                @error('latitude')
                    <p class="text-sm text-red-600 mt-1">{{ $message }}</p>
                @enderror
                @error('longitude')
                    <p class="text-sm text-red-600 mt-1">{{ $message }}</p>
                @enderror
            </div>

            <!-- Notes (Optional) -->
            <div>
                <label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan (Opsional)</label>
                <textarea id="notes" wire:model="notes" rows="2"
                          placeholder="Catatan aktivitas atau lokasi lapangan..."
                          class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"></textarea>
            </div>

            <!-- Submit Button -->
            <div>
                <button type="button"
                        wire:click="submit"
                        wire:loading.attr="disabled"
                        class="w-full py-3.5 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold text-lg shadow-md transition flex items-center justify-center gap-2">
                    <span wire:loading.remove wire:target="submit">Kirim Presensi</span>
                    <span wire:loading wire:target="submit" class="flex items-center gap-2">
                        <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        Memproses Watermark...
                    </span>
                </button>
            </div>
        </div>
    </div>

    @push('scripts')
    <script>
        function attendanceCamera() {
            return {
                errorMessage: '',
                init() {
                    this.detectLocation();
                },
                detectLocation() {
                    this.errorMessage = '';
                    if (!navigator.geolocation) {
                        this.errorMessage = 'Browser perangkat Anda tidak mendukung geolokasi GPS.';
                        return;
                    }

                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            @this.set('latitude', position.coords.latitude);
                            @this.set('longitude', position.coords.longitude);
                            this.errorMessage = '';
                        },
                        (error) => {
                            switch (error.code) {
                                case error.PERMISSION_DENIED:
                                    this.errorMessage = 'Izin lokasi (GPS) ditolak. Mohon izinkan akses lokasi pada browser/perangkat Anda untuk melanjutkan presensi.';
                                    break;
                                case error.POSITION_UNAVAILABLE:
                                    this.errorMessage = 'Informasi lokasi GPS tidak tersedia. Pastikan sinyal GPS aktif.';
                                    break;
                                case error.TIMEOUT:
                                    this.errorMessage = 'Waktu permintaan lokasi GPS habis. Silakan coba lagi.';
                                    break;
                                default:
                                    this.errorMessage = 'Terjadi kesalahan saat mendeteksi koordinat GPS.';
                                    break;
                            }
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0
                        }
                    );
                }
            }
        }
    </script>
    @endpush
</x-filament-panels::page>
