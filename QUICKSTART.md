# Quick Start Guide

Follow these steps to get the Kiosk Attendance app running on Android.

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Android Studio** - [Download](https://developer.android.com/studio)
3. **Android SDK** (API 24+) - Install via Android Studio
4. **MobileFaceNet ONNX model** (~3MB file)

## Step-by-Step Setup

### 1. Clone and Install

```bash
cd kioskattendance
npm install
```

### 2. Add Model File

Download or provide `MobileFaceNet.onnx` and place it at:

```
assets/models/MobileFaceNet.onnx
```

Verify model size:

```bash
npm run check-model
```

### 3. Configure Android Environment

Set ANDROID_HOME environment variable:

**Linux/Mac:**

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Windows:**

```cmd
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\emulator;%ANDROID_HOME%\platform-tools
```

### 4. Connect Device or Start Emulator

**Physical Device:**

- Enable Developer Options
- Enable USB Debugging
- Connect via USB
- Verify: `adb devices`

**Emulator:**

- Open Android Studio → Virtual Device Manager
- Create/Start an Android Virtual Device (API 24+)

### 5. Prebuild Native Code

```bash
npx expo prebuild --platform android --clean
```

This generates the `android/` folder with native configuration.

### 6. Build and Run

```bash
npx expo run:android
```

This will:

- Compile the Android app
- Install on connected device/emulator
- Start Metro bundler
- Launch the app

## First Launch

### Initial Setup

1. App opens on Kiosk screen (camera preview)
2. Triple-tap the ⚙️ icon (top-right) to access admin
3. Default PIN: `123456`

### Enroll Your First Employee

1. Admin → Employees → Enroll New
2. Enter name (e.g., "John Doe")
3. Optional: Enter employee code
4. Capture 5 face samples
5. Save

### Test Recognition

1. Return to Kiosk screen
2. Position enrolled face in camera frame
3. App should recognize and log attendance
4. Check Reports to see the log

## Configuration

### Change Admin PIN

Settings → Change Admin PIN

### Adjust Recognition Threshold

Settings → Recognition Threshold slider (0.30 - 0.80)

- Lower = more false positives
- Higher = more false negatives

### Enable API Sync (Optional)

Settings → API Configuration → Enter API Base URL
Settings → Sync Settings → Enable Background Sync

## Troubleshooting

### Build Errors

**Gradle sync failed:**

```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```

**Module not found:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### Runtime Errors

**Camera permission denied:**

- Go to Android Settings → Apps → Kiosk Attendance → Permissions
- Enable Camera permission

**Model loading failed:**

- Verify `assets/models/MobileFaceNet.onnx` exists
- Check model size: `npm run check-model`

**Face recognition not working:**

- Check logs for errors
- Adjust threshold in Settings
- Ensure good lighting
- Face should be frontal and clear

### Development Tips

**View logs:**

```bash
npx expo start
# Then press 'j' to open debugger
# Or: adb logcat | grep "ReactNative"
```

**Clear cache:** ```bash
npx expo start --clear

````

**Rebuild:**
```bash
npx expo prebuild --clean
npx expo run:android
````

## Production Build

For production APK:

```bash
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

Or use EAS Build:

```bash
npm install -g eas-cli
eas build --platform android --profile production
```

## Next Steps

- Configure sync API endpoint
- Add more employees
- Review attendance reports
- Export CSV for payroll

## Support

Check logs, README.md, or contact development team for assistance.

---

**Enjoy using Kiosk Attendance!** 🎉
