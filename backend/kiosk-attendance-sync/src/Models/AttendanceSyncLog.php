<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceSyncLog extends Model
{
    protected $table = 'attendance_sync_logs';
    public $timestamps = false;

    protected $fillable = [
        'device_id',
        'sync_type',
        'record_count',
        'status',
        'error_message',
        'started_at',
        'completed_at',
    ];
}
