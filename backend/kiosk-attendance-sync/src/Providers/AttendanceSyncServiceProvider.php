<?php

namespace Kiosk\AttendanceSync\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Route;

class AttendanceSyncServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/kiosk.php', 'kiosk');
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
        }

        $this->registerRoutes();
    }

    private function registerRoutes(): void
    {
        Route::middleware($this->resolveAuthMiddleware())
            ->group(__DIR__ . '/../../routes/api.php');
    }

    private function resolveAuthMiddleware(): array
    {
        $driver = config('kiosk.auth.driver', 'sanctum');

        if ($driver === 'sanctum') {
            return ['api', 'auth:sanctum'];
        }

        if ($driver === 'jwt') {
            return ['api', 'auth:api'];
        }

        return ['api', \Kiosk\AttendanceSync\Http\Middleware\DeviceTokenAuth::class];
    }
}
