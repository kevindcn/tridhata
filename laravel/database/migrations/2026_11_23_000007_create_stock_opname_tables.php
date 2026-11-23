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
        Schema::create('stock_opnames', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->date('date');
            $table->string('status')->default('DRAFT'); // DRAFT, OCR_PROCESSING, VERIFIED, APPLIED
            $table->string('form_photo_path')->nullable();
            $table->string('cropped_photo_path')->nullable();
            $table->integer('total_variance')->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // Branch isolation index
            $table->index(['location_id', 'created_at']);
            $table->index(['location_id', 'date']);
            $table->index('status');
        });

        Schema::create('stock_opname_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_opname_id')->constrained('stock_opnames')->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->integer('system_qty')->default(0);
            $table->integer('counted_qty')->default(0);
            $table->integer('variance')->default(0);
            $table->decimal('ocr_confidence', 5, 2)->nullable();
            $table->boolean('flagged_manual')->default(false);
            $table->timestamps();

            $table->index('stock_opname_id');
            $table->index('item_id');
            $table->index('product_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_opname_items');
        Schema::dropIfExists('stock_opnames');
    }
};
