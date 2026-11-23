<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_core_tables_are_created_successfully(): void
    {
        $tables = [
            'users', 'locations', 'location_user', 'items', 'products', 'vendors',
            'stock_levels', 'stock_movements', 'stock_movement_items', 'requests',
            'approvals', 'boms', 'bom_items', 'production_schedules', 'production_logs',
            'sales_orders', 'sales_order_items', 'deliveries', 'attendances',
            'stock_opnames', 'stock_opname_items', 'letters'
        ];

        foreach ($tables as $table) {
            $this->assertTrue(Schema::hasTable($table), "Missing table: {$table}");
        }
    }
}
