'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/notifications';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export default function NotificationTestPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const { addToast } = useToast();
  const { simulateNotification } = useNotifications();

  const [emailData, setEmailData] = useState({
    template_type: 'custom',
    subject: 'Test Email Notification',
    text_body: 'This is a test email notification from the AVIAN platform.',
  });

  const [customNotification, setCustomNotification] = useState({
    title: 'Test Notification',
    message: 'This is a test notification to demonstrate the notification system.',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });

  const testToastNotification = (type: 'info' | 'success' | 'warning' | 'error') => {
    addToast({
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Toast`,
      message: `This is a ${type} toast notification example.`,
      type,
      duration: 5000,
    });
  };

  const testInAppNotification = async () => {
    setLoading('in-app');
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customNotification),
      });

      const data = await response.json();
      setResults(prev => ({ ...prev, 'in-app': data }));
      
      if (data.success) {
        addToast({
          title: 'Success',
          message: 'In-app notification created successfully',
          type: 'success',
        });
      }
    } catch {
      console.error('Error creating notification:', error);
      addToast({
        title: 'Error',
        message: 'Failed to create in-app notification',
        type: 'error',
      });
    } finally {
      setLoading(null);
    }
  };

  const testEmailNotification = async () => {
    setLoading('email');
    try {
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const data = await response.json();
      setResults(prev => ({ ...prev, email: data }));
      
      if (data.success) {
        addToast({
          title: 'Success',
          message: 'Email notification sent successfully',
          type: 'success',
        });
      }
    } catch {
      console.error('Error sending email:', error);
      addToast({
        title: 'Error',
        message: 'Failed to send email notification',
        type: 'error',
      });
    } finally {
      setLoading(null);
    }
  };

  const testWebSocketNotification = async () => {
    setLoading('websocket');
    try {
      const response = await fetch('/api/notifications/websocket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_test_notification',
          user_id: 'test-user',
          message: 'This is a test WebSocket notification.',
        }),
      });

      const data = await response.json();
      setResults(prev => ({ ...prev, websocket: data }));
      
      if (data.success) {
        addToast({
          title: 'Success',
          message: 'WebSocket notification sent successfully',
          type: 'success',
        });
      }
    } catch {
      console.error('Error sending WebSocket notification:', error);
      addToast({
        title: 'Error',
        message: 'Failed to send WebSocket notification',
        type: 'error',
      });
    } finally {
      setLoading(null);
    }
  };

  const testSLABreachNotification = async () => {
    setLoading('sla-breach');
    try {
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_type: 'sla_breach',
          template_data: {
            ticket_title: 'Critical Security Incident - Data Breach Investigation',
            ticket_id: 'TICKET-2024-001',
            hours_overdue: 4,
          },
        }),
      });

      const data = await response.json();
      setResults(prev => ({ ...prev, 'sla-breach': data }));
      
      if (data.success) {
        addToast({
          title: 'Success',
          message: 'SLA breach notification sent successfully',
          type: 'success',
        });
      }
    } catch {
      console.error('Error sending SLA breach notification:', error);
      addToast({
        title: 'Error',
        message: 'Failed to send SLA breach notification',
        type: 'error',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center dark:bg-primary-900/20">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Notification System Test
            </h1>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Test all notification features including in-app, email, WebSocket, and toast notifications.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Toast Notifications */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Toast Notifications
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Test different types of toast notifications that appear in the top-right corner.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => testToastNotification('info')}
                className="text-primary-600 border-primary-200 hover:bg-primary-50"
              >
                Info Toast
              </Button>
              <Button
                variant="outline"
                onClick={() => testToastNotification('success')}
                className="text-success-600 border-success-200 hover:bg-success-50"
              >
                Success Toast
              </Button>
              <Button
                variant="outline"
                onClick={() => testToastNotification('warning')}
                className="text-warning-600 border-warning-200 hover:bg-warning-50"
              >
                Warning Toast
              </Button>
              <Button
                variant="outline"
                onClick={() => testToastNotification('error')}
                className="text-error-600 border-error-200 hover:bg-error-50"
              >
                Error Toast
              </Button>
            </div>
          </Card>

          {/* Real-time Notifications */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Real-time Notifications
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Test real-time notifications that appear in the notification dropdown.
            </p>
            <Button
              onClick={simulateNotification}
              className="w-full"
            >
              Simulate Real-time Notification
            </Button>
          </Card>

          {/* In-App Notifications */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              In-App Notifications
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Create persistent in-app notifications that are stored in the database.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Title
                </label>
                <Input
                  value={customNotification.title}
                  onChange={(e) => setCustomNotification(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Message
                </label>
                <textarea
                  value={customNotification.message}
                  onChange={(e) => setCustomNotification(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Notification message"
                  className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Type
                </label>
                <select
                  value={customNotification.type}
                  onChange={(e) => setCustomNotification(prev => ({ ...prev, type: e.target.value as any }))}
                  className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <Button
                onClick={testInAppNotification}
                disabled={loading === 'in-app'}
                className="w-full"
              >
                {loading === 'in-app' ? 'Creating...' : 'Create In-App Notification'}
              </Button>
            </div>
          </Card>

          {/* Email Notifications */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Email Notifications
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Test email notification templates and custom emails.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Subject
                </label>
                <Input
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Message
                </label>
                <textarea
                  value={emailData.text_body}
                  onChange={(e) => setEmailData(prev => ({ ...prev, text_body: e.target.value }))}
                  placeholder="Email message"
                  className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={testEmailNotification}
                  disabled={loading === 'email'}
                  variant="outline"
                >
                  {loading === 'email' ? 'Sending...' : 'Send Custom Email'}
                </Button>
                <Button
                  onClick={testSLABreachNotification}
                  disabled={loading === 'sla-breach'}
                  variant="outline"
                  className="text-error-600 border-error-200 hover:bg-error-50"
                >
                  {loading === 'sla-breach' ? 'Sending...' : 'Send SLA Breach Email'}
                </Button>
              </div>
            </div>
          </Card>

          {/* WebSocket Notifications */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              WebSocket Notifications
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Test real-time WebSocket notifications for instant updates.
            </p>
            <Button
              onClick={testWebSocketNotification}
              disabled={loading === 'websocket'}
              className="w-full"
            >
              {loading === 'websocket' ? 'Sending...' : 'Send WebSocket Notification'}
            </Button>
          </Card>

          {/* Results */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Test Results
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              API responses and results from notification tests.
            </p>
            {Object.keys(results).length === 0 ? (
              <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                No test results yet. Run some tests to see the results here.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(results).map(([key, result]) => (
                  <div key={key} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2 capitalize">
                      {key.replace('-', ' ')} Test Result
                    </h3>
                    <pre className="text-xs bg-neutral-100 dark:bg-neutral-800 p-3 rounded overflow-x-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}