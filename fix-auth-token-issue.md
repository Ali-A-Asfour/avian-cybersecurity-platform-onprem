# Fix Authentication Token Issue

## Root Cause Found ✅
The 503 errors are caused by **invalid or expired JWT tokens** stored in your browser. The server logs show:

```
ERROR: Authentication middleware error
Error: Invalid or expired access token
```

## Solution: Clear Authentication State

### Method 1: Browser Developer Tools (Recommended)
1. **Open Developer Tools** (F12)
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Clear Local Storage**:
   - Find `localStorage` in the left sidebar
   - Delete these keys:
     - `auth-token`
     - `auth-user` 
     - `auth-refresh-token`
     - Any keys starting with `avian-` or `auth-`
4. **Clear Session Storage** (same process)
5. **Clear Cookies** for the domain
6. **Refresh the page** (F5)

### Method 2: Browser Console (Quick)
1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Run this command**:
```javascript
// Clear all authentication data
localStorage.clear();
sessionStorage.clear();
document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});
location.reload();
```

### Method 3: Manual Logout and Login
1. **Try to logout** (if logout button works)
2. **Clear browser data** as above
3. **Navigate to** https://192.168.1.115/login
4. **Login again** with your credentials

## Expected Results After Fix
- ✅ No more 503 errors
- ✅ Fresh authentication tokens
- ✅ Dashboard loads properly
- ✅ All pages work correctly

## Why This Happened
The authentication tokens in your browser became invalid/expired, but the browser kept trying to use them. This caused the authentication middleware to reject requests with 503 errors.

## Prevention
This shouldn't happen again once you have fresh tokens. The platform should handle token expiration gracefully in the future.