# Testing Guide: Device Registration & Employee Sync Flow

## Overview

This guide helps verify that the device registration, employee pull, and list display work end-to-end after the recent fixes.

## Prerequisites

- Backend API running with `/api/v1/attendance/devices/register` endpoint
- Valid registration code from backend
- app.json configured with correct `extra.apiBaseUrl`

## Test Sequence

### 1. Device Registration

**Steps:**

1. Start the app
2. Navigate to Settings screen
3. Tap "Register Device" button
4. Enter a valid registration code (get from backend)
5. Tap "Register"

**Expected Console Logs:**

```
✅ Loaded API URL from app.json: http://localhost:8000
POST /api/v1/attendance/devices/register
{
  "registration_code": "YOUR_CODE",
  "...other_fields"
}

✅ Device registered with ID: [device-id]
✅ Updated device token
✅ Updated active org/branch
org_id="2" (type: string), branch_id="1" (type: string)
Sync completed: 0 logs, X employees
```

**Expected UI Changes:**

- Alert shows: "Sync completed: 0 logs, X employees" (X = number of employees pulled)
- After closing alert, Settings screen should show:
  - Device token status: ✓ REGISTERED
  - Warning banner: GONE
  - Sync enabled: ON (toggle should be checked)

### 2. Immediate UI Refresh on Settings Screen

**Steps:**

1. After registration, you should still be on Settings screen
2. Tab away to another screen
3. Tab back to Settings

**Expected Behavior:**

- Device token status should still show: ✓ REGISTERED
- No additional alert
- Employee count data should be present

**Debug Info:**

- Screen focus logs: "Screen focused, reloading employees..."
- No need to restart app to see changes

### 3. Employee List Display

**Steps:**

1. From Settings, tap "Employees" button or navigate to Employee List
2. Observe the list of employees

**Expected Console Logs:**

```
✅ Loaded API URL from app.json: http://localhost:8000
Screen focused, reloading employees...
Query context: orgId="2" (type: string), branchId="1" (type: string)
✅ Loaded 15 employees from database
```

**Expected UI:**

- Employee list shows pulled employees
- Each employee shows: name, code (if available), status (Active/Inactive)
- Search bar works to filter by name or code

**If Employees Don't Appear:**

- Check console for warning: `⚠️ No employees found for org: "X", branch: "Y"`
- This indicates org/branch mismatch in database

### 4. Verify Type Consistency

**Debug Check:**

1. Open browser console or logcat
2. Look for "Query context" log entry
3. Verify format: `type: string` for both org_id and branch_id

**Console Output Should Show:**

```
Query context: orgId="2" (type: string), branchId="1" (type: string)
```

**NOT:**

```
Query context: orgId=2 (type: number), branchId=1 (type: number)
```

### 5. Verify Sync Service Initialization

**Steps:**

1. Check Settings screen "Sync" toggle
2. Should be ON (checked) by default

**Expected:**

- Toggle is checked ✓
- Sync Interval selector is visible and enabled

**Debug:**

- Settings file changed: `initializeSettings()` sets `SYNC_ENABLED="true"` by default

---

## Troubleshooting

### Problem: Device shows "Not Registered" after restart

**Cause:** Device token not being stored in SecureStore

**Fix Applied:**

- setDeviceToken() called after successful registration
- Device status checked on SettingsScreen via useFocusEffect

**To Debug:**

1. Check console for: "✅ Updated device token"
2. Verify storage: SecureStore.getItemAsync(KEYS.DEVICE_TOKEN)

### Problem: Employees not showing in list

**Causes & Fixes:**

**Cause 1: Type Mismatch (FIXED)**

- Backend returns: `org_id: 2` (number)
- Database query expects: `"2"` (string)
- **Fix:** sync.ts now converts: `String(emp.org_id || emp.business_id || orgId)`

**Cause 2: Org/Branch Not Set**

- getActiveOrgBranchIds() throws error
- **Debug:** Check console for error in EmployeeListScreen loadEmployees

**Cause 3: Employee Pull Failed**

- Sync service didn't actually call pullEmployees()
- **Debug:** Check console during registration for sync logs

**To Verify:**

1. Check console: `Query context: orgId="X", branchId="Y"`
2. Check console: `✅ Loaded N employees from database`
3. If N=0, check: employees table in SQLite for matching org_id/branch_id

### Problem: Sync not enabled by default

**Fix Applied:**

- services/settings.ts: `initializeSettings()` now sets `SYNC_ENABLED="true"` instead of "false"

**To Verify:**

1. Fresh app install (or clear app data)
2. Settings > Sync toggle should be checked
3. Console should show: sync operations running in background

---

## Console Log Reference

### Success Path Logs

```
Device Registration:
  ✅ Loaded API URL from app.json: http://localhost:8000
  ✅ Device registered with ID: [id]
  ✅ Updated device token
  ✅ Updated active org/branch

Sync Service:
  org_id="2" (type: string), branch_id="1" (type: string)
  Sync completed: 0 logs, 15 employees

Employee Load:
  Screen focused, reloading employees...
  Query context: orgId="2" (type: string), branchId="1" (type: string)
  ✅ Loaded 15 employees from database
```

### Error Logs to Watch For

```
Failed logs:
  ❌ Failed to load API URL
  ❌ Device registration failed: [reason]
  ❌ Failed to load employees
  ⚠️ No employees found for org: "X", branch: "Y"
  ⚠️ API URL not configured in app.json extra.apiBaseUrl
```

---

## Verification Checklist

After completing all test steps:

- [ ] Device token shows REGISTERED in Settings
- [ ] Employee list shows 5+ employees after registration
- [ ] Sync toggle is ON by default
- [ ] No "Not Registered" warning banner after registration
- [ ] Console shows orgId and branchId as strings (type: string)
- [ ] Screen focus trigger works (navigate away and back)
- [ ] Search filters employees by name/code
- [ ] No crashes when navigating between screens

---

## Configuration Check

### app.json

```json
{
  "extra": {
    "apiBaseUrl": "http://localhost:8000"
  }
}
```

Replace with your production API URL:

```json
{
  "extra": {
    "apiBaseUrl": "https://beta-api.gunmahalalfood.com"
  }
}
```

After changing, rebuild:

```bash
expo prebuild --clean
npm run android  # or your build command
```

---

## Recent Fixes Applied

1. **Head Turn Liveness**: Auto-calibrating to handle both positive and negative euler angles
2. **Device Registration**: Simplified to registration code only, API URL from app.json
3. **Type Consistency**: String coercion in sync.ts for org_id/branch_id
4. **Sync Default**: Changed from disabled to enabled by default
5. **UI Refresh**: useFocusEffect added to SettingsScreen for immediate status updates
6. **Employee Visibility**: useFocusEffect added to EmployeeListScreen with comprehensive logging

---

## Integration Test Script

```typescript
// Run this in browser console after registration
(async () => {
  const orgId = await AsyncStorage.getItem("ACTIVE_ORG_ID");
  const branchId = await AsyncStorage.getItem("ACTIVE_BRANCH_ID");
  const token = await AsyncStorage.getItem("DEVICE_TOKEN");

  console.log("Settings:", { orgId, branchId, token });

  // Query employees
  const employees = await getAllEmployees(orgId, branchId);
  console.log("Employees:", employees);
})();
```
