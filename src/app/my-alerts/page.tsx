'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AlertFilters } from '@/components/alerts/AlertFilters';
import { Button } from '@/components/ui/Button';
import { Alert, AlertFilters as AlertFiltersType } from '@/types';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { AlertDetailModal } from '@/components/alerts-incidents/AlertDetailModal';
import { SecurityAlert } from '@/types/alerts-incidents';

export const dynamic = 'force-dynamic';

export default function MyAlertsPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [filters, setFilters] = useState<AlertFiltersType>({});
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchMyAlerts();
        }
    }, [filters, isAuthenticated]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    const fetchMyAlerts = async () => {
        try {
            setAlertsLoading(true);

            // Simulate API delay
            const { delay } = await import('@/lib/mock-data');
            await delay(500);

            // Read assigned alerts from localStorage (populated by /alerts page when "Investigate" is clicked)
            const storedAlerts = JSON.parse(localStorage.getItem('myAlerts') || '[]');
            let myAlerts: Alert[] = storedAlerts;

            // Apply filtering if needed
            if (filters.severity && filters.severity.length > 0) {
                myAlerts = myAlerts.filter(alert =>
                    filters.severity!.includes(alert.severity)
                );
            }

            setAlerts(myAlerts);
        } catch (error) {
            console.error('Error fetching my alerts:', error);
        } finally {
            setAlertsLoading(false);
        }
    };

    const handleAlertClick = (alert: Alert) => {
        setSelectedAlert(alert);
        setShowDetailModal(true);
    };

    const handleCloseDetailModal = () => {
        setShowDetailModal(false);
        setSelectedAlert(null);
    };

    const handleResolveAsBenign = async (alertId: string, _notes: string) => {
        try {
            // Simulate API delay
            const { delay } = await import('@/lib/mock-data');
            await delay(500);

            // Remove alert from My Alerts (resolved as benign)
            const updatedAlerts = alerts.filter(a => a.id !== alertId);
            setAlerts(updatedAlerts);
            localStorage.setItem('myAlerts', JSON.stringify(updatedAlerts));

            // Close modal
            setSelectedAlert(null);
            setShowDetailModal(false);

            // Alert resolved successfully

        } catch (error) {
            console.error('Error resolving alert as benign:', error);
            // Error logged to console
        }
    };

    const handleEscalate = async (alertId: string) => {
        try {
            // Simulate API delay
            const { delay } = await import('@/lib/mock-data');
            await delay(1000);

            // Find the alert to escalate
            const alert = alerts.find(a => a.id === alertId);
            if (alert) {
                // Create a security ticket from the alert
                const ticket = {
                    id: Date.now().toString(), // Simple ID generation for demo
                    title: `Security Incident: ${alert.title}`,
                    description: `Escalated from alert: ${alert.description}`,
                    status: 'new' as any,
                    priority: alert.severity as any,
                    severity: alert.severity as any,
                    category: 'security_incident' as any,
                    created_at: new Date(),
                    updated_at: new Date(),
                    created_by: 'security-analyst@company.com',
                    tenant_id: 'demo-tenant',
                    requester: 'Security Analyst',
                    assignee: 'Security Analyst',
                    tags: ['security', 'escalated-alert'],
                    source_alert_id: alert.id
                };

                // Add ticket to My Tickets in localStorage
                const existingTickets = JSON.parse(localStorage.getItem('myTickets') || '[]');
                existingTickets.push(ticket);
                localStorage.setItem('myTickets', JSON.stringify(existingTickets));

                // Remove alert from My Alerts
                const updatedAlerts = alerts.filter(a => a.id !== alertId);
                setAlerts(updatedAlerts);
                localStorage.setItem('myAlerts', JSON.stringify(updatedAlerts));
            }

            // Close modal
            setSelectedAlert(null);
            setShowDetailModal(false);

            // Alert escalated successfully

        } catch (error) {
            console.error('Error escalating alert:', error);
            // Error logged to console
        }
    };

    const handleResolveAsFalsePositive = async (alertId: string, _notes: string) => {
        try {
            // Simulate API delay
            const { delay } = await import('@/lib/mock-data');
            await delay(500);

            // Remove alert from My Alerts (resolved as false positive)
            const updatedAlerts = alerts.filter(a => a.id !== alertId);
            setAlerts(updatedAlerts);
            localStorage.setItem('myAlerts', JSON.stringify(updatedAlerts));

            // Close modal
            setSelectedAlert(null);
            setShowDetailModal(false);

            // Alert resolved successfully

        } catch (error) {
            console.error('Error resolving alert as false positive:', error);
            // Error logged to console
        }
    };

    return (
        <ClientLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            My Alerts
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Alerts assigned to you for investigation. Click "View" to see alert details and choose resolution action.
                        </p>
                    </div>
                    <Button
                        onClick={fetchMyAlerts}
                        variant="outline"
                        className="text-sm"
                    >
                        Refresh
                    </Button>
                </div>

                {/* Workflow Guide */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                Alert Resolution Workflow
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                Click "View" to open alert details → Choose resolution: Escalate to Security Incident, Resolve as Benign, or Resolve as False Positive
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <AlertFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    onRefresh={fetchMyAlerts}
                />

                {/* Alert List */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    {alertsLoading ? (
                        <div className="p-6">
                            <div className="animate-pulse space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex space-x-4">
                                        <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : alerts.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                No assigned alerts
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                You don't have any alerts assigned for investigation.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Severity
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Alert
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Source
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {alerts.map((alert) => (
                                        <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <SeverityBadge
                                                    severity={alert.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {alert.title}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                                    {alert.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {alert.source}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(alert.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleAlertClick(alert)}
                                                    className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                                                >
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Alert Detail Modal */}
                {selectedAlert && (
                    <AlertDetailModal
                        alert={{
                            id: selectedAlert.id,
                            tenantId: selectedAlert.tenant_id || 'demo-tenant',
                            sourceSystem: (selectedAlert.source?.toLowerCase() || 'firewall') as 'edr' | 'firewall' | 'email',
                            sourceId: selectedAlert.id,
                            alertType: selectedAlert.category || 'security_alert',
                            classification: selectedAlert.category || 'unknown',
                            severity: selectedAlert.severity as 'critical' | 'high' | 'medium' | 'low',
                            title: selectedAlert.title,
                            description: selectedAlert.description || null,
                            metadata: selectedAlert.metadata || {},
                            seenCount: 1,
                            firstSeenAt: selectedAlert.created_at,
                            lastSeenAt: selectedAlert.updated_at,
                            defenderIncidentId: null,
                            defenderAlertId: null,
                            defenderSeverity: null,
                            threatName: null,
                            affectedDevice: null,
                            affectedUser: null,
                            status: 'assigned',
                            assignedTo: 'current-user',
                            assignedAt: new Date(),
                            detectedAt: selectedAlert.created_at,
                            createdAt: selectedAlert.created_at,
                            updatedAt: selectedAlert.updated_at
                        } as SecurityAlert}
                        isOpen={showDetailModal}
                        onClose={handleCloseDetailModal}
                        onEscalateToIncident={handleEscalate}
                        onResolveAsBenign={handleResolveAsBenign}
                        onResolveAsFalsePositive={handleResolveAsFalsePositive}
                        demoMode={true}
                    />
                )}
            </div>
        </ClientLayout>
    );
}