'use client';

import React, { useState } from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AllAlertsTab } from '@/components/alerts-incidents/AllAlertsTab';
import { MyAlertsTab } from '@/components/alerts-incidents/MyAlertsTab';
import { MySecurityIncidentsTab } from '@/components/alerts-incidents/MySecurityIncidentsTab';
import { AllSecurityIncidentsTab } from '@/components/alerts-incidents/AllSecurityIncidentsTab';
import { PlaybooksTab } from '@/components/alerts-incidents/PlaybooksTab';

type TabType = 'all-alerts' | 'my-alerts' | 'my-incidents' | 'all-incidents' | 'playbooks';

/**
 * Alerts & Security Incidents Demo Page
 * 
 * Demonstrates the complete SOC workflow with mock data:
 * - All Alerts: Triage queue with unassigned alerts
 * - My Alerts: Investigation queue with assigned alerts
 * - My Security Incidents: Owned incidents for resolution
 * - All Security Incidents: Read-only view of all incidents
 * - Playbooks: Investigation playbooks
 */
export default function AlertsIncidentsDemoPage() {
    const [activeTab, setActiveTab] = useState<TabType>('all-alerts');

    // Mock user for demo
    const mockUser = {
        id: 'demo-user-123',
        tenantId: 'demo-tenant-123',
        role: 'security_analyst' as const,
        name: 'Demo Analyst',
        email: 'demo@avian.com'
    };

    const tabs = [
        {
            id: 'all-alerts' as TabType,
            name: 'All Alerts',
            description: 'Triage Queue',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
            ),
        },
        {
            id: 'my-alerts' as TabType,
            name: 'My Alerts',
            description: 'Investigation Queue',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
        },
        {
            id: 'my-incidents' as TabType,
            name: 'My Security Incidents',
            description: 'Owned Incidents',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            id: 'all-incidents' as TabType,
            name: 'All Security Incidents',
            description: 'Read-Only View',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            ),
        },
        {
            id: 'playbooks' as TabType,
            name: 'Playbooks',
            description: 'View Playbooks',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
        },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'all-alerts':
                return <AllAlertsTab tenantId={mockUser.tenantId} demoMode={true} />;
            case 'my-alerts':
                return <MyAlertsTab tenantId={mockUser.tenantId} demoMode={true} />;
            case 'my-incidents':
                return <MySecurityIncidentsTab tenantId={mockUser.tenantId} demoMode={true} />;
            case 'all-incidents':
                return <AllSecurityIncidentsTab tenantId={mockUser.tenantId} demoMode={true} />;
            case 'playbooks':
                return <PlaybooksTab demoMode={true} />;
            default:
                return <AllAlertsTab tenantId={mockUser.tenantId} demoMode={true} />;
        }
    };

    return (
        <ClientLayout>
            <div className="p-6 space-y-6">
                {/* Demo Notice */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                Demo Mode
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                This is a demonstration of the Alerts & Security Incidents workflow with mock data.
                                All interactions are simulated to show the complete SOC process.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Alerts & Security Incidents
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Manage security alerts and incidents through the complete SOC workflow
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="mb-6">
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                                        ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                        }
                                    `}
                                >
                                    <span className={`
                                        mr-2
                                        ${activeTab === tab.id
                                            ? 'text-blue-500 dark:text-blue-400'
                                            : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                                        }
                                    `}>
                                        {tab.icon}
                                    </span>
                                    <div className="text-left">
                                        <div>{tab.name}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            {tab.description}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                    <div className="p-6">
                        {renderTabContent()}
                    </div>
                </div>

                {/* Workflow Information */}
                <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
                        SOC Workflow Overview
                    </h2>

                    {/* SOC Workflow Notice */}
                    <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                            <div className="text-green-600 dark:text-green-400 mt-0.5">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                                    SOC Alert Workflow
                                </h3>
                                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                    Professional SOC process: <strong>All Alerts → "Investigate" → My Alerts → "View" → Resolution</strong>.
                                    In All Alerts, click "Investigate" to assign alerts to yourself. In My Alerts, click "View" to open the resolution modal with 3 options: Escalate to Security Incident, Resolve as Benign, or Resolve as False Positive.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="text-blue-800 dark:text-blue-200">
                            <h3 className="font-medium mb-2">1. Triage (All Alerts)</h3>
                            <p className="text-sm">Review unassigned alerts and claim them for investigation</p>
                        </div>
                        <div className="text-blue-800 dark:text-blue-200">
                            <h3 className="font-medium mb-2">2. Investigation (My Alerts)</h3>
                            <p className="text-sm">Click "View" to open resolution modal with 3 options: Escalate, Resolve as Benign, or Resolve as False Positive</p>
                        </div>
                        <div className="text-blue-800 dark:text-blue-200">
                            <h3 className="font-medium mb-2">3. Investigation (My Security Incidents)</h3>
                            <p className="text-sm">Investigate, resolve, or escalate security incidents with SLA tracking</p>
                        </div>
                        <div className="text-blue-800 dark:text-blue-200">
                            <h3 className="font-medium mb-2">4. Visibility (All Security Incidents)</h3>
                            <p className="text-sm">View all security incidents for awareness and reporting purposes</p>
                        </div>
                        <div className="text-blue-800 dark:text-blue-200">
                            <h3 className="font-medium mb-2">5. Playbooks</h3>
                            <p className="text-sm">View investigation playbooks for guidance</p>
                        </div>
                    </div>
                </div>
            </div>
        </ClientLayout>
    );
}