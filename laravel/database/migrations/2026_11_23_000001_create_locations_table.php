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
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // BOGOR, NGANJUK
            $table->string('name');
            $table->text('address')->nullable();
            $table->string('spreadsheet_id')->nullable();
            $table->timestamps();
        });

        Schema::create('location_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'location_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('default_location_id')->references('id')->on('locations')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['default_location_id']);
        });

        Schema::dropIfExists('location_user');
        Schema::dropIfExists('locations');
    }
};
