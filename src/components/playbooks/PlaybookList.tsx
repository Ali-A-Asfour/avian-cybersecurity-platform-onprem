'use client';

import React, { useEffect, useState } from 'react';
import { SecurityPlaybook, ThreatType, PlaybookSeverity } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PlaybookForm } from './PlaybookForm';
import { PlaybookExecution } from './PlaybookExecution';

interface PlaybookListProps {
  onSelectPlaybook?: (playbook: SecurityPlaybook) => void;
  showCreateButton?: boolean;
  alertId?: string; // For showing recommendations
}

export function PlaybookList({ onSelectPlaybook, showCreateButton = true, alertId }: PlaybookListProps) {
  const [playbooks, setPlaybooks] = useState<SecurityPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<SecurityPlaybook | null>(null);
  const [showExecution, setShowExecution] = useState(false);
  const [filter, setFilter] = useState<{
    threatType?: ThreatType;
    severity?: PlaybookSeverity;
    search?: string;
  }>({});

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);

      // Use mock data for development
      const { mockPlaybooks } = await import('@/lib/dev-mode');
      const { delay } = await import('@/lib/mock-data');
      await delay(500); // Simulate loading

      // Convert mock data to expected format
      const mockPlaybookData = mockPlaybooks.map(playbook => ({
        id: playbook.id,
        name: playbook.name,
        description: playbook.description,
        threat_type: 'malware' as any, // Default threat type
        severity_level: 'medium' as any, // Default severity
        steps: Array.from({ length: playbook.stepCount }, (_, i) => ({
          id: `step-${i + 1}`,
          title: `Step ${i + 1}`,
          description: `Perform action ${i + 1}`,
          order: i + 1,
          is_automated: false,
          estimated_duration: 5
        })),
        estimated_duration: playbook.stepCount * 5,
        is_template: false,
        usage_count: Math.floor(Math.random() * 20),
        effectiveness_rating: 4 + Math.random(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tenant_id: 'demo-tenant'
      }));

      setPlaybooks(mockPlaybookData);
    } catch (error) {
      setError('Failed to fetch playbooks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaybook = async (playbookData: Partial<SecurityPlaybook>) => {
    try {
      // Use mock data for development
      const { delay } = await import('@/lib/dev-mode');
      await delay(500); // Simulate API call

      // Create mock playbook
      const newPlaybook = {
        id: `playbook-${Date.now()}`,
        name: playbookData.name || 'New Playbook',
        description: playbookData.description || 'New playbook description',
        threat_type: playbookData.threat_type || 'malware' as any,
        severity_level: playbookData.severity_level || 'medium' as any,
        steps: playbookData.steps || [],
        estimated_duration: playbookData.estimated_duration || 30,
        is_template: false,
        usage_count: 0,
        effectiveness_rating: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setPlaybooks([...playbooks, newPlaybook]);
      setShowCreateForm(false);
    } catch (error) {
      setError('Failed to create playbook');
    }
  };

  const handleExecutePlaybook = (playbook: SecurityPlaybook) => {
    setSelectedPlaybook(playbook);
    setShowExecution(true);
  };

  const getSeverityColor = (severity: PlaybookSeverity) => {
    switch (severity) {
      case PlaybookSeverity.LOW:
        return 'bg-green-100 text-green-800';
      case PlaybookSeverity.MEDIUM:
        return 'bg-yellow-100 text-yellow-800';
      case PlaybookSeverity.HIGH:
        return 'bg-orange-100 text-orange-800';
      case PlaybookSeverity.CRITICAL:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getThreatTypeColor = (threatType: ThreatType) => {
    switch (threatType) {
      case ThreatType.MALWARE:
        return 'bg-red-100 text-red-800';
      case ThreatType.PHISHING:
        return 'bg-orange-100 text-orange-800';
      case ThreatType.DATA_BREACH:
        return 'bg-purple-100 text-purple-800';
      case ThreatType.NETWORK_INTRUSION:
        return 'bg-blue-100 text-blue-800';
      case ThreatType.RANSOMWARE:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredPlaybooks = playbooks.filter(playbook => {
    if (filter.threatType && playbook.threat_type !== filter.threatType) return false;
    if (filter.severity && playbook.severity_level !== filter.severity) return false;
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      return (
        playbook.name.toLowerCase().includes(searchLower) ||
        playbook.description.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
        <Button onClick={fetchPlaybooks} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <PlaybookForm
        onSubmit={handleCreatePlaybook}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  if (showExecution && selectedPlaybook) {
    return (
      <PlaybookExecution
        playbook={selectedPlaybook}
        alertId={alertId}
        onClose={() => {
          setShowExecution(false);
          setSelectedPlaybook(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Security Playbooks</h2>
          <p className="text-gray-600">Standardized response procedures for security incidents</p>
        </div>
        {showCreateButton && (
          <Button onClick={() => setShowCreateForm(true)}>
            Create Playbook
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search playbooks..."
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filter.search || ''}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Threat Type
          </label>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filter.threatType || ''}
            onChange={(e) => setFilter({ ...filter, threatType: e.target.value as ThreatType || undefined })}
          >
            <option value="">All Types</option>
            {Object.values(ThreatType).map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Severity
          </label>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filter.severity || ''}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value as PlaybookSeverity || undefined })}
          >
            <option value="">All Severities</option>
            {Object.values(PlaybookSeverity).map(severity => (
              <option key={severity} value={severity}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Playbook Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlaybooks.map((playbook) => (
          <Card key={playbook.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {playbook.name}
                </h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {playbook.description}
                </p>
              </div>
              {playbook.is_template && (
                <Badge variant="secondary" className="ml-2">
                  Template
                </Badge>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <Badge className={getThreatTypeColor(playbook.threat_type)}>
                  {playbook.threat_type.replace(/_/g, ' ')}
                </Badge>
                <Badge className={getSeverityColor(playbook.severity_level)}>
                  {playbook.severity_level}
                </Badge>
              </div>

              <div className="text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>{playbook.steps.length} steps</span>
                  <span>~{playbook.estimated_duration} min</span>
                </div>
                {playbook.usage_count > 0 && (
                  <div className="flex justify-between mt-1">
                    <span>Used {playbook.usage_count} times</span>
                    <span>★ {playbook.effectiveness_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectPlaybook?.(playbook)}
                className="flex-1"
              >
                View Details
              </Button>
              <Button
                size="sm"
                onClick={() => handleExecutePlaybook(playbook)}
                className="flex-1"
              >
                Execute
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredPlaybooks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No playbooks found</h3>
          <p className="text-gray-600 mb-4">
            {filter.search || filter.threatType || filter.severity
              ? 'Try adjusting your filters to see more results.'
              : 'Create your first security playbook to get started.'}
          </p>
          {showCreateButton && !filter.search && !filter.threatType && !filter.severity && (
            <Button onClick={() => setShowCreateForm(true)}>
              Create First Playbook
            </Button>
          )}
        </div>
      )}
    </div>
  );
}