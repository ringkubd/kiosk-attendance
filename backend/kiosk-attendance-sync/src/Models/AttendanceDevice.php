<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceDevice extends Model
{
    protected $table = 'attendance_devices';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'device_code',
        'registration_code',
        'device_name',
        'business_id',
        'branch_id',
        'device_token',
        'ip_address',
        'last_active_at',
        'status',
        'settings_json',
    ];

    protected $casts = [
        'last_active_at' => 'datetime',
    ];
}
