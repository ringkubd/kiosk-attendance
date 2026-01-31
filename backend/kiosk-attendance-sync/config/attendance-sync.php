<?php

/**
 * @return array{
 *     user: array{
 *         model: string,
 *         table: string,
 *         foreign_key: string,
 *         owner_key: string,
 *         timestamps: null|string
 *     },
 *     employee: array{
 *         table: string,
 *         relations: string
 *     },
 *     log: array{
 *         table: string
 *     },
 *     sync: array{
 *         batch_size: int,
 *         max_retries: int
 *     }
 * }
 */
return [
    'user' => [
        'model' => env('ATTENDANCE_USER_MODEL', 'App\\Models\\User'),
        'table' => env('ATTENDANCE_USER_TABLE', 'users'),
        'foreign_key' => env('ATTENDANCE_USER_FOREIGN_KEY', 'user_id'),
        'owner_key' => env('ATTENDANCE_USER_OWNER_KEY', 'id'),
        'timestamps' => env('ATTENDANCE_USER_TIMESTAMPS', null),
    ],
    'employee' => [
        'table' => env('ATTENDANCE_EMPLOYEE_TABLE', 'attendance_employees'),
        'relations' => env('ATTENDANCE_EMPLOYEE_RELATIONS', ''),
    ],
    'log' => [
        'table' => env('ATTENDANCE_LOG_TABLE', 'attendance_logs'),
    ],
    'sync' => [
        'batch_size' => (int) env('ATTENDANCE_SYNC_BATCH_SIZE', 200),
        'max_retries' => (int) env('ATTENDANCE_SYNC_MAX_RETRIES', 3),
    ],
];
