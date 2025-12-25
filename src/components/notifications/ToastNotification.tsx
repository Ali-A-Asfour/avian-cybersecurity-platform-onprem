'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ToastNotificationProps {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onClose: (id: string) => void;
}

export function ToastNotification({
  id,
  title,
  message,
  type,
  duration = 5000,
  onClose,
}: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose(id);
    }, 300); // Match animation duration
  };

  if (!isVisible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800',
          icon: 'text-success-600 dark:text-success-400',
          title: 'text-success-800 dark:text-success-200',
          message: 'text-success-700 dark:text-success-300',
        };
      case 'warning':
        return {
          container: 'bg-warning-50 border-warning-200 dark:bg-warning-900/20 dark:border-warning-800',
          icon: 'text-warning-600 dark:text-warning-400',
          title: 'text-warning-800 dark:text-warning-200',
          message: 'text-warning-700 dark:text-warning-300',
        };
      case 'error':
        return {
          container: 'bg-error-50 border-error-200 dark:bg-error-900/20 dark:border-error-800',
          icon: 'text-error-600 dark:text-error-400',
          title: 'text-error-800 dark:text-error-200',
          message: 'text-error-700 dark:text-error-300',
        };
      default:
        return {
          container: 'bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800',
          icon: 'text-primary-600 dark:text-primary-400',
          title: 'text-primary-800 dark:text-primary-200',
          message: 'text-primary-700 dark:text-primary-300',
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={cn(
        'max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden border',
        styles.container,
        'transform transition-all duration-300 ease-in-out',
        isExiting 
          ? 'translate-x-full opacity-0 scale-95' 
          : 'translate-x-0 opacity-100 scale-100'
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className={cn('w-6 h-6 flex items-center justify-center', styles.icon)}>
              {getIcon()}
            </div>
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={cn('text-sm font-medium', styles.title)}>
              {title}
            </p>
            <p className={cn('mt-1 text-sm', styles.message)}>
              {message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className={cn(
                'rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2',
                type === 'success' && 'focus:ring-success-500',
                type === 'warning' && 'focus:ring-warning-500',
                type === 'error' && 'focus:ring-error-500',
                type === 'info' && 'focus:ring-primary-500'
              )}
              onClick={handleClose}
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}