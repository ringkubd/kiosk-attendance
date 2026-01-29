<?php

namespace Anwar\AttendanceSync\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Anwar\AttendanceSync\Http\Requests\FaceEnrollmentRequest;
use Anwar\AttendanceSync\Models\AttendanceEmployee;
use Anwar\AttendanceSync\Models\AttendanceSyncLog;

class EmployeeSyncController
{
    public function pull(Request $request)
    {
        $branchId = $request->query('branch_id');
        $since = (int) $request->query('since', 0);

        $query = AttendanceEmployee::query();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }
        if ($since > 0) {
            $query->where('updated_at', '>', date('Y-m-d H:i:s', $since / 1000));
        }

        return response()->json([
            'employees' => $query->get(),
        ]);
    }

    public function faceEnrollment(FaceEnrollmentRequest $request)
    {
        $payload = $request->validated();
        $employee = AttendanceEmployee::query()->find($payload['employee_id']);

        if (!$employee) {
            return response()->json(['message' => 'Employee not found'], 404);
        }

        $employee->face_embeddings_encrypted = $payload['embeddings_encrypted'];
        $employee->face_enrolled = true;
        $employee->sync_status = 'synced';
        $employee->last_synced_at = now();
        $employee->save();

        AttendanceSyncLog::create([
            'device_id' => $request->header('X-Device-ID'),
            'sync_type' => 'employee_push',
            'record_count' => 1,
            'status' => 'success',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    public function markSynced(Request $request, string $id)
    {
        $employee = AttendanceEmployee::query()->find($id);
        if (!$employee) {
            return response()->json(['message' => 'Employee not found'], 404);
        }

        $employee->sync_status = 'synced';
        $employee->last_synced_at = now();
        $employee->save();

        return response()->json(['success' => true]);
    }
}
