# Testing Guide - Kiosk Attendance App

## 🚀 Quick Test Scenario

### Prerequisites

- ✅ Dependencies installed (`npm install`)
- ✅ MobileFaceNet.onnx model in assets/models/
- ✅ Android device/emulator connected
- ✅ App built and running

---

## 📋 Test Scenarios

### Scenario 1: Initial Setup & Admin Access

**Objective:** Verify admin authentication and settings initialization

1. **Launch App**
   - App should show Kiosk screen with camera preview
   - Status banner shows "READY"
   - Triple-tap the ⚙️ icon (top-right)

2. **Admin Login**
   - Should navigate to PIN entry screen
   - Enter default PIN: `123456`
   - Should navigate to Employee List screen

3. **Verify Settings**
   - Tap "Settings" button
   - Check default values:
     - Threshold: 0.55
     - Device ID: auto-generated UUID
     - Sync Interval: disabled
   - Try changing threshold (slide to 0.60)
   - Go back and verify persistence

**Expected Results:**

- ✅ Admin access works with default PIN
- ✅ Settings load with defaults
- ✅ Changes persist after navigation

---

### Scenario 2: Employee Enrollment

**Objective:** Enroll an employee with face samples

1. **Start Enrollment**
   - From Employee List, tap "+ Add Employee"
   - Enter Name: "John Doe"
   - Enter Code: "EMP001"

2. **Capture Samples**
   - Position face in guide overlay (centered)
   - Tap "Capture Sample" button
   - Repeat 5 times (progress dots should fill)
   - Watch for status messages

3. **Save Employee**
   - After 5 samples, tap "Save"
   - Should return to Employee List
   - "John Doe" appears in list with status badge "Active"

**Expected Results:**

- ✅ All 5 samples captured successfully
- ✅ Employee saved with embedding
- ✅ Employee appears in list immediately
- ✅ Database entry created (check logs)

**Database Verification:**

```sql
-- Check employee record
SELECT id, name, code, status, LENGTH(embedding_avg) as embedding_size
FROM employees WHERE name = 'John Doe';

-- Should show:
-- - id: UUID
-- - embedding_size: 512 bytes (128 floats × 4 bytes)
```

---

### Scenario 3: Face Recognition Check-In

**Objective:** Test face recognition and attendance logging

1. **Return to Kiosk**
   - Navigate back to main screen
   - Position enrolled employee's face in frame

2. **Recognition Process**
   - Status should change: READY → PROCESSING
   - Watch for face detection indicator
   - Result card should appear with:
     - Name: "John Doe"
     - Type: "IN" (first check-in)
     - Confidence: 0.XX
     - Timestamp

3. **Verify Audio/Haptic**
   - Should hear success sound/feel vibration
   - Result card shows for 3-5 seconds

4. **Check Database**
   - Open Reports screen
   - Should see attendance log entry
   - Type: IN, Today's date

**Expected Results:**

- ✅ Face recognized within 1-2 seconds
- ✅ Confidence score ≥ threshold
- ✅ Attendance log created
- ✅ Feedback provided (visual + audio)

---

### Scenario 4: Check-Out Flow

**Objective:** Test IN/OUT logic and duplicate prevention

1. **Immediate Check-Out Attempt**
   - Keep same employee in frame
   - Try to trigger recognition again within 120 seconds

2. **Expected Behavior**
   - Should show "Duplicate prevented" message
   - No new log created
   - Status returns to READY

3. **Wait 2 Minutes**
   - After 120+ seconds, trigger recognition again
   - Should create OUT log
   - Result card shows "OUT"

4. **Verify Log Sequence**
   - Open Reports screen
   - Should see:
     - Latest: John Doe - OUT - [timestamp]
     - Previous: John Doe - IN - [timestamp]

**Expected Results:**

- ✅ Duplicate prevention works (120s window)
- ✅ Check-out creates OUT log
- ✅ IN/OUT alternates correctly

---

### Scenario 5: Multiple Employees

**Objective:** Test matching with multiple enrolled faces

1. **Enroll Second Employee**
   - Repeat Scenario 2 with different person
   - Name: "Jane Smith", Code: "EMP002"

