'use client';

import { useEffect, useCallback, useState } from 'react';
import { Notification } from '@/types';
import { useToast } from '@/components/notifications';

interface UseNotificationsOptions {
  enableRealTime?: boolean;
  enableToasts?: boolean;
  pollInterval?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    enableRealTime = true,
    enableToasts = true,
    pollInterval = 30000, // 30 seconds
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (limit = 50) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notifications?limit=${limit}`);
      const data = await response.json();

      if (data.success) {
        setNotifications(data.data);
      } else {
        setError(data.error?.message || 'Failed to fetch notifications');
      }
    } catch (error) {
      setError('Network error while fetching notifications');
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread-count');
      const data = await response.json();

      if (data.success) {
        setUnreadCount(data.data.unread_count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notification_id: notificationId }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);

    if (unreadIds.length === 0) return true;

    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notification_ids: unreadIds }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date() }))
        );
        setUnreadCount(0);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }, [notifications]);

  // Add new notification (for real-time updates)
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show toast notification if enabled
    if (enableToasts) {
      addToast({
        title: notification.title,
        message: notification.message,
        type: notification.type,
        duration: 5000,
      });
    }
  }, [enableToasts, addToast]);

  // WebSocket connection for real-time notifications
  useEffect(() => {
    if (!enableRealTime) return;

    // This would establish a WebSocket connection
    // For now, we'll simulate with polling
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enableRealTime, pollInterval, fetchUnreadCount]);

  // Initial data fetch
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Simulate real-time notification (for demo purposes)
  const simulateNotification = useCallback(() => {
    const mockNotification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      tenant_id: 'demo-tenant',
      user_id: 'demo-user',
      title: 'New Security Alert',
      message: 'A high-severity security alert has been detected and requires immediate attention.',
      type: 'error',
      is_read: false,
      metadata: {
        alert_id: 'alert-' + Math.random().toString(36).substr(2, 6),
        severity: 'high',
      },
      created_at: new Date(),
    };

    addNotification(mockNotification);
  }, [addNotification]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
    simulateNotification, // For demo purposes
  };
}