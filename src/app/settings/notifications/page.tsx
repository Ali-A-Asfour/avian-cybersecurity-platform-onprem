'use client';

/**
 * Notification Settings Page
 * Allows users to configure email and SMS notification preferences
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Mail, MessageSquare, Clock, Save, CheckCircle } from 'lucide-react';

type NotificationChannel = 'email' | 'sms' | 'both' | 'none';

interface NotificationPreferences {
    criticalAlertChannel: NotificationChannel;
    highAlertChannel: NotificationChannel;
    mediumAlertChannel: NotificationChannel;
    lowAlertChannel: NotificationChannel;
    ticketAssignedChannel: NotificationChannel;
    ticketUpdatedChannel: NotificationChannel;
    ticketCommentChannel: NotificationChannel;
    slaBreachChannel: NotificationChannel;
    deviceOfflineChannel: NotificationChannel;
    integrationFailureChannel: NotificationChannel;
    phoneNumber: string | null;
    phoneNumberVerified: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    quietHoursTimezone: string;
    emailDigestEnabled: boolean;
    emailDigestFrequency: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
}

export default function NotificationSettingsPage() {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadPreferences();
        }
    }, [user]);

    const loadPreferences = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/users/${user?.id}/notification-preferences`);
            
            if (!response.ok) {
                throw new Error('Failed to load preferences');
            }

            const data = await response.json();
            setPreferences(data);
        } catch (err) {
            setError('Failed to load notification preferences');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async () => {
        try {
            setSaving(true);
            setSaved(false);
            setError(null);

            const response = await fetch(`/api/users/${user?.id}/notification-preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(preferences),
            });

            if (!response.ok) {
                throw new Error('Failed to save preferences');
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError('Failed to save notification preferences');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const updatePreference = (key: keyof NotificationPreferences, value: any) => {
        setPreferences(prev => prev ? { ...prev, [key]: value } : null);
    };

    const ChannelSelector = ({ 
        label, 
        value, 
        onChange,
        description 
    }: { 
        label: string; 
        value: NotificationChannel; 
        onChange: (value: NotificationChannel) => void;
        description?: string;
    }) => (
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                        {label}
                    </label>
                    {description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {description}
                        </p>
                    )}
                </div>
                <div className="ml-4 flex gap-2">
                    <button
                        onClick={() => onChange('none')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            value === 'none'
                                ? 'bg-gray-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        Off
                    </button>
                    <button
                        onClick={() => onChange('email')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            value === 'email'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        <Mail className="w-3 h-3 inline mr-1" />
                        Email
                    </button>
                    <button
                        onClick={() => onChange('sms')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            value === 'sms'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        <MessageSquare className="w-3 h-3 inline mr-1" />
                        SMS
                    </button>
                    <button
                        onClick={() => onChange('both')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            value === 'both'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        Both
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading preferences...</p>
                </div>
            </div>
        );
    }

    if (!preferences) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-red-600">Failed to load notification preferences</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Bell className="w-8 h-8 text-blue-600" />
                        Notification Settings
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Configure how you want to receive alerts and notifications
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                {/* Success Message */}
                {saved && (
                    <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800 dark:text-green-200">Preferences saved successfully!</p>
                    </div>
                )}

                {/* Global Settings */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                        Global Settings
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-gray-900 dark:text-white">
                                    Email Notifications
                                </label>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Enable or disable all email notifications
                                </p>
                            </div>
                            <button
                                onClick={() => updatePreference('emailEnabled', !preferences.emailEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    preferences.emailEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        preferences.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-gray-900 dark:text-white">
                                    SMS Notifications
                                </label>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Enable or disable all SMS notifications
                                </p>
                            </div>
                            <button
                                onClick={() => updatePreference('smsEnabled', !preferences.smsEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    preferences.smsEnabled ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        preferences.smsEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Phone Number (for SMS)
                            </label>
                            <input
                                type="tel"
                                value={preferences.phoneNumber || ''}
                                onChange={(e) => updatePreference('phoneNumber', e.target.value)}
                                placeholder="+1 (555) 123-4567"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {preferences.phoneNumberVerified && (
                                <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" />
                                    Verified
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Security Alerts */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                        Security Alerts
                    </h2>
                    
                    <ChannelSelector
                        label="Critical Alerts"
                        description="Firewall down, EDR threats, security breaches"
                        value={preferences.criticalAlertChannel}
                        onChange={(value) => updatePreference('criticalAlertChannel', value)}
                    />
                    <ChannelSelector
                        label="High Priority Alerts"
                        description="Suspicious activity, policy violations"
                        value={preferences.highAlertChannel}
                        onChange={(value) => updatePreference('highAlertChannel', value)}
                    />
                    <ChannelSelector
                        label="Medium Priority Alerts"
                        description="Configuration changes, warnings"
                        value={preferences.mediumAlertChannel}
                        onChange={(value) => updatePreference('mediumAlertChannel', value)}
                    />
                    <ChannelSelector
                        label="Low Priority Alerts"
                        description="Informational messages"
                        value={preferences.lowAlertChannel}
                        onChange={(value) => updatePreference('lowAlertChannel', value)}
                    />
                </div>

                {/* Ticket Notifications */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                        Ticket Notifications
                    </h2>
                    
                    <ChannelSelector
                        label="Ticket Assigned"
                        description="When a ticket is assigned to you"
                        value={preferences.ticketAssignedChannel}
                        onChange={(value) => updatePreference('ticketAssignedChannel', value)}
                    />
                    <ChannelSelector
                        label="Ticket Updated"
                        description="When a ticket status changes"
                        value={preferences.ticketUpdatedChannel}
                        onChange={(value) => updatePreference('ticketUpdatedChannel', value)}
                    />
                    <ChannelSelector
                        label="Ticket Comments"
                        description="When someone comments on your ticket"
                        value={preferences.ticketCommentChannel}
                        onChange={(value) => updatePreference('ticketCommentChannel', value)}
                    />
                </div>

                {/* System Notifications */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                        System Notifications
                    </h2>
                    
                    <ChannelSelector
                        label="SLA Breach Warnings"
                        description="When tickets approach SLA deadlines"
                        value={preferences.slaBreachChannel}
                        onChange={(value) => updatePreference('slaBreachChannel', value)}
                    />
                    <ChannelSelector
                        label="Device Offline"
                        description="When monitored devices go offline"
                        value={preferences.deviceOfflineChannel}
                        onChange={(value) => updatePreference('deviceOfflineChannel', value)}
                    />
                    <ChannelSelector
                        label="Integration Failures"
                        description="When API integrations fail"
                        value={preferences.integrationFailureChannel}
                        onChange={(value) => updatePreference('integrationFailureChannel', value)}
                    />
                </div>

                {/* Quiet Hours */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Quiet Hours
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        No SMS notifications during these hours (email still delivered)
                    </p>
                    
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-medium text-gray-900 dark:text-white">
                            Enable Quiet Hours
                        </label>
                        <button
                            onClick={() => updatePreference('quietHoursEnabled', !preferences.quietHoursEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.quietHoursEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    preferences.quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    {preferences.quietHoursEnabled && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    value={preferences.quietHoursStart || '22:00'}
                                    onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={preferences.quietHoursEnd || '08:00'}
                                    onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={savePreferences}
                        disabled={saving}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Preferences
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