2. **Test Recognition**
   - Show John Doe to camera
   - Should recognize as "John Doe"
   - Show Jane Smith to camera
   - Should recognize as "Jane Smith"

3. **Test Unknown Face**
   - Show unfamiliar face (not enrolled)
   - Should show "Unknown Person" or no match
   - No attendance log created

**Expected Results:**

- ✅ System distinguishes between enrolled employees
- ✅ Correct employee matched each time
- ✅ Unknown faces rejected

---

### Scenario 6: Liveness Detection

**Objective:** Test anti-spoofing measures

1. **Challenge Prompt**
   - Trigger liveness check
   - System may show:
     - "Blink twice" or
     - "Turn head left"

2. **Complete Challenge**
   - Follow on-screen instruction
   - If blink: Close/open eyes twice
   - If head turn: Rotate head to left

3. **Verification**
   - Should accept if challenge passed
   - Should reject if not completed

**Expected Results:**

- ✅ Challenge displayed randomly
- ✅ Recognition only proceeds after liveness check
- ✅ Rejects static photos (if challenge shown)

**Note:** Requires ML Kit eye probability & head angle data.

---

### Scenario 7: Reports & Export

**Objective:** Test reporting and CSV export functionality

1. **View Today's Logs**
   - Navigate to Reports screen
   - Should show all today's logs
   - Summary stats at top:
     - Total IN: X
     - Total OUT: Y

2. **Date Filter**
   - Tap "From" date picker
   - Select yesterday's date
   - Tap "To" date picker
   - Select today's date
   - Should show logs in range

3. **CSV Export**
   - Tap "Export CSV" button
   - System should:
     - Generate CSV file
     - Show share dialog
     - Allow save to device

4. **Verify CSV Content**
   - Open exported file
   - Should contain columns:
     - employee_name, employee_code, type, timestamp, confidence, device_id
   - Data should match on-screen logs

**Expected Results:**

- ✅ Logs display correctly with filters
- ✅ Stats calculate accurately
- ✅ CSV export works without errors
- ✅ CSV data matches database

---

### Scenario 8: Offline Mode

**Objective:** Verify app functions without internet

1. **Disable Network**
   - Turn off Wi-Fi and mobile data
   - Or enable Airplane Mode

2. **Test Core Functions**
   - Enroll new employee → Should work
   - Recognize face → Should work
   - Log attendance → Should work
   - View reports → Should work

3. **Check Sync Status**
   - In Settings, check sync status
   - Should show "Offline" or "Pending"

4. **Enable Network**
   - Turn on Wi-Fi
   - If API URL configured, sync should start
   - Logs marked as "synced" after successful upload

**Expected Results:**

- ✅ All features work offline
- ✅ No crashes or error dialogs
- ✅ Sync auto-resumes when online
- ✅ Data never lost

---

### Scenario 9: Settings Management

**Objective:** Test all settings functionality

1. **Threshold Adjustment**
   - Start at 0.55
   - Lower to 0.40 → More permissive matching
   - Raise to 0.70 → Stricter matching
   - Test recognition at each level

2. **Device ID Management**
   - Note current device ID
   - Tap "Regenerate Device ID"
   - Should generate new UUID
   - Verify new ID displayed

3. **API Configuration**
   - Enter test API URL: `https://api.example.com`
   - Enable sync interval: 15 minutes
   - Should persist after restart

4. **PIN Change**
   - Current PIN: 123456
   - Enter new PIN: 555555
   - Confirm new PIN: 555555
   - Logout and test new PIN works

**Expected Results:**

- ✅ Threshold changes affect matching
- ✅ Device ID regenerates correctly
- ✅ API settings save and load
- ✅ PIN change persists securely

---

### Scenario 10: Error Handling

**Objective:** Test app resilience under error conditions

1. **Camera Blocked**
   - Cover camera lens
   - Should show "No face detected" or waiting status
   - Uncover → resumes normal operation

2. **Poor Lighting**
   - Test in very dark environment
   - Should reject poor quality faces
   - Or show quality warning

3. **Multiple Faces**
   - Show 2+ faces to camera simultaneously
   - Should reject (requires exactly 1 face)
   - Status: "Multiple faces detected"

