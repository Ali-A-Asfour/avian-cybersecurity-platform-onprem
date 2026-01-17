/**
 * Session Timeout Warning Modal
 * Displays a warning when the user's session is about to expire
 */

'use client';

import { useEffect, useState } from 'react';
import { formatTimeRemaining } from '@/hooks/useSessionTimeout';

interface SessionTimeoutWarningProps {
  isVisible: boolean;
  timeRemaining: number; // seconds
  onExtend: () => Promise<boolean>;
  onDismiss: () => void;
  onLogout: () => void;
}

export function SessionTimeoutWarning({
  isVisible,
  timeRemaining,
  onExtend,
  onDismiss,
  onLogout,
}: SessionTimeoutWarningProps) {
  const [isExtending, setIsExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      setIsExtending(false);
      setError(null);
    }
  }, [isVisible]);

  const handleExtend = async () => {
    setIsExtending(true);
    setError(null);

    try {
      const success = await onExtend();
      
      if (success) {
        // Modal will close automatically via isVisible prop
      } else {
        setError('Failed to extend session. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  if (!isVisible) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60);
  const isUrgent = timeRemaining <= 60; // Less than 1 minute

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className={`p-6 border-b ${isUrgent ? 'border-red-200 dark:border-red-800' : 'border-yellow-200 dark:border-yellow-800'}`}>
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                isUrgent 
                  ? 'bg-red-100 dark:bg-red-900/30' 
                  : 'bg-yellow-100 dark:bg-yellow-900/30'
              }`}>
                <svg 
                  className={`w-6 h-6 ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}
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

              {/* Title */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {isUrgent ? 'Session Expiring Soon!' : 'Session Timeout Warning'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Your session will expire in
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Countdown */}
            <div className="text-center mb-6">
              <div className={`text-5xl font-bold mb-2 ${
                isUrgent 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {formatTimeRemaining(timeRemaining)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {minutes > 0 
                  ? `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`
                  : 'Less than a minute remaining'
                }
              </p>
            </div>

            {/* Message */}
            <div className={`rounded-lg p-4 mb-6 ${
              isUrgent 
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            }`}>
              <p className={`text-sm ${
                isUrgent 
                  ? 'text-red-800 dark:text-red-200' 
                  : 'text-yellow-800 dark:text-yellow-200'
              }`}>
                {isUrgent 
                  ? 'Your session is about to expire. You will be logged out automatically if you don\'t take action.'
                  : 'For your security, you will be automatically logged out due to inactivity. Would you like to continue your session?'
                }
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExtend}
                disabled={isExtending}
                className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExtending ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Extending...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Continue Session
                  </>
                )}
              </button>

              <button
                onClick={handleLogout}
                disabled={isExtending}
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Logout Now
              </button>
            </div>

            {/* Dismiss option (only if not urgent) */}
            {!isUrgent && (
              <button
                onClick={onDismiss}
                disabled={isExtending}
                className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remind me later
              </button>
            )}
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Sessions expire after 24 hours of inactivity for security purposes
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
