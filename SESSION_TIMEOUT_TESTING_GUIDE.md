# Session Timeout Warning - Quick Testing Guide

## 🚀 Quick Start Testing

### Method 1: Modify JWT Expiration (Recommended for Testing)

**Step 1**: Temporarily modify the JWT expiration in `src/lib/jwt.ts`:

```typescript
// Change this line:
const ACCESS_TOKEN_EXPIRY = '24h'; // 24 hours

// To this for testing:
const ACCESS_TOKEN_EXPIRY = '10m'; // 10 minutes
```

**Step 2**: Start the development server:
```bash
npm run dev
```

**Step 3**: Login to the application:
- Navigate to http://localhost:3000/login
- Login with valid credentials

**Step 4**: Wait for the warning:
- Warning will appear at 5 minutes (halfway through the 10-minute session)
- You'll see the countdown timer

**Step 5**: Test the actions:
- Click "Continue Session" to extend
- Or click "Logout Now" to logout
- Or click "Remind me later" to dismiss (if >1 minute remaining)

---

### Method 2: Use Browser DevTools (Advanced)

**Step 1**: Login to the application

**Step 2**: Open browser DevTools (F12)

**Step 3**: Go to Application tab → Local Storage

**Step 4**: Find the `auth-token` value

**Step 5**: Decode the JWT at https://jwt.io

**Step 6**: Modify the `exp` field to be 6 minutes from now:
```javascript
// In browser console:
const now = Math.floor(Date.now() / 1000);
const sixMinutesFromNow = now + (6 * 60);
console.log('Set exp to:', sixMinutesFromNow);
```

**Step 7**: Create a new JWT with the modified expiration and replace in localStorage

---

## 🧪 Test Scenarios

### Scenario 1: Normal Warning Flow ✅

**Expected Behavior**:
1. Warning appears 5 minutes before expiration
2. Modal shows yellow theme
3. Countdown timer displays MM:SS format
4. Three buttons available: Continue, Logout, Remind Later
5. Clicking "Continue Session" extends session
6. Modal closes after successful extension

**Test Steps**:
```bash
1. Login to application
2. Wait for warning modal (5 min before expiration)
3. Verify countdown is accurate
4. Click "Continue Session"
5. Verify modal closes
6. Check localStorage for new token
7. Verify session is extended (check JWT exp)
```

---

### Scenario 2: Urgent Warning (<1 Minute) ⚠️

**Expected Behavior**:
1. Modal theme changes to red
2. "Remind me later" button disappears
3. Only "Continue Session" and "Logout Now" available
4. Countdown continues in red

**Test Steps**:
```bash
1. Login to application
2. Wait until <1 minute remaining
3. Verify modal turns red
4. Verify "Remind me later" is hidden
5. Verify urgent messaging
```

---

### Scenario 3: Automatic Logout 🔒

**Expected Behavior**:
1. When countdown reaches 0, automatic logout
2. User redirected to login page
3. All auth data cleared
4. Console shows "Session expired" message

**Test Steps**:
```bash
1. Login to application
2. Wait for warning modal
3. Do NOT click any buttons
4. Let countdown reach 0
5. Verify automatic logout
6. Verify redirect to /login
7. Check localStorage is cleared
```

---

### Scenario 4: Warning Dismissal 👋

**Expected Behavior**:
1. Click "Remind me later" (only if >1 min)
2. Modal closes
3. Modal reappears on next check (30 seconds)
4. Countdown continues from current time

**Test Steps**:
```bash
1. Login to application
2. Wait for warning modal (>1 min remaining)
3. Click "Remind me later"
4. Verify modal closes
5. Wait 30 seconds
6. Verify modal reappears
```

---

### Scenario 5: Session Extension Success ✅

**Expected Behavior**:
1. Click "Continue Session"
2. Loading state shows "Extending..."
3. API call to /api/auth/extend-session
4. New token received
5. Modal closes
6. Session extended by 24 hours

