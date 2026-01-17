'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { api } from '@/lib/api-client';

interface FirewallDevice {
  id: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  managementIp: string;
  status: 'active' | 'inactive' | 'offline';
  lastSeenAt: string;
  pollingStatus: {
    isPolling: boolean;
    lastPollTime?: string;
  };
}

export default function FirewallPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [devices, setDevices] = useState<FirewallDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const response = await api.get('/api/firewall/devices');
      const result = await response.json();
      
      if (result.success) {
        setDevices(result.data || []);
      } else {
        setError(result.error?.message || 'Failed to fetch devices');
      }
    } catch (err) {
      console.error('Error fetching firewall devices:', err);
      setError('Failed to connect to firewall service');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-yellow-600 bg-yellow-100';
      case 'offline': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🟢';
      case 'inactive': return '🟡';
      case 'offline': return '🔴';
      default: return '⚪';
    }
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
              🔥 Firewall Management
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Monitor and manage SonicWall firewall devices
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchDevices}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => {/* TODO: Add device registration */}}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ➕ Add Device
            </button>
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
            <div className="text-6xl mb-4">🔥</div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              No Firewall Devices
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Add your first SonicWall device to start monitoring
            </p>
            <button
              onClick={() => {/* TODO: Add device registration */}}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add First Device
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
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        {device.model || 'SonicWall Device'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(device.status)}`}>
                        {getStatusIcon(device.status)} {device.status.toUpperCase()}
                      </span>
                      {device.pollingStatus.isPolling && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-100">
                          📡 Monitoring
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">IP Address:</span>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {device.managementIp}
                        </div>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">Firmware:</span>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {device.firmwareVersion || 'Unknown'}
                        </div>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">Serial:</span>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {device.serialNumber || 'Unknown'}
                        </div>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">Last Seen:</span>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-6">
                    <button
                      onClick={() => {/* TODO: View device details */}}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                    >
                      📊 Details
                    </button>
                    <button
                      onClick={() => {/* TODO: Configure device */}}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                    >
                      ⚙️ Configure
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
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Online</h4>
              <div className="text-2xl font-bold text-green-600">
                {devices.filter(d => d.status === 'active').length}
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Monitoring</h4>
              <div className="text-2xl font-bold text-blue-600">
                {devices.filter(d => d.pollingStatus.isPolling).length}
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Offline</h4>
              <div className="text-2xl font-bold text-red-600">
                {devices.filter(d => d.status === 'offline').length}
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}