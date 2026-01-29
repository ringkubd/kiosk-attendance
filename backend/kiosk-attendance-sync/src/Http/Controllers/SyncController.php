<?php

namespace Anwar\AttendanceSync\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Anwar\AttendanceSync\Http\Requests\SyncLogsRequest;
use Anwar\AttendanceSync\Http\Requests\SyncEmployeesRequest;
use Anwar\AttendanceSync\Jobs\ComputeDailySummaryJob;
use Anwar\AttendanceSync\Models\AttendanceLog;
use Anwar\AttendanceSync\Models\Employee;

class SyncController
{
    public function syncLogs(SyncLogsRequest $request)
    {
        $payload = $request->validated();

        $orgId = $payload['org_id'];
        $branchId = $payload['branch_id'];
        $deviceId = $payload['device_id'];

        $serverIds = [];

        DB::transaction(function () use ($payload, $orgId, $branchId, $deviceId, &$serverIds) {
            foreach ($payload['logs'] as $log) {
                $record = AttendanceLog::updateOrCreate(
                    ['id' => $log['id']],
                    [
                        'org_id' => $orgId,
                        'branch_id' => $branchId,
                        'device_id' => $deviceId,
                        'employee_id' => $log['employee_id'],
                        'type' => $log['type'],
                        'ts_local' => $log['ts_local'],
                        'confidence' => $log['confidence'],
                        'synced' => 1,
                        'server_id' => null,
                        'created_at' => now(),
                    ]
                );

                $serverIds[] = [
                    'client_id' => $log['id'],
                    'server_id' => $record->id,
                ];

                if (config('kiosk.queue.enabled')) {
                    ComputeDailySummaryJob::dispatch($orgId, $branchId, $log['employee_id'], $log['ts_local'])
                        ->onConnection(config('kiosk.queue.connection'));
                }
            }
        });

        return response()->json(['success' => true, 'ids' => $serverIds]);
    }

    public function syncEmployees(SyncEmployeesRequest $request)
    {
        $payload = $request->validated();

        $orgId = $payload['org_id'];
        $branchId = $payload['branch_id'];
        $disk = config('kiosk.storage.disk');
        $profileDir = config('kiosk.storage.profile_dir');

        $upserted = [];

        DB::transaction(function () use ($payload, $orgId, $branchId, $disk, $profileDir, &$upserted) {
            foreach ($payload['employees'] as $emp) {
                $employee = Employee::updateOrCreate(
                    ['id' => $emp['id']],
                    [
                        'org_id' => $orgId,
                        'branch_id' => $branchId,
                        'code' => $emp['code'] ?? null,
                        'name' => $emp['name'],
                        'status' => $emp['status'],
                        'embedding_avg' => isset($emp['embedding_avg']) ? base64_decode($emp['embedding_avg']) : null,
                        'updated_at' => now(),
                        'sync_state' => 'clean',
                    ]
                );

                if (!empty($emp['profile_image'])) {
                    $data = base64_decode($emp['profile_image']);
                    $path = $profileDir . '/' . $orgId . '/' . $employee->id . '.jpg';
                    Storage::disk($disk)->put($path, $data);
                    $employee->profile_image_path = $path;
                    $employee->save();
                }

                $upserted[] = $employee->id;
            }
        });

        return response()->json(['success' => true, 'employees' => $upserted]);
    }

    public function pullEmployees(Request $request)
    {
        $orgId = $request->query('org_id');
        $branchId = $request->query('branch_id');
        $since = (int) $request->query('since', 0);

        $query = Employee::query();
        if ($orgId) {
            $query->where('org_id', $orgId);
        }
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }
        if ($since > 0) {
            $query->where('updated_at', '>', date('Y-m-d H:i:s', $since / 1000));
        }

        return response()->json(['employees' => $query->get()]);
    }

    public function pullPolicies(Request $request)
    {
        return response()->json(['policies' => []]);
    }
}
