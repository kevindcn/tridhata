<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\Location;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AttendanceFactory extends Factory
{
    protected $model = Attendance::class;

    public function definition(): array
    {
        $lat = fake()->latitude(-6.7, -6.1);
        $lng = fake()->longitude(106.6, 107.0);

        return [
            'user_id' => User::factory(),
            'location_id' => Location::factory(),
            'type' => fake()->randomElement(['CLOCK_IN', 'CLOCK_OUT']),
            'timestamp' => now(),
            'latitude' => $lat,
            'longitude' => $lng,
            'maps_url' => "https://maps.google.com/?q={$lat},{$lng}",
            'photo_path' => 'attendance/' . uniqid('att_', true) . '.jpg',
            'is_verified' => true,
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