4. **Database Stress**
   - Enroll 50+ employees
   - Test recognition speed
   - Check logs with 500+ entries
   - All operations should remain fast (<500ms)

5. **Sync Failure**
   - Set invalid API URL: `https://invalid.url`
   - Enable sync
   - Should retry with exponential backoff
   - Check logs for retry attempts
   - No app crashes

**Expected Results:**

- ✅ Graceful degradation in error conditions
- ✅ Clear error messages to user
- ✅ Auto-recovery when conditions improve
- ✅ No data loss or corruption

---

## 🔍 Performance Benchmarks

### Recognition Speed

- **Face Detection:** <50ms per frame
- **Preprocessing:** 10-30ms
- **ONNX Inference:** 50-200ms (depends on device)
- **Total Recognition Time:** 100-300ms

**Target:** <500ms from face detected to result displayed

### Database Performance

- **Insert Employee:** <50ms
- **Query All Active Employees:** <100ms (up to 1000 employees)
- **Insert Attendance Log:** <20ms
- **Query Date Range:** <200ms (up to 10,000 logs)

### Memory Usage

- **Baseline:** ~80-120MB
- **During Recognition:** +20-30MB (camera frames)
- **Peak:** <200MB

---

## 🐛 Common Issues & Solutions

### Issue: Recognition Always Fails

**Symptoms:** Confidence always below threshold

**Debug Steps:**

1. Check model loaded successfully (logs)
2. Verify face samples captured (check DB)
3. Lower threshold temporarily (0.40)
4. Re-enroll employee with better lighting
5. Ensure model is correct MobileFaceNet version

### Issue: Camera Preview Black

**Symptoms:** Camera shows black screen

**Solutions:**

1. Check CAMERA permission granted
2. Try switching device (front/back)
3. Restart app
4. Check Android logs for camera errors

### Issue: Export CSV Fails

**Symptoms:** "Failed to export" error

**Solutions:**

1. Check WRITE_EXTERNAL_STORAGE permission
2. Verify free storage space
3. Check expo-sharing installed
4. Try exporting smaller date range

### Issue: Sync Never Completes

**Symptoms:** Logs stay "unsynced"

**Debug:**

1. Check network connectivity
2. Verify API URL reachable (test in browser)
3. Check API response format (should return 200)
4. View sync logs in console
5. Test with minimal batch (1-5 logs)

---

## 📊 Test Coverage Matrix

| Feature              | Manual Test | Expected Outcome            |
| -------------------- | ----------- | --------------------------- |
| App Launch           | ✅          | Load kiosk screen within 3s |
| Admin Login          | ✅          | PIN authentication works    |
| Employee Enrollment  | ✅          | 5 samples → saved           |
| Face Recognition     | ✅          | Match within 500ms          |
| Attendance Logging   | ✅          | IN/OUT alternates correctly |
| Duplicate Prevention | ✅          | Blocks within 120s          |
| Liveness Detection   | ✅          | Challenge completed         |
| CSV Export           | ✅          | File created with data      |
| Offline Mode         | ✅          | All features work           |
| Sync Service         | ✅          | Retry logic works           |
| Settings Persistence | ✅          | Values saved/loaded         |
| Multi-employee       | ✅          | Correct matching            |
| Error Handling       | ✅          | No crashes                  |

---

## 🧪 Automated Testing (Future)

### Unit Tests

```typescript
// Example: helpers.test.ts
describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });
});
```

### Integration Tests

- Database CRUD operations
- Recognition pipeline
- Sync service retry logic

### E2E Tests (Detox)

- Full enrollment flow
- Recognition to attendance log
- Settings changes

---

## 📝 Test Reporting Template

```markdown
## Test Session Report

**Date:** YYYY-MM-DD
**Device:** [Android device model]
**Android Version:** [version]
**App Version:** Phase-1

### Test Results

- Total Scenarios: 10
- Passed: X
- Failed: Y
- Skipped: Z

### Issues Found

1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce
   - Expected vs Actual

### Performance Observations

- Recognition average time: XXXms
- App launch time: Xs
- Memory usage peak: XXmb

### Recommendations

- [Recommendations for improvements]
```

---

**Ready to Test!** 🚀

Follow the scenarios above in order for comprehensive testing coverage.
