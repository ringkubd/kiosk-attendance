<?php

return [
    'auth' => [
        'driver' => env('KIOSK_AUTH_DRIVER', 'sanctum'),
        // token | sanctum | jwt
        'token_header' => 'X-DEVICE-TOKEN',
    ],
    'storage' => [
        'disk' => env('KIOSK_STORAGE_DISK', 'local'),
        'profile_dir' => 'profiles',
        'vector_dir' => 'vectors',
    ],
    'queue' => [
        'enabled' => env('KIOSK_QUEUE_ENABLED', false),
        'connection' => env('KIOSK_QUEUE_CONNECTION', 'database'),
    ],
    'sync' => [
        'logs_batch' => 200,
        'employees_batch' => 200,
    ],
];
