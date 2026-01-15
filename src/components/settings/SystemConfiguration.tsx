'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
}

interface Integration {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string | null;
}

interface SystemConfigurationProps {
  className?: string;
}

export function SystemConfiguration({ className }: SystemConfigurationProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const [keysResponse, integrationsResponse] = await Promise.all([
        api.get('/api/settings/system/api-keys'),
        api.get('/api/settings/system/integrations'),
      ]);

      const keysData = await keysResponse.json();
      const integrationsData = await integrationsResponse.json();

      if (keysData.success) {
        setApiKeys(keysData.data);
      }

      if (integrationsData.success) {
        setIntegrations(integrationsData.data);
      }
    } catch (err) {
      console.error('Error loading configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const response = await api.post('/api/settings/system/api-keys', {
        name: newKeyName,
      });
      const data = await response.json();

      if (data.success) {
        setGeneratedKey(data.data.key);
        setApiKeys([...apiKeys, data.data]);
        setNewKeyName('');
      }
    } catch (err) {
      console.error('Error creating API key:', err);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/settings/system/api-keys/${keyId}`);
      const data = await response.json();

      if (data.success) {
        setApiKeys(apiKeys.filter(key => key.id !== keyId));
      }
    } catch (err) {
      console.error('Error deleting API key:', err);
    }
  };

  const handleToggleIntegration = async (integrationId: string, enabled: boolean) => {
    try {
      const response = await api.put(`/api/settings/system/integrations/${integrationId}`, {
        enabled,
      });
      const data = await response.json();

      if (data.success) {
        setIntegrations(integrations.map(int =>
          int.id === integrationId ? { ...int, enabled } : int
        ));
      }
    } catch (err) {
      console.error('Error toggling integration:', err);
    }
  };

  const handleSyncIntegration = async (integrationId: string) => {
    try {
      const response = await api.post(`/api/settings/system/integrations/${integrationId}/sync`);
      const data = await response.json();

      if (data.success) {
        setIntegrations(integrations.map(int =>
          int.id === integrationId ? { ...int, lastSync: new Date().toISOString(), status: 'connected' } : int
        ));
      }
    } catch (err) {
      console.error('Error syncing integration:', err);
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          System Configuration
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Manage API keys, integrations, and system-wide settings.
        </p>
      </div>

      {/* API Keys */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
            API Keys
          </h3>
          <Button
            onClick={() => setShowNewKeyModal(true)}
            size="sm"
          >
            Create New Key
          </Button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="text-center py-8 text-neutral-600 dark:text-neutral-400">
            <p>No API keys created yet</p>
            <p className="text-sm mt-2">Create an API key to integrate with external services</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {key.name}
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 font-mono mt-1">
                    {key.key.substring(0, 20)}...
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                    Created: {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsed && ` • Last used: ${new Date(key.lastUsed).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  onClick={() => handleDeleteApiKey(key.id)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Integrations */}
      <Card className="p-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
          Integrations
        </h3>

        {integrations.length === 0 ? (
          <div className="text-center py-8 text-neutral-600 dark:text-neutral-400">
            <p>No integrations configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {integration.name}
                      </p>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          integration.status === 'connected' && 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
                          integration.status === 'disconnected' && 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
                          integration.status === 'error' && 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        )}
                      >
                        {integration.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      {integration.type}
                      {integration.lastSync && ` • Last synced: ${new Date(integration.lastSync).toLocaleString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => handleSyncIntegration(integration.id)}
                    variant="outline"
                    size="sm"
                    disabled={!integration.enabled}
                  >
                    Sync
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleToggleIntegration(integration.id, !integration.enabled)}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                      integration.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        integration.enabled ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* New API Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Create New API Key
            </h3>

            {generatedKey ? (
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Your API key has been created. Copy it now - you won&apos;t be able to see it again.
                </p>
                <div className="bg-neutral-100 dark:bg-neutral-900 p-3 rounded-md mb-4">
                  <code className="text-sm font-mono break-all">{generatedKey}</code>
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                    }}
                    variant="outline"
                  >
                    Copy to Clipboard
                  </Button>
                  <Button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setGeneratedKey(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API Key"
                    className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-700 dark:border-neutral-600 dark:text-neutral-100"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setNewKeyName('');
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateApiKey}
                    disabled={!newKeyName.trim()}
                  >
                    Create Key
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
