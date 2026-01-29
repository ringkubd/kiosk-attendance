<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceReportCache extends Model
{
    protected $table = 'attendance_reports_cache';
    public $timestamps = false;

    protected $fillable = [
        'business_id',
        'branch_id',
        'report_type',
        'report_date',
        'data_json',
        'generated_at',
    ];
}
