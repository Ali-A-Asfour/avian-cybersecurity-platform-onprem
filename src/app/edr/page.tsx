'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { api } from '@/lib/api-client';

interface EDRDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  primaryUser: string;
  defenderHealthStatus: string;
  riskScore: number;
  exposureLevel: string;
  intuneComplianceState: string;
  lastSeenAt: string;
}

export default function EDRPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [devices, setDevices] = useState<EDRDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated) {
      fetchDevices();
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      // For now, use mock data since EDR API might not be fully connected
      const mockDevices: EDRDevice[] = [
        {
          id: '1',
          deviceName: 'DESKTOP-JOHN',
          operatingSystem: 'Windows',
          osVersion: '11 Pro',
          primaryUser: 'john.doe@company.com',
          defenderHealthStatus: 'Healthy',
          riskScore: 85,
          exposureLevel: 'High',
          intuneComplianceState: 'noncompliant',
          lastSeenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          deviceName: 'LAPTOP-SARAH',
          operatingSystem: 'macOS',
          osVersion: 'Ventura',
          primaryUser: 'sarah.smith@company.com',
          defenderHealthStatus: 'Healthy',
          riskScore: 45,
          exposureLevel: 'Medium',
          intuneComplianceState: 'compliant',
          lastSeenAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          deviceName: 'SERVER-DB01',
          operatingSystem: 'Windows',
          osVersion: 'Server 2022',
          primaryUser: 'system@company.com',
          defenderHealthStatus: 'Healthy',
          riskScore: 15,
          exposureLevel: 'Low',
          intuneComplianceState: 'compliant',
          lastSeenAt: new Date(Date.now() - 30 * 1000).toISOString()
        }
      ];
      
      setDevices(mockDevices);
    } catch (err) {
      console.error('Error fetching EDR devices:', err);
      setError('Failed to connect to EDR service');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return 'text-red-600 bg-red-100';
    if (riskScore >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getRiskLevel = (riskScore: number) => {
    if (riskScore >= 70) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  };

  const getComplianceColor = (state: string) => {
    switch (state) {
      case 'compliant': return 'text-green-600 bg-green-100';
      case 'noncompliant': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleDeviceAction = async (deviceId: string, action: 'isolate' | 'scan') => {
    try {
      const endpoint = action === 'isolate' ? '/api/edr/actions/isolate' : '/api/edr/actions/scan';
      const response = await api.post(endpoint, {
        deviceId,
        comment: `${action} initiated from EDR dashboard`
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`${action} action initiated successfully`);
        fetchDevices(); // Refresh the list
      } else {
        alert(`Failed to ${action} device: ${result.error?.message}`);
      }
    } catch (error) {
      alert(`Failed to ${action} device: Network error`);
    }
  };

  const handleBulkAction = async (action: 'isolate' | 'scan') => {
    if (selectedDevices.size === 0) {
      alert('Please select devices first');
      return;
    }

    const confirmed = confirm(`Are you sure you want to ${action} ${selectedDevices.size} device(s)?`);
    if (!confirmed) return;

    for (const deviceId of selectedDevices) {
      await handleDeviceAction(deviceId, action);
    }
    
    setSelectedDevices(new Set());
  };

  const toggleDeviceSelection = (deviceId: string) => {
    const newSelection = new Set(selectedDevices);
    if (newSelection.has(deviceId)) {
      newSelection.delete(deviceId);
    } else {
      newSelection.add(deviceId);
    }
    setSelectedDevices(newSelection);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              🛡️ EDR Management
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Monitor and manage endpoint devices via Microsoft Defender
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchDevices}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Sync Now
            </button>
            {selectedDevices.size > 0 && (
              <>
                <button
                  onClick={() => handleBulkAction('scan')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  🔍 Scan Selected ({selectedDevices.size})
                </button>
                <button
                  onClick={() => handleBulkAction('isolate')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  🚨 Isolate Selected ({selectedDevices.size})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-red-600 mr-3">⚠️</div>
              <div>
                <h3 className="text-red-800 font-medium">Error</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-800 rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-4"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Devices List */}
        {!loading && devices.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛡️</div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              No EDR Devices
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Connect Microsoft Defender to start monitoring endpoints
            </p>
            <button
              onClick={fetchDevices}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sync Devices
            </button>
          </div>
        )}

        {!loading && devices.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedDevices.has(device.id)}
                      onChange={() => toggleDeviceSelection(device.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                          {device.deviceName}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(device.riskScore)}`}>
                          {getRiskLevel(device.riskScore)} RISK ({device.riskScore})
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplianceColor(device.intuneComplianceState)}`}>
                          {device.intuneComplianceState.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">User:</span>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">
                            {device.primaryUser}
                          </div>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">OS:</span>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">
                            {device.operatingSystem} {device.osVersion}
                          </div>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">Health:</span>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">
                            {device.defenderHealthStatus}
                          </div>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">Last Seen:</span>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">
                            {new Date(device.lastSeenAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-6">
                    <button
                      onClick={() => handleDeviceAction(device.id, 'scan')}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-sm"
                    >
                      🔍 Scan
                    </button>
                    <button
                      onClick={() => handleDeviceAction(device.id, 'isolate')}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                    >
                      🚨 Isolate
                    </button>
                    <button
                      onClick={() => {/* TODO: View device details */}}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                    >
                      📊 Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {!loading && devices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Total Devices</h4>
              <div className="text-2xl font-bold text-blue-600">{devices.length}</div>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">High Risk</h4>
              <div className="text-2xl font-bold text-red-600">
                {devices.filter(d => d.riskScore >= 70).length}
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Non-Compliant</h4>
              <div className="text-2xl font-bold text-orange-600">
                {devices.filter(d => d.intuneComplianceState === 'noncompliant').length}
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Healthy</h4>
              <div className="text-2xl font-bold text-green-600">
                {devices.filter(d => d.defenderHealthStatus === 'Healthy').length}
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}