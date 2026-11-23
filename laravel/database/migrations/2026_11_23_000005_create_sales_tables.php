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
        Schema::create('sales_orders', function (Blueprint $table) {
            $table->id();
            $table->string('so_number')->unique();
            $table->string('po_number')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('channel')->nullable(); // OFFLINE, TOKOPEDIA, SHOPEE, etc.
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->date('date');
            $table->string('status')->default('DRAFT'); // DRAFT, CONFIRMED, PROCESSING, SHIPPED, COMPLETED, CANCELLED
            $table->decimal('total_amount', 18, 2)->default(0);
            $table->string('pdf_path')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Branch isolation index
            $table->index(['location_id', 'created_at']);
            $table->index(['location_id', 'date']);
            $table->index('status');
        });

        Schema::create('sales_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_order_id')->constrained('sales_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('qty')->default(1);
            $table->decimal('price', 18, 2)->default(0);
            $table->decimal('total', 18, 2)->default(0);
            $table->timestamps();

            $table->index('sales_order_id');
            $table->index('product_id');
        });

        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('sj_number')->unique();
            $table->foreignId('sales_order_id')->nullable()->constrained('sales_orders')->nullOnDelete();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->date('date');
            $table->string('driver_name')->nullable();
            $table->string('vehicle_no')->nullable();
            $table->string('status')->default('PENDING'); // PENDING, IN_TRANSIT, DELIVERED, RETURNED
            $table->string('pdf_path')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Branch isolation index
            $table->index(['location_id', 'created_at']);
            $table->index('sales_order_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deliveries');
        Schema::dropIfExists('sales_order_items');
        Schema::dropIfExists('sales_orders');
    }
};
