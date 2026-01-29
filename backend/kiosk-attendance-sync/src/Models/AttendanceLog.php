<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceLog extends Model
{
    protected $table = 'attendance_logs';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'attendance_employee_id',
        'device_id',
        'type',
        'check_time',
        'branch_id',
        'confidence_score',
        'location_lat',
        'location_lng',
        'photo_proof_path',
        'notes',
        'sync_status',
        'synced_from_device_at',
    ];

    protected $casts = [
        'check_time' => 'datetime',
        'synced_from_device_at' => 'datetime',
    ];
}
