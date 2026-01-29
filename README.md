# Kiosk Attendance (kiosk-attendance)

Android-first tablet kiosk attendance app using face recognition (MobileFaceNet ONNX), offline-first SQLite, and optional backend sync.

## Features

- Face recognition (MobileFaceNet ONNX) with ML Kit face detection
- Offline-first attendance logging (expo-sqlite)
- Liveness checks (blink/head turn)
- Employee enrollment with duplicate detection
- Reports with employee name + filter + CSV export
- Sync-ready background service (safe without backend)
- Multi-tenant ready (org/branch/device)

## Tech Stack

- Expo Dev Client (not Expo Go)
- React Native + TypeScript
- react-native-vision-camera
- @react-native-ml-kit/face-detection
- onnxruntime-react-native
- expo-sqlite, expo-file-system, expo-secure-store

## Setup

1. Install dependencies

```bash
npm install
```

2. Add the MobileFaceNet model

Place your model at:

```
assets/models/MobileFaceNet.onnx
```

Validate size:

```bash
npm run check-model
```

3. Prebuild + run Android

```bash
npm run prebuild
npm run android
```

## Android Permissions

Configured in `app.json`:

- CAMERA
- INTERNET
- ACCESS_NETWORK_STATE
- READ/WRITE_EXTERNAL_STORAGE (for CSV export)

## Project Structure

```
app/                # expo-router screens
screens/            # UI screens
ml/                 # face detection + recognition
services/           # attendance, sync, settings
utils/              # helpers + constants
assets/models/      # MobileFaceNet.onnx
scripts/            # check-model-size.mjs
```

## Reports

- Table view with Name / IN-OUT / Date (except Today) / Time / Status
- Filter by employee (searchable dropdown)
- CSV export
- Monthly CSV report is generated when filter = "month"

## Backend Sync (Optional)

This repo includes a Laravel 10 package scaffold in:

```
backend/kiosk-attendance-sync
```

See its README for setup.

## Notes

- First launch seeds a default org + branch + device ID locally.
- Database schema is multi-tenant (org_id, branch_id on key tables).
- If you need shift-based late/early/OT computation, ask and we’ll add it.

## Troubleshooting

- **Model not found**: verify `assets/models/MobileFaceNet.onnx` exists.
- **DB locked**: app now serializes writes and uses WAL + busy_timeout.

## License

MIT (if you want a different license, tell me).

## Design System (UI Kit)

Use tokens from `src/ui` and UI primitives from `src/components/ui` for consistent kiosk + admin screens.

Text variants:
- Kiosk: `Kiosk/H1`, `Kiosk/H2`, `Kiosk/Body`
- Admin: `Admin/H1`, `Admin/H2`, `Admin/Body`, `Admin/Caption`

Example:
```tsx
import { Text } from "../src/components/ui/Text";

<Text variant="Admin/H2">Employees</Text>
```

Colors:
- Use `colors.brand.*`, `colors.bg.*`, and `colors.status.*` from `src/ui/tokens.ts`.

Status chips:
- `P` = Present
- `A` = Absent
- `LI` = Late In
- `LO` = Late Out
- `NL` = No Logout
- `INFO` = Info

Example:
```tsx
import { StatusChip } from "../src/components/ui/StatusChip";

<StatusChip code="P" />
```
