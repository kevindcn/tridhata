<?php

namespace App\Models;

use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements FilamentUser
{
    use HasFactory, HasRoles, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'google_id',
        'avatar',
        'password',
        'division',
        'default_location_id',
        'active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'active' => 'boolean',
        ];
    }

    /**
     * Determine if user can access the Filament panel.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        return (bool) $this->active;
    }

    /**
     * Get user's default location.
     */
    public function defaultLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'default_location_id');
    }

    /**
     * Get all locations assigned to the user.
     */
    public function locations(): BelongsToMany
    {
        return $this->belongsToMany(Location::class, 'location_user');
    }

    /**
     * Requests submitted by this user.
     */
    public function requests(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Request::class, 'requester_id');
    }

    /**
     * Approvals performed by this user.
     */
    public function approvals(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Approval::class, 'approver_id');
    }

    /**
     * Production logs created by this user.
     */
    public function productionLogs(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ProductionLog::class, 'created_by');
    }

    /**
     * Attendances recorded by this user.
     */
    public function attendances(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    /**
     * Stock opnames created by this user.
     */
    public function stockOpnames(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(StockOpname::class, 'created_by');
    }

    /**
     * Letters created by this user.
     */
    public function letters(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Letter::class, 'created_by');
    }
}
