<?php

namespace Anwar\AttendanceSync\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Route;

class AttendanceSyncServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/kiosk.php', 'kiosk');
        $this->mergeConfigFrom(__DIR__ . '/../../config/attendance-sync.php', 'attendance-sync');
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__ . '/../../config/kiosk.php' => config_path('kiosk.php'),
        ], 'kiosk-config');

        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../../database/migrations' => database_path('migrations'),
            ], 'kiosk-migrations');

            $this->publishes([
                __DIR__ . '/../../config/attendance-sync.php' => config_path('attendance-sync.php'),
            ], 'attendance-sync-config');
        }

        $this->registerRoutes();
    }

    private function registerRoutes(): void
    {
        Route::middleware(['api', \Anwar\AttendanceSync\Http\Middleware\DeviceAuth::class])
            ->group(__DIR__ . '/../../routes/api.php');
    }
}
