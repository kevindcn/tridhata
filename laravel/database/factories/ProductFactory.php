<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'sku' => 'PROD-' . $this->faker->unique()->numberBetween(100, 999),
            'name' => $this->faker->words(3, true),
            'unit' => 'pcs',
            'selling_price' => $this->faker->numberBetween(50000, 200000),
            'cogs_price' => $this->faker->numberBetween(30000, 150000),
            'min_stock' => $this->faker->numberBetween(10, 50),
            'is_active' => true,
        ];
    }
}
