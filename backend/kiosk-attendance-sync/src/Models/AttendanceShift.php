<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceShift extends Model
{
    protected $table = 'attendance_shifts';

    protected $fillable = [
        'business_id',
        'branch_id',
        'name',
        'start_time',
        'end_time',
        'grace_period_minutes',
        'working_days',
        'status',
    ];

    protected $casts = [
        'working_days' => 'array',
    ];
}
