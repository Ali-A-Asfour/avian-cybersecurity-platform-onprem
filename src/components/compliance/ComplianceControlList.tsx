'use client';

import { useEffect, useState } from 'react';
import { ComplianceFramework, ComplianceControl, ComplianceEvidence, ComplianceStatus } from '../../types';
import { api } from '@/lib/api-client';
// import { EvidenceUpload } from './EvidenceUpload';

interface ComplianceControlListProps {
  framework: ComplianceFramework;
  onBack: () => void;
}

export function ComplianceControlList({ framework, onBack }: ComplianceControlListProps) {
  const [controls, setControls] = useState<ComplianceControl[]>([]);
  const [selectedControl, setSelectedControl] = useState<ComplianceControl | null>(null);
  const [evidence, setEvidence] = useState<Record<string, ComplianceEvidence[]>>({});
  const [loading, setLoading] = useState(true);
  const [updatingControl, setUpdatingControl] = useState<string | null>(null);

  useEffect(() => {
    fetchControls();
  }, [framework.id]);

  const fetchControls = async () => {
    try {
      const response = await api.get(`/api/compliance/frameworks/${framework.id}/controls`);
      const result = await response.json();
      
      if (result.success) {
        setControls(result.data);
        // Fetch evidence for each control
        for (const control of result.data) {
          fetchEvidence(control.id);
        }
      }
    } catch {
      console.error('Error fetching controls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidence = async (controlId: string) => {
    try {
      const response = await api.get(`/api/compliance/controls/${controlId}/evidence`);
      const result = await response.json();
      
      if (result.success) {
        setEvidence(prev => ({
          ...prev,
          [controlId]: result.data,
        }));
      }
    } catch {
      console.error('Error fetching evidence:', error);
    }
  };

  const updateControlStatus = async (controlId: string, status: ComplianceStatus) => {
    setUpdatingControl(controlId);
    try {
      const response = await api.put(`/api/compliance/controls/${controlId}`, { status });
      
      const result = await response.json();
      
      if (result.success) {
        setControls(prev => 
          prev.map(control => 
            control.id === controlId ? result.data : control
          )
        );
      }
    } catch {
      console.error('Error updating control status:', error);
    } finally {
      setUpdatingControl(null);
    }
  };

  const _handleEvidenceUploaded = (controlId: string, newEvidence: ComplianceEvidence) => {
    setEvidence(prev => ({
      ...prev,
      [controlId]: [...(prev[controlId] || []), newEvidence],
    }));
  };

  const getStatusColor = (status: ComplianceStatus) => {
    switch (status) {
      case ComplianceStatus.COMPLETED:
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case ComplianceStatus.IN_PROGRESS:
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      case ComplianceStatus.NON_COMPLIANT:
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: ComplianceStatus) => {
    switch (status) {
      case ComplianceStatus.COMPLETED:
        return (
          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case ComplianceStatus.IN_PROGRESS:
        return (
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case ComplianceStatus.NON_COMPLIANT:
        return (
          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {framework.name} Controls
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Version {framework.version} • {controls.length} controls
            </p>
          </div>
        </div>
      </div>

      {/* Controls List */}
      <div className="space-y-4">
        {controls.map((control) => (
          <div
            key={control.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700"
          >
            <div className="p-6">
              {/* Control Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {control.control_id}
                    </span>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(control.status)}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(control.status)}`}>
                        {control.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {control.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {control.description}
                  </p>
                </div>
              </div>

              {/* Control Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Last Reviewed:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(control.last_reviewed)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Next Review:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(control.next_review_date)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Assigned To:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {control.assigned_to || 'Unassigned'}
                  </p>
                </div>
              </div>

              {/* Evidence Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Evidence ({evidence[control.id]?.length || 0})
                  </h4>
                  <button
                    onClick={() => setSelectedControl(selectedControl?.id === control.id ? null : control)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    {selectedControl?.id === control.id ? 'Hide Upload' : 'Upload Evidence'}
                  </button>
                </div>

                {/* Evidence List */}
                {evidence[control.id] && evidence[control.id].length > 0 && (
                  <div className="space-y-2 mb-3">
                    {evidence[control.id].map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.original_filename}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(item.file_size / 1024).toFixed(1)} KB • {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Evidence Upload */}
                {selectedControl?.id === control.id && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Evidence upload functionality will be available soon.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between">
                <div className="flex space-x-2">
                  {Object.values(ComplianceStatus).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateControlStatus(control.id, status)}
                      disabled={updatingControl === control.id || control.status === status}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        control.status === status
                          ? getStatusColor(status)
                          : 'text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      } ${updatingControl === control.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {updatingControl === control.id && control.status === status ? (
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Updating...</span>
                        </div>
                      ) : (
                        status.replace('_', ' ')
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Updated {formatDate(control.updated_at)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {controls.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Controls Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            This framework doesn't have any controls configured yet.
          </p>
        </div>
      )}
    </div>
  );
}