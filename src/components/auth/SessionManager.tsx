'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

/**
 * Session Manager Component
 * Handles session expiration and warnings
 * Part of production authentication system (Task 7.2)
 */

interface SessionManagerProps {
    warningMinutes?: number; // Show warning X minutes before expiration
    checkInterval?: number; // Check session every X seconds
}

export function SessionManager({
    warningMinutes = 5,
    checkInterval = 60,
}: SessionManagerProps) {
    const { isAuthenticated, checkAuth, logout } = useAuth();
    const router = useRouter();
    const [showWarning, setShowWarning] = useState(false);
    const [timeRemaining] = useState<number | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        // Check session periodically
        const interval = setInterval(async () => {
            const isValid = await checkAuth();

            if (!isValid) {
                // Session expired
                setShowWarning(false);
                router.push('/login?expired=true');
            }
        }, checkInterval * 1000);

        return () => clearInterval(interval);
    }, [isAuthenticated, checkAuth, checkInterval, router]);

    // Don't render anything if not showing warning
    if (!showWarning || !isAuthenticated) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 max-w-sm bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-lg p-4 z-50">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <svg
                        className="h-5 w-5 text-yellow-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Session Expiring Soon
                    </h3>
                    <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                        Your session will expire in {timeRemaining} minute(s). Please save your work.
                    </p>
                    <div className="mt-3 flex space-x-2">
                        <button
                            onClick={() => {
                                checkAuth();
                                setShowWarning(false);
                            }}
                            className="text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100"
                        >
                            Extend Session
                        </button>
                        <button
                            onClick={() => setShowWarning(false)}
                            className="text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => setShowWarning(false)}
                    className="ml-3 flex-shrink-0 text-yellow-400 hover:text-yellow-500"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

/**
 * Activity Tracker Component
 * Tracks user activity to prevent unnecessary session expiration
 */
export function ActivityTracker() {
    const { isAuthenticated, checkAuth } = useAuth();
    const [lastActivity, setLastActivity] = useState(Date.now());

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        const handleActivity = () => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity;

            // If more than 5 minutes since last activity, refresh session
            if (timeSinceLastActivity > 5 * 60 * 1000) {
                checkAuth();
            }

            setLastActivity(now);
        };

        events.forEach((event) => {
            window.addEventListener(event, handleActivity);
        });

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [isAuthenticated, checkAuth, lastActivity]);

    return null;
}
