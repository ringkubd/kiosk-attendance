<?php

use Illuminate\Support\Facades\Route;
use Kiosk\AttendanceSync\Http\Controllers\SyncController;

Route::prefix('api')->group(function () {
    Route::post('/sync/logs', [SyncController::class, 'syncLogs']);
    Route::post('/sync/employees', [SyncController::class, 'syncEmployees']);
    Route::get('/sync/employees', [SyncController::class, 'pullEmployees']);
    Route::get('/sync/policies', [SyncController::class, 'pullPolicies']);
});
