<?php

namespace Anwar\AttendanceSync\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class DeviceTokenAuth
{
    public function handle(Request $request, Closure $next)
    {
        $header = config('kiosk.auth.token_header', 'X-DEVICE-TOKEN');
        $token = $request->header($header);

        if (!$token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
