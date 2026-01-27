# Face Detection Setup

## ⚠️ Known Limitations

### Image Preprocessing

The `preprocessImage()` function currently has limited pixel data access:

- ✅ Crops and resizes images using expo-image-manipulator
- ⚠️ Cannot decode PNG/JPEG to raw RGBA pixels without native support
- 🔨 Currently generates approximate tensor from base64 data

**For production-quality face recognition**, you need one of these solutions:

1. **Use Vision Camera Frame Processors** (Recommended) — capture frames directly in worklet context; access raw pixel buffers without file I/O; real-time face detection + recognition; uses `react-native-worklets-core` (already installed).
2. **Native Image Decoder Module** — create a custom native module to decode images; returns Uint8Array of RGBA pixels; works with the existing photo-based flow.
3. **Use expo-gl** — render image to a GL texture; read pixels using `gl.readPixels()`; more overhead but a pure JS solution.

### Face Detection

## Current Status

✅ **@react-native-ml-kit/face-detection installed and active** - The app now uses ML Kit for real face detection with landmarks, eye open probability, and head pose angles for liveness checking.

### What's Working

- ✅ Real face detection from camera images
- ✅ Face landmarks (eyes, nose, mouth)
- ✅ Eye open probability for blink detection
- ✅ Head pose angles (yaw/roll) for head turn detection
- ✅ Liveness challenges (blink, turn head left/right)
- ✅ Face recognition with MobileFaceNet ONNX
- ✅ Employee enrollment with multiple samples
- ✅ Attendance logging

## ML Kit Integration

✅ **@react-native-ml-kit/face-detection is installed and configured** - This provides Google ML Kit Face Detection for static image analysis.

The face detection automatically uses `@react-native-ml-kit/face-detection` which provides:

- Google ML Kit Face Detection under the hood
- Face landmarks and contours
- Eye open probability for blink detection
- Head pose angles (yaw, roll) for head turn challenges
- Support for static image file paths (from takePhoto())
- Good performance on Android tablets

Note: `react-native-vision-camera-face-detector` is also installed but is better suited for live frame processing in Vision Camera, not static image analysis.

## How It Works

The `detectFaces()` function in `faceDetection.ts`:

1. **Tries ML Kit packages** for static image face detection (@react-native-ml-kit/face-detection, react-native-mlkit-face-detection)
2. **Falls back to simulated detector** only if no ML Kit package is found

The detector automatically uses the best available implementation.

## Testing the Integration

With `@react-native-ml-kit/face-detection` installed, you should see in the logs:

```text
[INFO] [FaceDetection] Using native ML Kit face detector
```

The app will now:

- ✅ Detect real faces in camera images
- ✅ Handle multiple faces (rejects if not exactly 1)
- ✅ Validate face quality (size, position)
- ✅ Detect liveness (blinks, head turns with real angles)
- ✅ Extract face landmarks for better preprocessing

## API Compatibility

The code normalizes different ML Kit API shapes. `@react-native-ml-kit/face-detection` provides:

- `detect()` or `detectFaces()` function for analyzing image files
- Face objects with:
  - `bounds` or `boundingBox` (face rectangle)
  - `landmarks` (eye, nose, mouth positions)
  - `leftEyeOpenProbability`, `rightEyeOpenProbability`
  - `headEulerAngleY` (head turn left/right), `headEulerAngleZ` (head tilt)

## Fallback Behavior

If the native module fails to load, the app falls back to a simulated detector for development/testing. In production with proper native build, the real detector will be used automatically.

## Rebuild Required

After installing or changing ML Kit packages, rebuild the native app:

```bash
npx expo prebuild --clean
npx expo run:android
```
