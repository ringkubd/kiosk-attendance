<?php

namespace Anwar\AttendanceSync\Http\Controllers;

use Illuminate\Http\Request;
use Anwar\AttendanceSync\Models\AttendanceEmployeeShift;
use Anwar\AttendanceSync\Models\AttendanceShift;
use Anwar\AttendanceSync\Models\AttendanceSyncLog;

class ShiftSyncController
{
    public function pull(Request $request)
    {
        $branchId = $request->query('branch_id');
        $since = (int) $request->query('since', 0);

        $shiftQuery = AttendanceShift::query();
        if ($branchId) {
            $shiftQuery->where(function ($query) use ($branchId) {
                $query->whereNull('branch_id')->orWhere('branch_id', $branchId);
            });
        }
        if ($since > 0) {
            $shiftQuery->where('updated_at', '>', date('Y-m-d H:i:s', $since / 1000));
        }

        $shifts = $shiftQuery->get();

        $employeeShifts = AttendanceEmployeeShift::query()
            ->when($branchId, function ($query) use ($branchId) {
                $query->whereHas('employee', function ($empQuery) use ($branchId) {
                    $empQuery->where('branch_id', $branchId);
                });
            })
            ->get();

        AttendanceSyncLog::create([
            'device_id' => $request->header('X-Device-ID'),
            'sync_type' => 'shift_pull',
            'record_count' => $shifts->count(),
            'status' => 'success',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        return response()->json([
            'shifts' => $shifts,
            'employee_shifts' => $employeeShifts,
        ]);
    }
}
