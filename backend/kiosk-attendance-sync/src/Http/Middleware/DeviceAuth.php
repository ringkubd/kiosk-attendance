<?php

namespace Anwar\AttendanceSync\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Anwar\AttendanceSync\Models\AttendanceDevice;

class DeviceAuth
{
    public function handle(Request $request, Closure $next)
    {
        $deviceId = $request->header('X-Device-ID');
        $authHeader = $request->header('Authorization', '');
        $token = null;

        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = trim($matches[1]);
        }

        if (!$deviceId || !$token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $device = AttendanceDevice::query()
            ->where('id', $deviceId)
            ->where('status', 'active')
            ->first();

        if (!$device || !$device->device_token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            $storedToken = Crypt::decryptString($device->device_token);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (!hash_equals($storedToken, $token)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $device->last_active_at = now();
        $device->ip_address = $request->ip();
        $device->save();

        $request->attributes->set('attendance_device', $device);

        return $next($request);
    }
}
