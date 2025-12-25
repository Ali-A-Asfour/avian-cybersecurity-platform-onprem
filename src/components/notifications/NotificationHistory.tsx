'use client';

import React, { useEffect, useState } from 'react';
import { Notification } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface NotificationHistoryProps {
  className?: string;
}

export function NotificationHistory({ className }: NotificationHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const itemsPerPage = 20;

  const {
    notifications: allNotifications,
    loading,
    markAsRead,
    fetchNotifications,
  } = useNotifications({ enableRealTime: false, enableToasts: false });

  // Apply filters to notifications
  const filteredNotifications = React.useMemo(() => {
    let filtered = allNotifications;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(n => n.type === filterType);
    }

    // Apply read status filter
    if (filterRead === 'unread') {
      filtered = filtered.filter(n => !n.is_read);
    } else if (filterRead === 'read') {
      filtered = filtered.filter(n => n.is_read);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [allNotifications, filterType, filterRead, searchTerm]);

  // Update pagination when filters change
  useEffect(() => {
    setTotalPages(Math.ceil(filteredNotifications.length / itemsPerPage));
    setCurrentPage(1);
  }, [filteredNotifications.length, itemsPerPage]);

  // Get paginated notifications
  const paginatedNotifications = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredNotifications.slice(startIndex, endIndex);
  }, [filteredNotifications, currentPage, itemsPerPage]);

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-5 h-5";
    
    switch (type) {
      case 'error':
        return (
          <div className="flex-shrink-0 w-8 h-8 bg-error-100 rounded-full flex items-center justify-center dark:bg-error-900/20">
            <svg className={cn(iconClass, "text-error-600 dark:text-error-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="flex-shrink-0 w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center dark:bg-warning-900/20">
            <svg className={cn(iconClass, "text-warning-600 dark:text-warning-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        );
      case 'success':
        return (
          <div className="flex-shrink-0 w-8 h-8 bg-success-100 rounded-full flex items-center justify-center dark:bg-success-900/20">
            <svg className={cn(iconClass, "text-success-600 dark:text-success-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center dark:bg-primary-900/20">
            <svg className={cn(iconClass, "text-primary-600 dark:text-primary-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const notifications = paginatedNotifications;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Notification History
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          View and manage your notification history.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <Input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            >
              <option value="all">All Types</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Read Status Filter */}
          <div>
            <select
              value={filterRead}
              onChange={(e) => setFilterRead(e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Notifications List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">No notifications found</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors',
                  !notification.is_read && 'bg-primary-50/50 dark:bg-primary-900/10'
                )}
              >
                <div className="flex items-start space-x-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={cn(
                          'text-sm font-medium',
                          notification.is_read 
                            ? 'text-neutral-700 dark:text-neutral-300' 
                            : 'text-neutral-900 dark:text-neutral-100'
                        )}>
                          {notification.title}
                        </p>
                        <p className={cn(
                          'mt-1 text-sm',
                          notification.is_read 
                            ? 'text-neutral-500 dark:text-neutral-400' 
                            : 'text-neutral-600 dark:text-neutral-300'
                        )}>
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-xs text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            Mark as read
                          </button>
                        )}
                        <div className="w-2 h-2 bg-primary-500 rounded-full" style={{ opacity: notification.is_read ? 0 : 1 }}></div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDate(notification.created_at)}
                        {notification.read_at && (
                          <span className="ml-2">• Read {formatDate(notification.read_at)}</span>
                        )}
                      </p>
                      {notification.metadata?.ticket_id && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200">
                          Ticket #{notification.metadata.ticket_id.slice(-6)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-700 dark:text-neutral-300">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}