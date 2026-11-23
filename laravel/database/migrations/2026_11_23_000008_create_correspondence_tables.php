<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('letters', function (Blueprint $table) {
            $table->id();
            $table->string('letter_number')->unique();
            $table->string('type'); // SURAT_MASUK, SURAT_KELUAR, SK, TUGAS, etc.
            $table->string('direction'); // IN, OUT
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('branch')->nullable();
            $table->string('subject');
            $table->string('sender')->nullable();
            $table->string('recipient')->nullable();
            $table->date('date');
            $table->string('file_path')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['direction', 'date']);
            $table->index('letter_number');
            $table->index('location_id');
            $table->index('branch');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('letters');
    }
};
