<?php

namespace Anwar\AttendanceSync\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Anwar\AttendanceSync\Http\Requests\DeviceRegisterRequest;
use Anwar\AttendanceSync\Models\AttendanceDevice;
use Anwar\AttendanceSync\Models\AttendanceSyncLog;

class DeviceController
{
    public function register(DeviceRegisterRequest $request)
    {
        $payload = $request->validated();

        $device = AttendanceDevice::query()
            ->where('registration_code', $payload['registration_code'])
            ->first();

        if (!$device) {
            return response()->json(['message' => 'Invalid registration code'], 404);
        }

        if ($device->status !== 'active') {
            return response()->json(['message' => 'Device is not active'], 403);
        }

        $token = Str::random(64);
        $device->device_token = Crypt::encryptString($token);
        $device->device_name = $payload['device_info']['model'] ?? $device->device_name;
        $device->ip_address = $request->ip();
        $device->last_active_at = now();
        $device->save();

        AttendanceSyncLog::create([
            'device_id' => $device->id,
            'sync_type' => 'device_register',
            'record_count' => 1,
            'status' => 'success',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        return response()->json([
            'device_id' => $device->id,
            'device_token' => $token,
            'branch_id' => $device->branch_id,
            'business_id' => $device->business_id,
        ]);
    }
}
