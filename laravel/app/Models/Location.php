<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'address',
        'spreadsheet_id',
    ];

    /**
     * Users assigned to this location.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'location_user');
    }

    /**
     * Users who have this location set as their default.
     */
    public function defaultUsers(): HasMany
    {
        return $this->hasMany(User::class, 'default_location_id');
    }

    /**
     * Requests submitted for this location.
     */
    public function requests(): HasMany
    {
        return $this->hasMany(Request::class, 'location_id');
    }
}
