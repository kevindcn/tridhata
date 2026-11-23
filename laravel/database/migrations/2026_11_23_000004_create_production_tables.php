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
        Schema::create('boms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('code')->unique();
            $table->string('name');
            $table->integer('batch_size')->default(1);
            $table->string('yield_unit')->default('pcs');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('bom_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bom_id')->constrained('boms')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('items')->cascadeOnDelete();
            $table->decimal('quantity', 18, 2);
            $table->string('unit')->default('kg');
            $table->timestamps();

            $table->index('bom_id');
            $table->index('item_id');
        });

        Schema::create('production_teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->string('name');
            $table->string('leader_name')->nullable();
            $table->integer('member_count')->default(1);
            $table->integer('daily_capacity')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Branch isolation index
            $table->index(['location_id', 'created_at']);
        });

        Schema::create('production_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->string('period'); // YYYY-MM
            $table->date('date')->nullable();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('bom_id')->nullable()->constrained('boms')->nullOnDelete();
            $table->foreignId('team_id')->nullable()->constrained('production_teams')->nullOnDelete();
            $table->integer('target_qty')->default(0);
            $table->string('status')->default('SCHEDULED');
            $table->timestamps();

            // Branch isolation index
            $table->index(['location_id', 'period']);
            $table->index(['location_id', 'created_at']);
        });

        Schema::create('production_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->nullable()->constrained('production_schedules')->nullOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('team_id')->nullable()->constrained('production_teams')->nullOnDelete();
            $table->integer('actual_qty')->default(0);
            $table->integer('reject_qty')->default(0);
            $table->date('date');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_id', 'date']);
            $table->index('schedule_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_logs');
        Schema::dropIfExists('production_schedules');
        Schema::dropIfExists('production_teams');
        Schema::dropIfExists('bom_items');
        Schema::dropIfExists('boms');
    }
};
