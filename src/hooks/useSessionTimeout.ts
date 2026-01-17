/**
 * Session Timeout Detection Hook
 * Monitors session expiration and provides warnings
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SessionTimeoutState {
  isWarningVisible: boolean;
  timeRemaining: number; // seconds
  isExpired: boolean;
}

interface UseSessionTimeoutOptions {
  warningThresholdMinutes?: number; // Show warning X minutes before expiration
  checkIntervalSeconds?: number; // How often to check session status
  onWarning?: () => void;
  onExpired?: () => void;
}

/**
 * Hook to monitor session timeout and show warnings
 */
export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const {
    warningThresholdMinutes = 5,
    checkIntervalSeconds = 30,
    onWarning,
    onExpired,
  } = options;

  const { user, logout } = useAuth();
  const [state, setState] = useState<SessionTimeoutState>({
    isWarningVisible: false,
    timeRemaining: 0,
    isExpired: false,
  });

  const warningShownRef = useRef(false);
  const expiredHandledRef = useRef(false);

  /**
   * Get session expiration time from localStorage
   */
  const getSessionExpiration = useCallback((): Date | null => {
    try {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        return null;
      }

      // Decode JWT to get expiration (without verification)
      const parts = authToken.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) {
        return null;
      }

      // JWT exp is in seconds, convert to milliseconds
      return new Date(payload.exp * 1000);
    } catch (error) {
      console.error('Failed to get session expiration:', error);
      return null;
    }
  }, []);

  /**
   * Calculate time remaining until session expires
   */
  const calculateTimeRemaining = useCallback((): number => {
    const expirationDate = getSessionExpiration();
    if (!expirationDate) {
      return 0;
    }

    const now = new Date();
    const remaining = Math.floor((expirationDate.getTime() - now.getTime()) / 1000);
    return Math.max(0, remaining);
  }, [getSessionExpiration]);

  /**
   * Check session status and update state
   */
  const checkSessionStatus = useCallback(() => {
    if (!user) {
      // No user logged in, reset state
      setState({
        isWarningVisible: false,
        timeRemaining: 0,
        isExpired: false,
      });
      warningShownRef.current = false;
      expiredHandledRef.current = false;
      return;
    }

    const timeRemaining = calculateTimeRemaining();
    const warningThresholdSeconds = warningThresholdMinutes * 60;

    // Check if session has expired
    if (timeRemaining <= 0) {
      if (!expiredHandledRef.current) {
        console.log('[SessionTimeout] Session expired, logging out...');
        setState({
          isWarningVisible: false,
          timeRemaining: 0,
          isExpired: true,
        });
        expiredHandledRef.current = true;
        onExpired?.();
        
        // Logout user
        logout();
      }
      return;
    }

    // Check if we should show warning
    if (timeRemaining <= warningThresholdSeconds) {
      if (!warningShownRef.current) {
        console.log(`[SessionTimeout] Warning: ${timeRemaining} seconds remaining`);
        warningShownRef.current = true;
        onWarning?.();
      }

      setState({
        isWarningVisible: true,
        timeRemaining,
        isExpired: false,
      });
    } else {
      // Session is healthy
      setState({
        isWarningVisible: false,
        timeRemaining,
        isExpired: false,
      });
      warningShownRef.current = false;
    }
  }, [user, calculateTimeRemaining, warningThresholdMinutes, onWarning, onExpired, logout]);

  /**
   * Extend the session by refreshing the token
   */
  const extendSession = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[SessionTimeout] Extending session...');
      
      const response = await fetch('/api/auth/extend-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[SessionTimeout] Failed to extend session:', response.statusText);
        return false;
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('[SessionTimeout] Session extended successfully');
        
        // Update token in localStorage
        if (data.token) {
          localStorage.setItem('auth-token', data.token);
        }

        // Reset warning state
        warningShownRef.current = false;
        setState({
          isWarningVisible: false,
          timeRemaining: calculateTimeRemaining(),
          isExpired: false,
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('[SessionTimeout] Error extending session:', error);
      return false;
    }
  }, [calculateTimeRemaining]);

  /**
   * Dismiss the warning (user acknowledges but doesn't extend)
   */
  const dismissWarning = useCallback(() => {
    setState(prev => ({
      ...prev,
      isWarningVisible: false,
    }));
  }, []);

  /**
   * Set up periodic session checks
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    // Initial check
    checkSessionStatus();

    // Set up interval for periodic checks
    const interval = setInterval(() => {
      checkSessionStatus();
    }, checkIntervalSeconds * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [user, checkSessionStatus, checkIntervalSeconds]);

  /**
   * Update countdown every second when warning is visible
   */
  useEffect(() => {
    if (!state.isWarningVisible) {
      return;
    }

    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        timeRemaining: Math.max(0, prev.timeRemaining - 1),
      }));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [state.isWarningVisible]);

  return {
    ...state,
    extendSession,
    dismissWarning,
    checkSessionStatus,
  };
}

/**
 * Format seconds into human-readable time
 */
export function formatTimeRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${remainingSeconds}s`;
}
