<?php

namespace Database\Factories;

use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

class LocationFactory extends Factory
{
    protected $model = Location::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper($this->faker->unique()->lexify('LOC-???')),
            'name' => $this->faker->city(),
            'address' => $this->faker->address(),
            'spreadsheet_id' => $this->faker->uuid(),
        ];
    }
}
