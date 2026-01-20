'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { api } from '@/lib/api-client';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

interface SonicWallDevice {
  managementIp: string;
  username: string;
  password: string;
  deviceName?: string;
  location?: string;
  networkSegment?: string;
}

interface MicrosoftCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export default function CreateTenantPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [tenantInfo, setTenantInfo] = useState({
    name: '',
    domain: '',
    industry: '',
    contact: '',
    timezone: 'EST',
    identifier: '' // Alternative identifier for clients without domains
  });
  
  const [sonicwallDevices, setSonicwallDevices] = useState<SonicWallDevice[]>([]);
  const [newDevice, setNewDevice] = useState<SonicWallDevice>({
    managementIp: '',
    username: '',
    password: '',
    deviceName: '',
    location: '',
    networkSegment: ''
  });
  
  const [microsoftCreds, setMicrosoftCreds] = useState<MicrosoftCredentials>({
    tenantId: '',
    clientId: '',
    clientSecret: ''
  });

  const [testResults, setTestResults] = useState<{
    sonicwall: { [ip: string]: 'testing' | 'success' | 'failed' };
    microsoft: 'testing' | 'success' | 'failed' | null;
  }>({
    sonicwall: {},
    microsoft: null
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check if user has permission to create tenants (super admin only)
    if (!authLoading && isAuthenticated && user) {
      if (user.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const steps: OnboardingStep[] = [
    {
      id: 'basic',
      title: 'Tenant Information',
      description: 'Organization details and contact information',
      completed: currentStep > 1,
      current: currentStep === 1
    },
    {
      id: 'sonicwall',
      title: 'SonicWall Devices',
      description: 'Add and configure firewall devices',
      completed: currentStep > 2,
      current: currentStep === 2
    },
    {
      id: 'microsoft',
      title: 'Microsoft Defender',
      description: 'Connect Microsoft 365 tenant',
      completed: currentStep > 3,
      current: currentStep === 3
    },
    {
      id: 'verification',
      title: 'Create Tenant',
      description: 'Review and create the new tenant',
      completed: currentStep > 4,
      current: currentStep === 4
    }
  ];

  const handleAddSonicWallDevice = async () => {
    if (!newDevice.managementIp || !newDevice.username || !newDevice.password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setTestResults(prev => ({
      ...prev,
      sonicwall: { ...prev.sonicwall, [newDevice.managementIp]: 'testing' }
    }));

    try {
      // Test connection first
      const response = await api.post('/api/onboarding/firewall/test', {
        managementIp: newDevice.managementIp,
        username: newDevice.username,
        password: newDevice.password
      });

      const result = await response.json();
      
      if (result.success) {
        // Add to devices list
        setSonicwallDevices(prev => [...prev, { ...newDevice }]);
        setTestResults(prev => ({
          ...prev,
          sonicwall: { ...prev.sonicwall, [newDevice.managementIp]: 'success' }
        }));
        
        // Reset form
        setNewDevice({
          managementIp: '',
          username: '',
          password: '',
          deviceName: '',
          location: '',
          networkSegment: ''
        });
      } else {
        setTestResults(prev => ({
          ...prev,
          sonicwall: { ...prev.sonicwall, [newDevice.managementIp]: 'failed' }
        }));
        setError(result.error?.message || 'Failed to connect to SonicWall device');
      }
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        sonicwall: { ...prev.sonicwall, [newDevice.managementIp]: 'failed' }
      }));
      setError('Network error while testing SonicWall connection');
    } finally {
      setLoading(false);
    }
  };

  const handleTestMicrosoftConnection = async () => {
    if (!microsoftCreds.tenantId || !microsoftCreds.clientId || !microsoftCreds.clientSecret) {
      setError('Please fill in all Microsoft Graph credentials');
      return;
    }

    setLoading(true);
    setError(null);
    setTestResults(prev => ({ ...prev, microsoft: 'testing' }));

    try {
      const response = await api.post('/api/onboarding/defender/test', microsoftCreds);
      const result = await response.json();
      
      if (result.success) {
        setTestResults(prev => ({ ...prev, microsoft: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, microsoft: 'failed' }));
        setError(result.error?.message || 'Failed to connect to Microsoft Graph');
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, microsoft: 'failed' }));
      setError('Network error while testing Microsoft Graph connection');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    try {
      // Create the tenant with security configuration
      const response = await api.post('/api/super-admin/tenants', {
        tenantInfo,
        sonicwallDevices,
        microsoftCreds
      });

      const result = await response.json();
      if (result.success) {
        router.push('/super-admin/tenants?created=true');
      } else {
        setError('Failed to create tenant');
      }
    } catch (err) {
      setError('Failed to create tenant');
    } finally {
      setLoading(false);
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
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            🏢 Create New Tenant
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Set up a new organization with security monitoring
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step.completed 
                  ? 'bg-green-500 border-green-500 text-white' 
                  : step.current 
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-neutral-300 text-neutral-400'
              }`}>
                {step.completed ? '✓' : index + 1}
              </div>
              <div className="ml-3 hidden md:block">
                <div className={`text-sm font-medium ${
                  step.current ? 'text-blue-600' : step.completed ? 'text-green-600' : 'text-neutral-400'
                }`}>
                  {step.title}
                </div>
                <div className="text-xs text-neutral-500">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  step.completed ? 'bg-green-500' : 'bg-neutral-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 dark:bg-red-800 border-2 border-red-300 dark:border-red-600 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-red-800 dark:text-red-100 font-medium">{error}</div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-8">
          
          {/* Step 1: Tenant Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Tenant Information
              </h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-900 mb-2">Client Identification</h3>
                <p className="text-sm text-blue-800">
                  <strong>Domain:</strong> Use if the client has their own website domain (e.g., acme-corp.com)<br/>
                  <strong>Client Identifier:</strong> A unique code for this client (e.g., company abbreviation, client number)
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={tenantInfo.name}
                    onChange={(e) => setTenantInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ACME Corporation"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={tenantInfo.domain}
                    onChange={(e) => setTenantInfo(prev => ({ ...prev, domain: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="acme-corp.com (optional)"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Leave blank if client doesn't have their own domain</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Client Identifier *
                  </label>
                  <input
                    type="text"
                    value={tenantInfo.identifier}
                    onChange={(e) => setTenantInfo(prev => ({ ...prev, identifier: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="acme-corp or acme-123"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Unique identifier for this client (e.g., company abbreviation, client code)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Industry
                  </label>
                  <select
                    value={tenantInfo.industry}
                    onChange={(e) => setTenantInfo(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Industry</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="finance">Finance</option>
                    <option value="law">Law</option>
                    <option value="retail">Retail</option>
                    <option value="technology">Technology</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Primary Contact Email *
                  </label>
                  <input
                    type="email"
                    value={tenantInfo.contact}
                    onChange={(e) => setTenantInfo(prev => ({ ...prev, contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="admin@acme-corp.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={tenantInfo.timezone}
                    onChange={(e) => setTenantInfo(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="EST">Eastern (EST)</option>
                    <option value="CST">Central (CST)</option>
                    <option value="MST">Mountain (MST)</option>
                    <option value="PST">Pacific (PST)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!tenantInfo.name || !tenantInfo.identifier || !tenantInfo.contact}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  Continue to SonicWall Setup
                </button>
              </div>
            </div>
          )}

          {/* Step 2: SonicWall Devices */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  SonicWall Devices
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                  Add all SonicWall firewalls across your locations. You can add multiple devices for different offices, branches, or network segments.
                </p>
              </div>
              
              {/* Multi-Location Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">📍 Multiple Locations Support</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Main Office</strong>: Add your headquarters firewall first</li>
                  <li>• <strong>Branch Offices</strong>: Add firewalls from remote locations</li>
                  <li>• <strong>Data Centers</strong>: Include any dedicated facility firewalls</li>
                  <li>• <strong>Cloud Gateways</strong>: Add cloud-based SonicWall instances</li>
                </ul>
                <div className="mt-3 p-2 bg-blue-100 rounded border border-blue-300">
                  <p className="text-xs text-blue-900 font-medium">💡 <strong>What IP to use?</strong></p>
                  <p className="text-xs text-blue-800">
                    Use the same IP address you type in your browser to access the SonicWall management interface. 
                    This is typically the LAN interface IP (like 192.168.1.1) or a dedicated management IP.
                  </p>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  💡 <strong>Tip:</strong> Use descriptive names like "NYC-HQ-Firewall" or "Dallas-Branch-FW" to easily identify devices
                </p>
              </div>
              
              {/* Existing Devices */}
              {sonicwallDevices.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                      Added Devices ({sonicwallDevices.length})
                    </h3>
                    <div className="text-sm text-green-600">
                      ✅ All devices connected successfully
                    </div>
                  </div>
                  {sonicwallDevices.map((device, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="font-medium text-green-900">
                            {device.deviceName || `SonicWall Device ${index + 1}`}
                          </div>
                          <span className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded-full">
                            Connected
                          </span>
                        </div>
                        <div className="text-sm text-green-700 mt-1">
                          <span className="font-medium">IP:</span> {device.managementIp}
                          {device.location && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="font-medium">Location:</span> {device.location}
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // Remove device from list
                          setSonicwallDevices(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="px-3 py-1 text-red-600 hover:bg-red-100 rounded text-sm"
                        title="Remove device"
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add New Device Form */}
              <div className="border border-neutral-200 rounded-lg p-6">
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-4">
                  {sonicwallDevices.length === 0 ? 'Add Your First SonicWall Device' : 'Add Another SonicWall Device'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      SonicWall Firewall IP Address *
                    </label>
                    <input
                      type="text"
                      value={newDevice.managementIp}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, managementIp: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="192.168.1.1 or 10.0.1.1"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      The IP address of your SonicWall firewall device (where you access the web management interface)
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Device Name *
                    </label>
                    <input
                      type="text"
                      value={newDevice.deviceName}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, deviceName: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="NYC-HQ-Firewall, Dallas-Branch-FW"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Location/Site *
                    </label>
                    <input
                      type="text"
                      value={newDevice.location}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="New York HQ, Dallas Branch Office"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Network Segment
                    </label>
                    <select
                      value={newDevice.networkSegment || ''}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, networkSegment: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select segment type</option>
                      <option value="headquarters">Headquarters</option>
                      <option value="branch">Branch Office</option>
                      <option value="datacenter">Data Center</option>
                      <option value="cloud">Cloud Gateway</option>
                      <option value="dmz">DMZ/Perimeter</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      API Username *
                    </label>
                    <input
                      type="text"
                      value={newDevice.username}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="admin"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      API Password *
                    </label>
                    <input
                      type="password"
                      value={newDevice.password}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center space-x-3">
                  <button
                    onClick={handleAddSonicWallDevice}
                    disabled={loading || !newDevice.managementIp || !newDevice.username || !newDevice.password || !newDevice.deviceName || !newDevice.location}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                  >
                    {loading ? '🔄 Testing...' : '🔍 Test & Add Device'}
                  </button>
                  
                  {sonicwallDevices.length > 0 && (
                    <div className="text-sm text-neutral-600">
                      💡 You can add more devices after completing onboarding
                    </div>
                  )}
                </div>
                
                {/* Test Results */}
                {testResults.sonicwall[newDevice.managementIp] && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    testResults.sonicwall[newDevice.managementIp] === 'success' 
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : testResults.sonicwall[newDevice.managementIp] === 'failed'
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : 'bg-blue-50 border border-blue-200 text-blue-800'
                  }`}>
                    {testResults.sonicwall[newDevice.managementIp] === 'testing' && '🔄 Testing connection...'}
                    {testResults.sonicwall[newDevice.managementIp] === 'success' && '✅ Connection successful!'}
                    {testResults.sonicwall[newDevice.managementIp] === 'failed' && '❌ Connection failed'}
                  </div>
                )}
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2 bg-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-400"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Continue to Microsoft Setup
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Microsoft Defender */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Microsoft Defender Integration
              </h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Setup Instructions</h3>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Go to Azure Portal → App Registrations</li>
                  <li>2. Create new registration: "AVIAN Security Platform"</li>
                  <li>3. Grant API permissions: SecurityEvents.Read.All, Device.Read.All, etc.</li>
                  <li>4. Create client secret</li>
                  <li>5. Enter the credentials below</li>
                </ol>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Tenant ID *
                  </label>
                  <input
                    type="text"
                    value={microsoftCreds.tenantId}
                    onChange={(e) => setMicrosoftCreds(prev => ({ ...prev, tenantId: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="12345678-1234-1234-1234-123456789012"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Client ID *
                  </label>
                  <input
                    type="text"
                    value={microsoftCreds.clientId}
                    onChange={(e) => setMicrosoftCreds(prev => ({ ...prev, clientId: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="87654321-4321-4321-4321-210987654321"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Client Secret *
                  </label>
                  <input
                    type="password"
                    value={microsoftCreds.clientSecret}
                    onChange={(e) => setMicrosoftCreds(prev => ({ ...prev, clientSecret: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••••••••••••••••••••••••••"
                  />
                </div>
              </div>
              
              <div>
                <button
                  onClick={handleTestMicrosoftConnection}
                  disabled={loading || !microsoftCreds.tenantId || !microsoftCreds.clientId || !microsoftCreds.clientSecret}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Testing...' : '🔍 Test Connection'}
                </button>
              </div>
              
              {/* Test Results */}
              {testResults.microsoft && (
                <div className={`p-3 rounded-lg ${
                  testResults.microsoft === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : testResults.microsoft === 'failed'
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}>
                  {testResults.microsoft === 'testing' && '🔄 Testing Microsoft Graph connection...'}
                  {testResults.microsoft === 'success' && '✅ Microsoft Graph connected successfully!'}
                  {testResults.microsoft === 'failed' && '❌ Microsoft Graph connection failed'}
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2 bg-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-400"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  disabled={testResults.microsoft !== 'success'}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  Continue to Verification
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Create Tenant */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Create Tenant
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <div className="font-medium text-green-900">✅ Tenant Information</div>
                    <div className="text-sm text-green-700">
                      {tenantInfo.name} ({tenantInfo.domain || tenantInfo.identifier}) setup complete
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-green-900">✅ SonicWall Devices</div>
                    <div className="text-sm text-green-700">{sonicwallDevices.length} device(s) configured</div>
                  </div>
                  {sonicwallDevices.length > 0 && (
                    <div className="space-y-2">
                      {sonicwallDevices.map((device, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div>
                            <div className="font-medium text-sm">{device.deviceName}</div>
                            <div className="text-xs text-neutral-600">
                              {device.managementIp} • {device.location}
                              {device.networkSegment && ` • ${device.networkSegment}`}
                            </div>
                          </div>
                          <div className="text-green-600 text-sm">🟢 Ready</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <div className="font-medium text-green-900">✅ Microsoft Defender</div>
                    <div className="text-sm text-green-700">Graph API connection verified</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• A new tenant organization will be created: <strong>{tenantInfo.name}</strong></li>
                  <li>• Security monitoring will be configured for all {sonicwallDevices.length} SonicWall device{sonicwallDevices.length !== 1 ? 's' : ''}</li>
                  <li>• Microsoft Defender integration will be activated</li>
                  <li>• An initial tenant admin user will be created</li>
                  <li>• The tenant will be ready for user onboarding</li>
                </ul>
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2 bg-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-400"
                >
                  Back
                </button>
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={loading || sonicwallDevices.length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Creating Tenant...' : '🎉 Create Tenant'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Setup Verification */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Setup Verification
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <div className="font-medium text-green-900">✅ Client Information</div>
                    <div className="text-sm text-green-700">{clientInfo.name} setup complete</div>
                  </div>
                </div>
                
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-green-900">✅ SonicWall Devices</div>
                    <div className="text-sm text-green-700">{sonicwallDevices.length} device(s) connected</div>
                  </div>
                  {sonicwallDevices.length > 0 && (
                    <div className="space-y-2">
                      {sonicwallDevices.map((device, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div>
                            <div className="font-medium text-sm">{device.deviceName}</div>
                            <div className="text-xs text-neutral-600">
                              {device.managementIp} • {device.location}
                              {device.networkSegment && ` • ${device.networkSegment}`}
                            </div>
                          </div>
                          <div className="text-green-600 text-sm">🟢 Ready</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <div className="font-medium text-green-900">✅ Microsoft Defender</div>
                    <div className="text-sm text-green-700">Graph API connection verified</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Monitoring will start automatically for all {sonicwallDevices.length} SonicWall device{sonicwallDevices.length !== 1 ? 's' : ''}</li>
                  <li>• Security alerts will begin flowing from all locations to your dashboard</li>
                  <li>• Each firewall will be monitored independently with location-specific alerts</li>
                  <li>• Your security analysts can manage devices across all client locations</li>
                  <li>• You'll receive a confirmation email with complete setup details</li>
                </ul>
              </div>
              
              {sonicwallDevices.length > 1 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-900 mb-2">📍 Multi-Location Setup Complete</h3>
                  <p className="text-sm text-yellow-800">
                    You've successfully configured <strong>{sonicwallDevices.length} SonicWall devices</strong> across multiple locations. 
                    Each device will be monitored independently, and you can view consolidated security data 
                    across all locations in your dashboard.
                  </p>
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2 bg-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-400"
                >
                  Back
                </button>
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={loading || sonicwallDevices.length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Completing Setup...' : '🎉 Complete Onboarding'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}