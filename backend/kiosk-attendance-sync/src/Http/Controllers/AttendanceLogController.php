<?php

namespace Anwar\AttendanceSync\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Anwar\AttendanceSync\Http\Requests\AcknowledgeLogsRequest;
use Anwar\AttendanceSync\Http\Requests\SyncLogsV1Request;
use Anwar\AttendanceSync\Models\AttendanceLog;
use Anwar\AttendanceSync\Models\AttendanceSyncLog;

class AttendanceLogController
{
    public function store(SyncLogsV1Request $request)
    {
        $payload = $request->validated();
        $deviceId = $payload['device_id'];
        $branchId = $payload['branch_id'];
        $mappings = [];

        $syncLog = AttendanceSyncLog::create([
            'device_id' => $deviceId,
            'sync_type' => 'log_pull',
            'record_count' => count($payload['logs']),
            'status' => 'success',
            'started_at' => now(),
        ]);

        DB::transaction(function () use ($payload, $deviceId, $branchId, &$mappings) {
            foreach ($payload['logs'] as $log) {
                $checkTime = isset($log['check_time'])
                    ? date('Y-m-d H:i:s', strtotime($log['check_time']))
                    : date('Y-m-d H:i:s');

                $record = AttendanceLog::updateOrCreate(
                    ['id' => $log['id']],
                    [
                        'attendance_employee_id' => $log['employee_id'],
                        'type' => $log['type'],
                        'check_time' => $checkTime,
                        'device_id' => $deviceId,
                        'branch_id' => $branchId,
                        'confidence_score' => $log['confidence_score'] ?? null,
                        'location_lat' => $log['location_lat'] ?? null,
                        'location_lng' => $log['location_lng'] ?? null,
                        'photo_proof_path' => $log['photo_proof_path'] ?? null,
                        'notes' => $log['notes'] ?? null,
                        'sync_status' => 'confirmed',
                        'synced_from_device_at' => now(),
                    ]
                );

                $mappings[] = [
                    'client_id' => $log['id'],
                    'server_id' => $record->id,
                ];
            }
        });

        $syncLog->completed_at = now();
        $syncLog->save();

        return response()->json([
            'success' => true,
            'mappings' => $mappings,
        ]);
    }

    public function acknowledge(AcknowledgeLogsRequest $request)
    {
        $payload = $request->validated();
        $ids = $payload['log_ids'];

        AttendanceLog::query()
            ->whereIn('id', $ids)
            ->update(['sync_status' => 'confirmed']);

        AttendanceSyncLog::create([
            'device_id' => $request->header('X-Device-ID'),
            'sync_type' => 'log_ack',
            'record_count' => count($ids),
            'status' => 'success',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }
}
