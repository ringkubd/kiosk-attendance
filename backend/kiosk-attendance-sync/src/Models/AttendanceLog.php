<?php

namespace Kiosk\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceLog extends Model
{
    protected $table = 'attendance_logs';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'org_id',
        'branch_id',
        'device_id',
        'employee_id',
        'type',
        'ts_local',
        'confidence',
        'synced',
        'server_id',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
