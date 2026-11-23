<?php

namespace Database\Factories;

use App\Models\Location;
use App\Models\SalesOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\SalesOrder>
 */
class SalesOrderFactory extends Factory
{
    protected $model = SalesOrder::class;

    public function definition(): array
    {
        return [
            'so_number' => 'SO-' . fake()->unique()->numerify('2026-####'),
            'po_number' => 'PO-' . fake()->numerify('CUST-####'),
            'customer_name' => fake()->company(),
            'channel' => fake()->randomElement(['OFFLINE', 'TOKOPEDIA', 'SHOPEE', 'DIRECT']),
            'location_id' => Location::factory(),
            'date' => now()->toDateString(),
            'status' => 'DRAFT',
            'total_amount' => 100000,
            'pdf_path' => null,
            'notes' => fake()->sentence(),
        ];
    }
}
