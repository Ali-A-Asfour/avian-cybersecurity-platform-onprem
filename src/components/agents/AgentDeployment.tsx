'use client';

import React, { useState } from 'react';
import { DeploymentConfig, ToolInstallationConfig } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface AgentDeploymentProps {
  tenantId: string;
}

export function AgentDeployment({ tenantId }: AgentDeploymentProps) {
  const [deploymentName, setDeploymentName] = useState('');
  const [selectedOS, setSelectedOS] = useState<'windows' | 'linux' | 'macos' | null>(null);
  const [deploymentConfig] = useState<DeploymentConfig>({
    os_targets: [],
    tools_to_install: [
      {
        tool_name: 'Avast Business Antivirus',
        vendor: 'Avast',
        installation_params: {
          silent_install: true,
          auto_configure: true,
        },
        auto_configure: true,
        priority: 1,
      },
    ],
    auto_register: true,
    deployment_method: 'script',
    installation_params: {},
  });
  const [loading, setLoading] = useState(false);
  const [scriptModal, setScriptModal] = useState<{
    isOpen: boolean;
    script: string;
    osType: string;
    instructions: string;
  }>({
    isOpen: false,
    script: '',
    osType: '',
    instructions: '',
  });

  const handleGenerateScript = async (osType: 'windows' | 'linux' | 'macos') => {
    try {
      setLoading(true);

      const response = await fetch('/api/agents/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          os_type: osType,
          deployment_name: deploymentName || `${osType}-deployment-${Date.now()}`,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setScriptModal({
          isOpen: true,
          script: data.data.script_content,
          osType: osType,
          instructions: data.data.download_instructions,
        });
      } else {
        alert(`Failed to generate script: ${data.error?.message}`);
      }
    } catch {
      alert('Failed to generate deployment script');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadScript = () => {
    const extension = scriptModal.osType === 'windows' ? 'bat' : 'sh';
    const filename = `avian-agent-install.${extension}`;

    const blob = new Blob([scriptModal.script], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const osOptions = [
    {
      id: 'windows',
      name: 'Windows',
      description: 'Windows 10/11, Windows Server 2016+',
      icon: '🪟',
    },
    {
      id: 'linux',
      name: 'Linux',
      description: 'Ubuntu, CentOS, RHEL, Debian',
      icon: '🐧',
    },
    {
      id: 'macos',
      name: 'macOS',
      description: 'macOS 10.15+ (Catalina and later)',
      icon: '🍎',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Deploy AVIAN Agent
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Generate installation scripts for deploying endpoint agents to client systems
        </p>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Deployment Configuration
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Deployment Name (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g., Client-ABC-Deployment"
                value={deploymentName}
                onChange={(e) => setDeploymentName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Select Operating System
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {osOptions.map((os) => (
                  <div
                    key={os.id}
                    className="relative rounded-lg border border-gray-300 dark:border-gray-600 p-4 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors"
                    onClick={() => setSelectedOS(os.id as any)}
                  >
                    <div className="flex items-center">
                      <div className="text-2xl mr-3">{os.icon}</div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {os.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {os.description}
                        </p>
                      </div>
                    </div>
                    {selectedOS === os.id && (
                      <div className="absolute top-2 right-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={() => selectedOS && handleGenerateScript(selectedOS)}
                disabled={!selectedOS || loading}
                className="w-full md:w-auto"
              >
                {loading ? 'Generating...' : 'Generate Installation Script'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Default Security Tools
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            The following security tools will be automatically installed with the agent:
          </p>

          <div className="space-y-3">
            {deploymentConfig.tools_to_install.map((tool, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {tool.tool_name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    by {tool.vendor}
                  </div>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Auto-install enabled
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Modal
        isOpen={scriptModal.isOpen}
        onClose={() => setScriptModal({ ...scriptModal, isOpen: false })}
        title={`${scriptModal.osType.charAt(0).toUpperCase() + scriptModal.osType.slice(1)} Installation Script`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Installation Instructions
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {scriptModal.instructions}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Installation Script
            </label>
            <textarea
              className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm font-mono"
              value={scriptModal.script}
              readOnly
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setScriptModal({ ...scriptModal, isOpen: false })}
            >
              Close
            </Button>
            <Button onClick={handleDownloadScript}>
              Download Script
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}