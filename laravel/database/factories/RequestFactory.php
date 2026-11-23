<?php

namespace Database\Factories;

use App\Models\Location;
use App\Models\Request as ErpRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class RequestFactory extends Factory
{
    protected $model = ErpRequest::class;

    public function definition(): array
    {
        return [
            'code' => 'REQ-' . date('Ym') . '-' . str_pad($this->faker->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'requester_id' => User::factory(),
            'location_id' => Location::factory(),
            'type' => $this->faker->randomElement(['RAW_MATERIAL', 'OFFICE', 'RND', 'TRANSFER']),
            'title' => $this->faker->sentence(3),
            'amount' => 5000000,
            'status' => 'PENDING',
            'current_approval_step' => 1,
            'notes' => $this->faker->sentence(),
            'receipt_path' => null,
            'decided_at' => null,
        ];
    }
}
