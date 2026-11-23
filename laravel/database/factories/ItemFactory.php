<?php

namespace Database\Factories;

use App\Models\Item;
use Illuminate\Database\Eloquent\Factories\Factory;

class ItemFactory extends Factory
{
    protected $model = Item::class;

    public function definition(): array
    {
        return [
            'sku' => 'RAW-' . $this->faker->unique()->numberBetween(100, 999),
            'name' => $this->faker->words(3, true),
            'category' => $this->faker->randomElement(['Pupuk', 'Kemasan', 'Benih', 'Pestisida']),
            'unit' => $this->faker->randomElement(['kg', 'pcs', 'sak', 'botol']),
            'min_stock' => $this->faker->numberBetween(10, 100),
            'safety_stock' => $this->faker->numberBetween(5, 50),
            'is_raw_material' => true,
            'is_active' => true,
        ];
    }
}
