# Kiosk Attendance Sync (Laravel 10 Package)

Laravel 10 package for syncing kiosk attendance data with multi-tenant support (org/branch/device), local image storage, and optional queue-based processing.

## Features

- Multi-tenant schema (orgs, branches, devices, employees, shifts, logs)
- Sync endpoints for logs + employees
- Local disk storage for profile JPG
- Optional queue jobs (config-driven)
- Auth driver selectable by config (token / sanctum / jwt)

## Install (Local Package)

From your Laravel app:

```bash
composer require anwar/attendance-sync
```

If this is a local path:

```json
"repositories": [
  {
    "type": "path",
    "url": "../kiosk-attendance-sync"
  }
]
```

Then:

```bash
composer require anwar/attendance-sync:*@dev
```

## Publish Config + Migrations

```bash
php artisan vendor:publish --tag=kiosk-config
php artisan vendor:publish --tag=kiosk-migrations
php artisan migrate
```

## Configuration

`config/kiosk.php`

```php
'auth' => [
  'driver' => env('KIOSK_AUTH_DRIVER', 'sanctum'), // token|sanctum|jwt
  'token_header' => 'X-DEVICE-TOKEN',
],
'queue' => [
  'enabled' => env('KIOSK_QUEUE_ENABLED', false),
  'connection' => env('KIOSK_QUEUE_CONNECTION', 'database'),
],
'storage' => [
  'disk' => env('KIOSK_STORAGE_DISK', 'local'),
  'profile_dir' => 'profiles',
],
```

## Routes

The package registers:

```
POST /api/sync/logs
POST /api/sync/employees
GET  /api/sync/employees?since=timestamp
GET  /api/sync/policies
```

Auth middleware is applied based on `kiosk.auth.driver`.

## Payloads

### Sync Logs

```json
{
  "org_id": "uuid",
  "branch_id": "uuid",
  "device_id": "uuid",
  "logs": [
    {
      "id": "client-log-id",
      "employee_id": "uuid",
      "type": "IN",
      "ts_local": 172345,
      "confidence": 0.78
    }
  ]
}
```

### Sync Employees

```json
{
  "org_id": "uuid",
  "branch_id": "uuid",
  "employees": [
    {
      "id": "uuid",
      "code": "EMP001",
      "name": "John Doe",
      "status": "active",
      "embedding_avg": "base64-float32",
      "profile_image": "base64-jpg"
    }
  ]
}
```

## Queue Jobs

If `KIOSK_QUEUE_ENABLED=true`, the package dispatches `ComputeDailySummaryJob` on log sync.

## Local Storage

Profile images are stored at:

```
storage/app/profiles/{org_id}/{employee_id}.jpg
```

## Notes

- JWT mode assumes you configure an API auth guard (e.g., tymon/jwt-auth).
- Token auth uses a simple header check (customize middleware as needed).

## License

MIT
