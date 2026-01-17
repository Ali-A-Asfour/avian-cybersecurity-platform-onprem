# Session Timeout Warning Implementation Guide

## Overview
Implement a user-friendly session timeout warning system that alerts users before their session expires and allows them to extend it.

**Priority**: HIGH
**Estimated Effort**: 4-6 hours
**Dependencies**: JWT session management (already implemented)

---

## Requirements

### Functional Requirements
1. Detect when session is about to expire (5 minutes before)
2. Show warning modal/toast to user
3. Provide "Extend Session" button
4. Automatic logout when session expires
5. Redirect to login with "session expired" message
6. Save current page URL for redirect after re-login

### User Experience
- Non-intrusive warning (modal that doesn't block work)
- Clear countdown timer showing time remaining
- Easy one-click session extension
- Graceful handling of expired sessions
- Preserve user's work location for return after re-login

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Side                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  useSessionTimeout Hook                               │  │
│  │  - Monitors JWT expiration                            │  │
│  │  - Triggers warning at 5 minutes                      │  │
│  │  - Handles automatic logout                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SessionTimeoutWarning Component                      │  │
│  │  - Shows modal with countdown                         │  │
│  │  - "Extend Session" button                            │  │
│  │  - Auto-dismiss on extension                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AuthContext                                          │  │
│  │  - Integrates timeout detection                       │  │
│  │  - Handles logout on expiration                       │  │
│  │  - Saves return URL                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            │ API Call
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Server Side                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  POST /api/auth/extend-session                        │  │
│  │  - Validates current session                          │  │
│  │  - Generates new JWT token                            │  │
│  │  - Updates session expiration in DB                   │  │
│  │  - Returns new token                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Session Timeout Hook (2 hours)

**File**: `src/hooks/useSessionTimeout.ts`

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface SessionTimeoutState {
  showWarning: boolean;
  timeRemaining: number; // seconds
  isExpired: boolean;
}

const WARNING_THRESHOLD = 5 * 60; // 5 minutes in seconds
const CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds

export function useSessionTimeout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<SessionTimeoutState>({
    showWarning: false,
    timeRemaining: 0,
    isExpired: false,
  });

  /**
   * Get session expiration from JWT token
   */
  const getSessionExpiration = useCallback((): number | null => {
    const token = localStorage.getItem('auth-token');
    if (!token) return null;

    try {
      // Decode JWT token (without verification - just reading exp)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000; // Convert to milliseconds
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }, []);

  /**
   * Calculate time remaining until session expires
   */
  const calculateTimeRemaining = useCallback((): number => {
    const expirationTime = getSessionExpiration();
    if (!expirationTime) return 0;

    const now = Date.now();
    const remaining = Math.floor((expirationTime - now) / 1000); // Convert to seconds
    return Math.max(0, remaining);
  }, [getSessionExpiration]);

  /**
   * Check session status and update state
   */
  const checkSession = useCallback(() => {
    if (!user) return;

    const timeRemaining = calculateTimeRemaining();

    // Session expired
    if (timeRemaining === 0) {
      setState({
        showWarning: false,
        timeRemaining: 0,
        isExpired: true,
      });
      
      // Save current URL for redirect after re-login
      const currentPath = window.location.pathname + window.location.search;
      localStorage.setItem('return-url', currentPath);
      
      // Logout and redirect
      logout();
      return;
    }

    // Show warning if within threshold
    if (timeRemaining <= WARNING_THRESHOLD) {
      setState({
        showWarning: true,
        timeRemaining,
        isExpired: false,
      });
    } else {
      setState({
        showWarning: false,
        timeRemaining,
        isExpired: false,
      });
    }
  }, [user, calculateTimeRemaining, logout]);

  /**
   * Extend session by calling API
   */
  const extendSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/extend-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to extend session');
      }

      const data = await response.json();

      // Update token in localStorage
      if (data.token) {
        localStorage.setItem('auth-token', data.token);
      }

      // Hide warning
      setState({
        showWarning: false,
        timeRemaining: calculateTimeRemaining(),
        isExpired: false,
      });

      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }, [calculateTimeRemaining]);

  /**
   * Dismiss warning (user acknowledges but doesn't extend)
   */
  const dismissWarning = useCallback(() => {
    setState(prev => ({
      ...prev,
      showWarning: false,
    }));
  }, []);

  /**
   * Set up periodic session checking
   */
  useEffect(() => {
    if (!user) return;

    // Initial check
    checkSession();

    // Set up interval
    const interval = setInterval(checkSession, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [user, checkSession]);

  return {
    showWarning: state.showWarning,
    timeRemaining: state.timeRemaining,
    isExpired: state.isExpired,
    extendSession,
    dismissWarning,
  };
}
```

---

### Step 2: Create Warning Modal Component (1.5 hours)

**File**: `src/components/auth/SessionTimeoutWarning.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  timeRemaining: number; // seconds
  onExtend: () => Promise<boolean>;
  onDismiss: () => void;
}