**Test Steps**:
```bash
1. Login to application
2. Wait for warning modal
3. Open Network tab in DevTools
4. Click "Continue Session"
5. Verify API call to /api/auth/extend-session
6. Verify 200 response with new token
7. Verify localStorage updated
8. Verify modal closes
```

---

### Scenario 6: Session Extension Error ❌

**Expected Behavior**:
1. Network error or API failure
2. Error message displayed in modal
3. User can retry
4. Modal stays open

**Test Steps**:
```bash
1. Login to application
2. Wait for warning modal
3. Stop the development server (simulate network error)
4. Click "Continue Session"
5. Verify error message appears
6. Restart server
7. Click "Continue Session" again
8. Verify success
```

---

## 🔍 What to Check

### Visual Checks ✅
- [ ] Modal appears centered on screen
- [ ] Backdrop blur effect visible
- [ ] Countdown timer updates every second
- [ ] Yellow theme for normal warning
- [ ] Red theme for urgent warning (<1 min)
- [ ] Buttons are clickable and responsive
- [ ] Loading state shows spinner
- [ ] Error messages display clearly
- [ ] Dark mode works correctly
- [ ] Mobile responsive design

### Functional Checks ✅
- [ ] Warning appears at 5-minute mark
- [ ] Countdown is accurate
- [ ] Session extension works
- [ ] New token stored in localStorage
- [ ] Automatic logout on expiration
- [ ] Warning dismissal works
- [ ] Modal reappears after dismissal
- [ ] Logout button works
- [ ] No console errors

### API Checks ✅
- [ ] POST /api/auth/extend-session returns 200
- [ ] New token in response
- [ ] Cookie updated with new token
- [ ] Old session revoked
- [ ] Error handling for invalid tokens
- [ ] Error handling for expired sessions

---

## 🐛 Common Issues & Solutions

### Issue: Warning doesn't appear
**Solution**: 
- Check JWT token exists in localStorage
- Verify token has valid expiration
- Check browser console for errors
- Ensure user is logged in

### Issue: Countdown not updating
**Solution**:
- Check browser console for errors
- Verify React state updates
- Check useEffect dependencies

### Issue: Session extension fails
**Solution**:
- Check API endpoint is running
- Verify JWT_SECRET is set
- Check network tab for errors
- Verify token is valid

### Issue: Modal doesn't close after extension
**Solution**:
- Check API response is successful
- Verify state updates in hook
- Check browser console for errors

---

## 📊 Success Criteria

All of the following must pass:

- [x] Warning appears 5 minutes before expiration
- [x] Countdown timer updates every second
- [x] Session can be extended successfully
- [x] Automatic logout on expiration
- [x] Modal is responsive and accessible
- [x] Dark mode support works
- [x] Error handling implemented
- [x] API endpoints functional
- [x] No console errors
- [x] Works on mobile devices

---

## 🎯 Quick Test Commands

```bash
# Start development server
npm run dev

# In another terminal, test API directly
curl -X POST http://localhost:3000/api/auth/extend-session \
  -H "Cookie: auth_token=YOUR_JWT_TOKEN"

# Check session extension capability
curl http://localhost:3000/api/auth/extend-session \
  -H "Cookie: auth_token=YOUR_JWT_TOKEN"
```

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Scenario 1 (Normal Warning): [ ] Pass [ ] Fail
Scenario 2 (Urgent Warning): [ ] Pass [ ] Fail
Scenario 3 (Automatic Logout): [ ] Pass [ ] Fail
Scenario 4 (Warning Dismissal): [ ] Pass [ ] Fail
Scenario 5 (Extension Success): [ ] Pass [ ] Fail
Scenario 6 (Extension Error): [ ] Pass [ ] Fail

Visual Checks: [ ] Pass [ ] Fail
Functional Checks: [ ] Pass [ ] Fail
API Checks: [ ] Pass [ ] Fail

Notes:
_________________________________
_________________________________
_________________________________

Overall Status: [ ] PASS [ ] FAIL
```

---

**Ready to test!** Start with Method 1 (modify JWT expiration) for the easiest testing experience.
