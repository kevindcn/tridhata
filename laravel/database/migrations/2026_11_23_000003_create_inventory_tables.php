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
        Schema::create('stock_levels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->nullable()->constrained('items')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->decimal('qty', 18, 4)->default(0);
            $table->decimal('min_stock', 18, 4)->default(0);
            $table->decimal('safety_stock', 18, 4)->default(0);
            $table->timestamp('synced_at')->nullable();
            $table->integer('version')->default(1);
            $table->timestamps();

            $table->index(['location_id', 'item_id']);
            $table->index(['location_id', 'product_id']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('type'); // IN, OUT, TRANSFER, RETURN, REJECT, ADJUSTMENT
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->foreignId('target_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->date('date');
            $table->text('notes')->nullable();
            $table->string('receipt_path')->nullable();
            $table->string('status')->default('COMPLETED');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // Branch isolation index
            $table->index(['location_id', 'created_at']);
            $table->index(['location_id', 'date']);
            $table->index(['type', 'date']);
        });

        Schema::create('stock_movement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movement_id')->constrained('stock_movements')->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->decimal('qty', 18, 4);
            $table->string('unit')->default('pcs');
            $table->decimal('unit_price', 18, 2)->default(0);
            $table->decimal('total_price', 18, 2)->default(0);
            $table->timestamps();

            $table->index('movement_id');
            $table->index('item_id');
            $table->index('product_id');
        });

        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->string('code')->nullable()->unique();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->string('type'); // RAW_MATERIAL, OFFICE, RND, TRANSFER
            $table->string('title');
            $table->decimal('amount', 18, 2)->default(0);
            $table->string('status')->default('PENDING'); // PENDING, APPROVED, REJECTED
            $table->integer('current_approval_step')->default(1);
            $table->text('notes')->nullable();
            $table->string('receipt_path')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->index(['location_id', 'created_at']);
            $table->index(['status', 'created_at']);
            $table->index('requester_id');
        });

        Schema::create('request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->decimal('qty', 18, 2)->default(0);
            $table->decimal('estimated_price', 18, 2)->default(0);
            $table->decimal('total_price', 18, 2)->default(0);
            $table->timestamps();

            $table->index('request_id');
        });

        Schema::create('approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->foreignId('approver_id')->constrained('users')->cascadeOnDelete();
            $table->integer('step')->default(1);
            $table->string('decision'); // APPROVED, REJECTED
            $table->text('notes')->nullable();
            $table->timestamp('decided_at')->useCurrent();
            $table->timestamps();

            $table->index('request_id');
            $table->index('approver_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('approvals');
        Schema::dropIfExists('request_items');
        Schema::dropIfExists('requests');
        Schema::dropIfExists('stock_movement_items');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('stock_levels');
    }
};