export function SessionTimeoutWarning({
  isOpen,
  timeRemaining,
  onExtend,
  onDismiss,
}: SessionTimeoutWarningProps) {
  const [extending, setExtending] = useState(false);
  const [countdown, setCountdown] = useState(timeRemaining);

  // Update countdown every second
  useEffect(() => {
    setCountdown(timeRemaining);

    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const handleExtend = async () => {
    setExtending(true);
    const success = await onExtend();
    setExtending(false);

    if (!success) {
      alert('Failed to extend session. Please save your work and log in again.');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Session Expiring Soon
          </h2>

          {/* Message */}
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            Your session will expire in{' '}
            <span className="font-bold text-yellow-600 dark:text-yellow-400 text-xl">
              {formatTime(countdown)}
            </span>
          </p>

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              You will be automatically logged out when the timer reaches zero.
              Click "Stay Logged In" to extend your session.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleExtend}
              disabled={extending}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition-all font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {extending ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Extending...
                </span>
              ) : (
                'Stay Logged In'
              )}
            </button>

            <button
              onClick={onDismiss}
              disabled={extending}
              className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dismiss
            </button>
          </div>

          {/* Info */}
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
            Dismissing this warning will not extend your session
          </p>
        </div>
      </div>
    </>
  );
}
```

---

### Step 3: Create Session Extension API (1 hour)

**File**: `src/app/api/auth/extend-session/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, refreshToken, extractTokenFromCookie } from '@/lib/jwt';

/**
 * POST /api/auth/extend-session
 * Extend the current user session
 */
export async function POST(req: NextRequest) {
  try {
    // Get token from cookie
    const cookieHeader = req.headers.get('cookie');
    const token = extractTokenFromCookie(cookieHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      );
    }

    // Verify current token
    const verifyResult = verifyToken(token);
    if (!verifyResult.valid) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Refresh token (creates new session)
    const result = await refreshToken(token, false); // Use normal session duration

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to extend session' },
        { status: 500 }
      );
    }

    // Create response with new token
    const response = NextResponse.json({
      success: true,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
    });

    // Set new cookie
    response.cookies.set('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Session extension error:', error);
    return NextResponse.json(
      { error: 'Failed to extend session' },
      { status: 500 }
    );
  }
}
```

---

### Step 4: Integrate with AuthContext (0.5 hours)

**File**: `src/contexts/AuthContext.tsx`

Add to the AuthProvider component:

```typescript
// Add to imports
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';

// Inside AuthProvider component, add:
const {
  showWarning,
  timeRemaining,
  extendSession,
  dismissWarning,
} = useSessionTimeout();

// Add to the return statement (before closing </AuthContext.Provider>):
return (
  <AuthContext.Provider value={value}>
    {children}
    <SessionTimeoutWarning
      isOpen={showWarning}
      timeRemaining={timeRemaining}
      onExtend={extendSession}
      onDismiss={dismissWarning}
    />
  </AuthContext.Provider>
);
```

---

### Step 5: Handle Return URL After Re-login (0.5 hours)

**File**: `src/app/login/page.tsx`

Update the login success handler:

```typescript
// After successful login, check for return URL
const returnUrl = localStorage.getItem('return-url');
if (returnUrl) {
  localStorage.removeItem('return-url');
  window.location.href = returnUrl;
} else {
  // Normal redirect logic
  if (data.user.role === 'super_admin') {
    window.location.href = '/super-admin';
  } else {
    window.location.href = '/dashboard';
  }
}
```

---

## Testing Checklist

### Manual Testing

1. **Normal Session Flow**:
   - [ ] Log in to the application
   - [ ] Wait until 5 minutes before session expires
   - [ ] Verify warning modal appears
   - [ ] Verify countdown timer is accurate
   - [ ] Click "Stay Logged In"
   - [ ] Verify modal closes
   - [ ] Verify session is extended (check localStorage token)

2. **Session Expiration**:
   - [ ] Log in to the application
   - [ ] Wait for warning modal
   - [ ] Do NOT extend session
   - [ ] Wait for countdown to reach 0
   - [ ] Verify automatic logout
   - [ ] Verify redirect to login page
   - [ ] Verify "session expired" message (if implemented)

3. **Return URL**:
   - [ ] Navigate to a specific page (e.g., /alerts)
   - [ ] Let session expire
   - [ ] Log in again
   - [ ] Verify redirect back to /alerts

4. **Multiple Tabs**:
   - [ ] Open application in two tabs
   - [ ] Extend session in one tab
   - [ ] Verify other tab also extends (token updated)

5. **Dismiss Warning**:
   - [ ] Wait for warning modal
   - [ ] Click "Dismiss"
   - [ ] Verify modal closes
   - [ ] Verify session still expires at original time

### Automated Testing (Optional)

```typescript
// Example test for useSessionTimeout hook
describe('useSessionTimeout', () => {
  it('should show warning 5 minutes before expiration', () => {
    // Test implementation
  });

  it('should extend session when requested', () => {
    // Test implementation
  });

  it('should logout when session expires', () => {
    // Test implementation
  });
});
```

---

## Configuration

### Adjustable Parameters

In `src/hooks/useSessionTimeout.ts`:

```typescript
// Warning threshold (show warning X seconds before expiration)
const WARNING_THRESHOLD = 5 * 60; // 5 minutes

// Check interval (how often to check session status)
const CHECK_INTERVAL = 10 * 1000; // 10 seconds
```

### Session Durations

In `src/lib/jwt.ts`:

```typescript
const SHORT_SESSION_EXPIRY = '24h'; // Normal session
const LONG_SESSION_EXPIRY = '30d'; // Remember me
```

---

## User Experience Considerations

### Best Practices
1. **Non-blocking**: Modal doesn't prevent user from continuing work
2. **Clear countdown**: User knows exactly how much time remains
3. **Easy extension**: One-click to extend session
4. **Graceful expiration**: Save return URL for seamless re-login
5. **Visual feedback**: Loading state when extending session

### Accessibility
- Modal is keyboard accessible
- Screen reader friendly
- Clear focus management
- Escape key to dismiss

---

## Troubleshooting

### Warning doesn't appe