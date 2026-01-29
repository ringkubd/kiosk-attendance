<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceEmployeeShift extends Model
{
    protected $table = 'attendance_employee_shifts';

    protected $fillable = [
        'attendance_employee_id',
        'shift_id',
        'effective_from',
        'effective_to',
    ];

    public function employee()
    {
        return $this->belongsTo(AttendanceEmployee::class, 'attendance_employee_id');
    }
}
