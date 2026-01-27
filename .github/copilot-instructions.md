You are a senior React Native engineer. Build an Android-only Phase-1 tablet kiosk attendance app using face recognition with MobileFaceNet ONNX. Use Expo Dev Client + TypeScript, offline-first SQLite, and API sync-ready.

## Product Name

kiosk-attendance

## Core Requirements

1. Tablet kiosk mode: staff check-in/out by face recognition. No GPS, no biometric fingerprint.
2. Offline-first: If internet is absent or backend is not ready, app must function fully offline.
3. Local DB: SQLite via expo-sqlite.
4. Sync-ready: Implement a background sync service that pushes unsynced logs when API is available, but it must be safe to run without backend (no crashes, queue + retry).
5. Model: Use MobileFaceNet ONNX as a local asset at assets/models/mobilefacenet.onnx (size ~3MB).
6. Phase-1 target: Android only. Keep future iOS compatibility in architecture, but do not implement iOS configs now.

## Mandatory Tech Stack

- Expo Dev Client (NOT Expo Go)
- react-native-vision-camera for camera preview and capture
- ML Kit face detection (RN wrapper) for face bounding boxes + landmarks/eye blink probability if available
- onnxruntime-react-native for inference
- expo-sqlite for local DB
- expo-file-system for CSV export and optional photo proof storage
- expo-network or NetInfo for connectivity

## Non-functional

- Must run smoothly on mid-range Android tablets
- Throttle heavy processing: do NOT run ONNX per frame; run every 200–300ms or only when a stable face is detected
- Only process when exactly one face is detected
- Add a model size gate: fail build/CI if model file > 10MB

## Database

Implement schema and migrations (v1):
employees:

- id TEXT PK
- name TEXT NOT NULL
- code TEXT
- status TEXT default 'active'
- embedding_avg BLOB (Float32Array bytes)
- embeddings_json TEXT (optional base64 list for multiple samples)
- updated_at INTEGER
- sync_state TEXT default 'dirty'

attendance_logs:

- id TEXT PK
- employee_id TEXT FK
- type TEXT IN/OUT
- ts_local INTEGER
- confidence REAL
- device_id TEXT
- photo_path TEXT nullable
- synced INTEGER default 0

sync_queue:

- id TEXT PK
- entity_type TEXT ('employee'|'log')
- entity_id TEXT
- payload_json TEXT
- created_at INTEGER
- retry_count INTEGER default 0
- last_error TEXT

## Face Recognition Pipeline

1. Face detection (ML Kit):

- detect face bounding box + landmarks
- require exactly 1 face
- quality gate: face box size min threshold; reject too small/blurred

2. Preprocess:

- crop face from camera image
- resize to 112x112
- normalize as model expects
- convert to float32 tensor shape [1,3,112,112]

3. Inference (onnxruntime-react-native):

- load session from local asset (Expo Asset localUri)
- run to get embedding vector
- L2 normalize embedding

4. Matching:

- cosine similarity with all active employees' embedding_avg
- best match wins if score >= threshold (default 0.55)
- store confidence score

## Liveness (basic anti-spoof)

Implement lightweight liveness:

- random challenge each attempt: "blink twice" OR "turn head left"
- If ML Kit provides eye open probability or head angle, validate challenge
- If not available, require multi-frame consistency for 1–2 seconds before accepting

## Attendance Rules

- For a recognized employee:
  - if last log today is OUT or none -> create IN
  - else create OUT
- Prevent duplicates within 120 seconds for same employee
- Show UI feedback: big name, IN/OUT, time, confidence score

## Screens (minimum)

1. KioskScreen (default):

- live camera preview
- status banner (READY/PROCESSING/SUCCESS/FAIL)
- recognition result card + sound/vibration

2. AdminLoginScreen:

- PIN-based access stored securely (Expo SecureStore)
- change PIN in Settings

3. EmployeeListScreen:

- list employees
- enable/disable
- delete employee (with confirmation)
- open EnrollEmployee

4. EnrollEmployeeScreen:

- capture 5 samples
- show sample count progress
- compute average embedding and store
- store sync_state='dirty'

5. ReportsScreen:

- date range filter
- export CSV to device storage via expo-file-system

6. SettingsScreen:

- threshold slider (0.30–0.80)
- device_id display/regenerate
- api_base_url input (optional)
- sync interval toggle
- admin PIN change

## Sync Service (safe without backend)

- Detect connectivity
- If api_base_url not set, skip sync silently
- If set and online:
  - push unsynced attendance_logs in batches (limit 200) to POST /api/sync/logs
  - on success, mark synced=1
  - on failure, log error and retry with exponential backoff
- Keep code for POST /api/sync/employees optional (dirty employees)
- Implement pull placeholders:
  - GET /api/sync/employees?since=...
  - GET /api/sync/policies
    but do not require backend to exist

## Repo Structure

Create the folder structure exactly:

- src/{app,screens,components,db,ml,services,utils,types}
- scripts/check-model-size.mjs
- assets/models/mobilefacenet.onnx
  Add README.md with setup steps:
- npx create-expo-app
- expo-dev-client install
- expo prebuild
- expo run:android
  Include Android permissions setup for camera.

## Deliverables

- Working app (debug build) that:
  - enrolls employees
  - recognizes faces
  - logs attendance offline in SQLite
  - exports CSV
  - sync service is implemented but optional
- Clean TypeScript code with error handling and logging
- No placeholder pseudo-code: implement real code

Proceed to implement step-by-step, committing coherent units of work.
