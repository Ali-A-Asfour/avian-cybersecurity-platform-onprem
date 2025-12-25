'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  sms: boolean;
}

interface NotificationPreferencesProps {
  className?: string;
}

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      id: 'ticket_assigned',
      label: 'Ticket Assignments',
      description: 'When a ticket is assigned to you',
      email: true,
      push: true,
      sms: false,
    },
    {
      id: 'ticket_status_change',
      label: 'Ticket Status Changes',
      description: 'When ticket status is updated',
      email: true,
      push: false,
      sms: false,
    },
    {
      id: 'sla_breach',
      label: 'SLA Breaches',
      description: 'When tickets breach SLA deadlines',
      email: true,
      push: true,
      sms: true,
    },
    {
      id: 'high_severity_alerts',
      label: 'High Severity Alerts',
      description: 'Critical and high severity security alerts',
      email: true,
      push: true,
      sms: false,
    },
    {
      id: 'compliance_updates',
      label: 'Compliance Updates',
      description: 'Compliance framework and control changes',
      email: true,
      push: false,
      sms: false,
    },
    {
      id: 'escalations',
      label: 'Escalations',
      description: 'When tickets are escalated to you',
      email: true,
      push: true,
      sms: true,
    },
  ]);

  const [globalSettings, setGlobalSettings] = useState({
    digest_frequency: 'immediate' as 'immediate' | 'hourly' | 'daily' | 'weekly',
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load preferences on component mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      const data = await response.json();
      
      if (data.success) {
        const prefs = data.data;
        
        // Update global settings
        setGlobalSettings({
          digest_frequency: prefs.digest_frequency,
          quiet_hours_enabled: prefs.quiet_hours_enabled,
          quiet_hours_start: prefs.quiet_hours_start,
          quiet_hours_end: prefs.quiet_hours_end,
        });

        // Update notification type preferences
        if (prefs.notification_types) {
          setPreferences(prev =>
            prev.map(pref => ({
              ...pref,
              email: prefs.notification_types[pref.id]?.email ?? pref.email,
              push: prefs.notification_types[pref.id]?.push ?? pref.push,
              sms: prefs.notification_types[pref.id]?.sms ?? pref.sms,
            }))
          );
        }
      }
    } catch {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (
    preferenceId: string,
    channel: 'email' | 'push' | 'sms',
    enabled: boolean
  ) => {
    setPreferences(prev =>
      prev.map(pref =>
        pref.id === preferenceId
          ? { ...pref, [channel]: enabled }
          : pref
      )
    );
  };

  const handleGlobalSettingChange = (setting: string, value: any) => {
    setGlobalSettings(prev => ({
      ...prev,
      [setting]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Prepare notification types object
      const notificationTypes: Record<string, any> = {};
      preferences.forEach(pref => {
        notificationTypes[pref.id] = {
          email: pref.email,
          push: pref.push,
          sms: pref.sms,
        };
      });

      const preferencesData = {
        ...globalSettings,
        notification_types: notificationTypes,
      };

      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencesData),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch {
      console.error('Error saving preferences:', error);
      // You could add error handling UI here
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Notification Preferences
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Manage how and when you receive notifications about security events and updates.
        </p>
      </div>

      {/* Global Settings */}
      <Card className="p-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
          Global Settings
        </h3>
        
        <div className="space-y-4">
          {/* Digest Frequency */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Email Digest Frequency
            </label>
            <select
              value={globalSettings.digest_frequency}
              onChange={(e) => handleGlobalSettingChange('digest_frequency', e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            >
              <option value="immediate">Immediate</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {/* Quiet Hours */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Quiet Hours
              </label>
              <button
                type="button"
                onClick={() => handleGlobalSettingChange('quiet_hours_enabled', !globalSettings.quiet_hours_enabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  globalSettings.quiet_hours_enabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    globalSettings.quiet_hours_enabled ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
            {globalSettings.quiet_hours_enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={globalSettings.quiet_hours_start}
                    onChange={(e) => handleGlobalSettingChange('quiet_hours_start', e.target.value)}
                    className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={globalSettings.quiet_hours_end}
                    onChange={(e) => handleGlobalSettingChange('quiet_hours_end', e.target.value)}
                    className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Notification Types */}
      <Card className="p-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
          Notification Types
        </h3>
        
        <div className="space-y-6">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 pb-2">
            <div className="col-span-6">Notification Type</div>
            <div className="col-span-2 text-center">Email</div>
            <div className="col-span-2 text-center">Push</div>
            <div className="col-span-2 text-center">SMS</div>
          </div>

          {/* Preference Rows */}
          {preferences.map((preference) => (
            <div key={preference.id} className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-6">
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {preference.label}
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {preference.description}
                  </p>
                </div>
              </div>
              
              {/* Email Toggle */}
              <div className="col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => handlePreferenceChange(preference.id, 'email', !preference.email)}
                  className={cn(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    preference.email ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      preference.email ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>

              {/* Push Toggle */}
              <div className="col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => handlePreferenceChange(preference.id, 'push', !preference.push)}
                  className={cn(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    preference.push ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      preference.push ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>

              {/* SMS Toggle */}
              <div className="col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => handlePreferenceChange(preference.id, 'sms', !preference.sms)}
                  className={cn(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    preference.sms ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      preference.sms ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'min-w-[120px]',
            saved && 'bg-success-600 hover:bg-success-700'
          )}
        >
          {saving ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </div>
          ) : saved ? (
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </div>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>
    </div>
  );
}