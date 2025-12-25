'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AlertList } from '@/components/alerts/AlertList';
import { AlertFilters } from '@/components/alerts/AlertFilters';
import { AlertStats } from '@/components/alerts/AlertStats';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert, AlertFilters as AlertFiltersType, UserRole } from '@/types';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDemoContext } from '@/contexts/DemoContext';

export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  const router = useRouter();
  const { currentUser } = useDemoContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use demo context to preserve current user role
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </ClientLayout>
    );
  }

  // Allow all user roles to access alerts page
  // Preserve the current user's role context from demo context

  return <AlertsPageContent />;
}

function AlertsPageContent() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [filters, setFilters] = useState<AlertFiltersType>({});
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showMockModal, setShowMockModal] = useState(false);
  const [generatingMock, setGeneratingMock] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [filters]);

  const fetchAlerts = async () => {
    try {
      setAlertsLoading(true);

      // Use mock data for development - filter for unassigned alerts only (triage queue)
      const { mockAlerts, delay } = await import('@/lib/mock-data');
      await delay(500); // Simulate loading

      // Filter for unassigned alerts only (status: open)
      let triageAlerts = mockAlerts.filter(alert => alert.status === 'open');

      // Apply additional filtering if needed
      if (filters.severity && filters.severity.length > 0) {
        triageAlerts = triageAlerts.filter(alert =>
          filters.severity!.includes(alert.severity)
        );
      }

      setAlerts(triageAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleGenerateMockData = async () => {
    try {
      setGeneratingMock(true);

      // Simulate generating mock data
      const { delay } = await import('@/lib/mock-data');
      await delay(1000); // Simulate generation time

      setShowMockModal(false);
      fetchAlerts(); // Refresh the alerts list
    } catch (error) {
      console.error('Error generating mock alerts:', error);
    } finally {
      setGeneratingMock(false);
    }
  };

  const handleAlertClick = (alert: Alert) => {
    setSelectedAlert(alert);
  };

  const handleStatusUpdate = async (alertId: string, status: string) => {
    try {
      // Simulate API call with mock data
      const { delay } = await import('@/lib/mock-data');
      await delay(300); // Simulate update time

      // Update the alert in the list
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, status: status as any } : alert
      ));

      // Update selected alert if it's the same one
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(prev => prev ? { ...prev, status: status as any } : null);
      }
    } catch (error) {
      console.error('Error updating alert status:', error);
    }
  };

  const handleInvestigate = async (alertId: string) => {
    try {
      // For demo purposes, simulate the investigate workflow
      // In a real environment, this would call the proper API with authentication

      // Simulate API delay
      const { delay } = await import('@/lib/mock-data');
      await delay(500);

      // Find the alert
      const alert = alerts.find(a => a.id === alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      // CORRECT WORKFLOW: Investigate assigns alert to current user and moves to "My Alerts"
      // Store the assigned alert in localStorage to simulate cross-page state
      const assignedAlert = {
        ...alert,
        status: 'assigned' as any,
        updated_at: new Date(),
        assigned_to: 'current-user',
        assigned_at: new Date()
      };

      // Get existing assigned alerts from localStorage
      const existingAssigned = JSON.parse(localStorage.getItem('myAlerts') || '[]');
      existingAssigned.push(assignedAlert);
      localStorage.setItem('myAlerts', JSON.stringify(existingAssigned));

      // Remove alert from triage queue (it moves to My Alerts)
      setAlerts(prev => prev.filter(a => a.id !== alertId));

      // Update selected alert if it's the same one
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(null);
      }

      // Alert successfully assigned - no popup needed

    } catch (error) {
      console.error('Error investigating alert:', error);
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
              Alerts (Triage Queue)
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Unassigned alerts awaiting triage. Click "Investigate" to assign alerts to yourself and move them to "My Alerts".
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={() => window.location.href = '/alerts-incidents'}
              className="text-sm bg-blue-600 hover:bg-blue-700"
            >
              Go to New Alerts & Incidents System
            </Button>
            <Button
              onClick={() => setShowMockModal(true)}
              variant="outline"
              className="text-sm"
            >
              Generate Mock Data
            </Button>
          </div>
        </div>

        {/* Migration Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-blue-600 dark:text-blue-400 mt-0.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                New Alerts & Security Incidents System Available
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                We've launched a new comprehensive alerts and security incidents management system with improved workflow, SLA tracking, and incident management.
                <a href="/alerts-incidents" className="font-medium underline hover:no-underline ml-1">
                  Try the new system →
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Alert Statistics */}
        <AlertStats />

        {/* Filters */}
        <AlertFilters
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={fetchAlerts}
        />

        {/* Alert List */}
        <AlertList
          alerts={alerts}
          loading={alertsLoading}
          onAlertClick={handleAlertClick}
          onStatusUpdate={handleStatusUpdate}
          onInvestigate={handleInvestigate}
        />

        {/* Alert Detail Modal */}
        {selectedAlert && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedAlert(null)}
            title="Alert Details"
            size="lg"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Source
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedAlert.source}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Severity
                  </label>
                  <SeverityBadge
                    severity={selectedAlert.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                    size="sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                    {selectedAlert.category.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <StatusBadge
                    status={selectedAlert.status as 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled'}
                    size="sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Title
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedAlert.title}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedAlert.description}
                </p>
              </div>

              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Metadata
                  </label>
                  <div className="mt-1 bg-gray-50 dark:bg-gray-800 rounded-md p-3">
                    <pre className="text-xs text-gray-900 dark:text-white overflow-auto">
                      {JSON.stringify(selectedAlert.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(selectedAlert.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Updated:</span>{' '}
                  {new Date(selectedAlert.updated_at).toLocaleString()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {selectedAlert.status === 'open' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedAlert.id, 'investigating')}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Start Investigation
                  </Button>
                )}
                {selectedAlert.status === 'investigating' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedAlert.id, 'resolved')}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Mark Resolved
                  </Button>
                )}
                {selectedAlert.status !== 'false_positive' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedAlert.id, 'false_positive')}
                    size="sm"
                    variant="outline"
                  >
                    Mark False Positive
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* Mock Data Generation Modal */}
        <Modal
          isOpen={showMockModal}
          onClose={() => setShowMockModal(false)}
          title="Generate Mock Alert Data"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will generate 50 mock security alerts for demonstration purposes.
              The alerts will have various severities, categories, and sources.
            </p>
            <div className="flex space-x-2">
              <Button
                onClick={handleGenerateMockData}
                disabled={generatingMock}
                className="flex-1"
              >
                {generatingMock ? 'Generating...' : 'Generate Mock Alerts'}
              </Button>
              <Button
                onClick={() => setShowMockModal(false)}
                variant="outline"
                disabled={generatingMock}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ClientLayout>
  );
}