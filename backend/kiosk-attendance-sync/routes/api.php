<?php

use Illuminate\Support\Facades\Route;
use Anwar\AttendanceSync\Http\Controllers\AttendanceLogController;
use Anwar\AttendanceSync\Http\Controllers\DeviceController;
use Anwar\AttendanceSync\Http\Controllers\EmployeeSyncController;
use Anwar\AttendanceSync\Http\Controllers\ShiftSyncController;

Route::prefix('api/v1/attendance')->group(function () {
    Route::post('/devices/register', [DeviceController::class, 'register'])
        ->withoutMiddleware([\Anwar\AttendanceSync\Http\Middleware\DeviceAuth::class]);

    Route::get('/sync/employees', [EmployeeSyncController::class, 'pull']);
    Route::post('/sync/employees/face-enrollment', [EmployeeSyncController::class, 'faceEnrollment']);
    Route::patch('/sync/employees/{id}/mark-synced', [EmployeeSyncController::class, 'markSynced']);

    Route::post('/sync/logs', [AttendanceLogController::class, 'store']);
    Route::post('/sync/logs/acknowledge', [AttendanceLogController::class, 'acknowledge']);

    Route::get('/sync/shifts', [ShiftSyncController::class, 'pull']);
});
