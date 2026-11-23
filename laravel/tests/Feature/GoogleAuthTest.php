<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Filament\Panel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_pre_provisioned_user_can_login_via_google(): void
    {
        $user = User::factory()->create([
            'email' => 'operasional@tridhata.com',
            'active' => true,
        ]);

        $abstractUser = Mockery::mock('Laravel\Socialite\Two\User');
        $abstractUser->shouldReceive('getId')->andReturn('google-123456');
        $abstractUser->shouldReceive('getEmail')->andReturn('operasional@tridhata.com');
        $abstractUser->shouldReceive('getName')->andReturn('Staf Operasional');
        $abstractUser->shouldReceive('getAvatar')->andReturn('https://lh3.googleusercontent.com/avatar');

        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('user')->andReturn($abstractUser);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $response = $this->get('/auth/google/callback');
        $response->assertRedirect('/admin');
        $this->assertAuthenticatedAs($user);

        $user->refresh();
        $this->assertEquals('google-123456', $user->google_id);
        $this->assertEquals('https://lh3.googleusercontent.com/avatar', $user->avatar);
    }

    public function test_unregistered_google_account_is_blocked(): void
    {
        $abstractUser = Mockery::mock('Laravel\Socialite\Two\User');
        $abstractUser->shouldReceive('getId')->andReturn('google-999999');
        $abstractUser->shouldReceive('getEmail')->andReturn('stranger@gmail.com');
        $abstractUser->shouldReceive('getName')->andReturn('Stranger');
        $abstractUser->shouldReceive('getAvatar')->andReturn(null);

        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('user')->andReturn($abstractUser);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $response = $this->get('/auth/google/callback');
        $response->assertRedirect('/login');
        $response->assertSessionHas('error', 'Akun Google Anda belum terdaftar di sistem ERP Tridhata.');
        $this->assertGuest();
    }

    public function test_inactive_pre_provisioned_user_is_blocked(): void
    {
        $user = User::factory()->create([
            'email' => 'inactive@tridhata.com',
            'active' => false,
        ]);

        $abstractUser = Mockery::mock('Laravel\Socialite\Two\User');
        $abstractUser->shouldReceive('getId')->andReturn('google-888888');
        $abstractUser->shouldReceive('getEmail')->andReturn('inactive@tridhata.com');
        $abstractUser->shouldReceive('getName')->andReturn('Inactive User');
        $abstractUser->shouldReceive('getAvatar')->andReturn(null);

        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('user')->andReturn($abstractUser);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $response = $this->get('/auth/google/callback');
        $response->assertRedirect('/login');
        $response->assertSessionHas('error', 'Akun Google Anda belum terdaftar di sistem ERP Tridhata.');
        $this->assertGuest();
    }

    public function test_redirect_to_google_initiates_oauth_redirect(): void
    {
        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $response = $this->get('/auth/google');
        $response->assertRedirect('https://accounts.google.com/o/oauth2/auth');
    }

    public function test_active_user_can_access_filament_panel(): void
    {
        $panel = new Panel();
        $user = User::factory()->make(['active' => true]);

        $this->assertTrue($user->canAccessPanel($panel));
    }

    public function test_inactive_user_cannot_access_filament_panel(): void
    {
        $panel = new Panel();
        $user = User::factory()->make(['active' => false]);

        $this->assertFalse($user->canAccessPanel($panel));
    }

    public function test_user_location_relationships_and_mass_assignment(): void
    {
        $location = Location::create([
            'code' => 'BOGOR',
            'name' => 'Gudang Bogor',
            'address' => 'Jl. Raya Bogor',
            'spreadsheet_id' => 'sheet-123',
        ]);

        $user = User::create([
            'name' => 'Ahmad Staff',
            'email' => 'ahmad@tridhata.com',
            'google_id' => 'gid-101',
            'avatar' => 'https://example.com/avatar.jpg',
            'division' => 'Operasional',
            'default_location_id' => $location->id,
            'active' => true,
        ]);

        $user->locations()->attach($location->id);

        $this->assertEquals($location->id, $user->defaultLocation->id);
        $this->assertCount(1, $user->locations);
        $this->assertEquals('BOGOR', $user->locations->first()->code);
    }

    public function test_roles_and_permissions_seeder_seeds_all_roles(): void
    {
        $this->seed(RoleAndPermissionSeeder::class);

        $expectedRoles = [
            'super_admin',
            'admin_bogor',
            'admin_nganjuk',
            'finance',
            'staff_gudang',
            'staff_produksi',
            'field_sales',
            'agronomist',
        ];

        foreach ($expectedRoles as $roleName) {
            $this->assertDatabaseHas('roles', [
                'name' => $roleName,
                'guard_name' => 'web',
            ]);
        }

        $user = User::factory()->create(['active' => true]);
        $user->assignRole('admin_bogor');

        $this->assertTrue($user->hasRole('admin_bogor'));
        $this->assertTrue($user->hasPermissionTo('view_inventory'));
        $this->assertFalse($user->hasPermissionTo('view_agronomy'));
    }
}
