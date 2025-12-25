'use client';

import React, { useEffect, useState } from 'react';
import { SecurityPlaybook, PlaybookExecution as PlaybookExecutionType, PlaybookStep, ExecutionStatus, CompletedStep } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface PlaybookExecutionProps {
  playbook: SecurityPlaybook;
  alertId?: string;
  incidentId?: string;
  onClose: () => void;
}

export function PlaybookExecution({ playbook, alertId, incidentId, onClose }: PlaybookExecutionProps) {
  const [execution, setExecution] = useState<PlaybookExecutionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStepNotes, setCurrentStepNotes] = useState('');
  const [executionNotes, setExecutionNotes] = useState('');

  useEffect(() => {
    startExecution();
  }, []);

  const startExecution = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/playbooks/${playbook.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId,
          incidentId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setExecution(data.data);
        setExecutionNotes(data.data.notes || '');
      } else {
        setError(data.error?.message || 'Failed to start execution');
      }
    } catch {
      setError('Failed to start execution');
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepId: string, verificationStatus: 'verified' | 'skipped' | 'failed' = 'verified') => {
    if (!execution) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/playbooks/executions/${execution.id}/steps/${stepId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: currentStepNotes,
          verificationStatus
        }),
      });

      const data = await response.json();

      if (data.success) {
        setExecution(data.data);
        setCurrentStepNotes('');
      } else {
        setError(data.error?.message || 'Failed to complete step');
      }
    } catch {
      setError('Failed to complete step');
    } finally {
      setLoading(false);
    }
  };

  const updateExecutionNotes = async () => {
    if (!execution) return;

    try {
      const response = await fetch(`/api/playbooks/executions/${execution.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: executionNotes
        }),
      });

      const data = await response.json();

      if (data.success) {
        setExecution(data.data);
      }
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  };

  const pauseExecution = async () => {
    if (!execution) return;

    try {
      const response = await fetch(`/api/playbooks/executions/${execution.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: ExecutionStatus.PAUSED
        }),
      });

      const data = await response.json();

      if (data.success) {
        setExecution(data.data);
      }
    } catch {
      setError('Failed to pause execution');
    }
  };

  const resumeExecution = async () => {
    if (!execution) return;

    try {
      const response = await fetch(`/api/playbooks/executions/${execution.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: ExecutionStatus.IN_PROGRESS
        }),
      });

      const data = await response.json();

      if (data.success) {
        setExecution(data.data);
      }
    } catch {
      setError('Failed to resume execution');
    }
  };

  const getStepStatus = (step: PlaybookStep): 'completed' | 'current' | 'pending' | 'blocked' => {
    if (!execution) return 'pending';

    const completedStep = execution.completed_steps.find(cs => cs.step_id === step.id);
    if (completedStep) return 'completed';

    if (execution.current_step === step.step_number) return 'current';

    // Check if dependencies are met
    const dependenciesMet = step.dependencies.every(depId =>
      execution.completed_steps.some(cs => cs.step_id === depId)
    );

    return dependenciesMet ? 'pending' : 'blocked';
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'current':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'investigation':
        return 'bg-blue-100 text-blue-800';
      case 'containment':
        return 'bg-orange-100 text-orange-800';
      case 'eradication':
        return 'bg-red-100 text-red-800';
      case 'recovery':
        return 'bg-green-100 text-green-800';
      case 'communication':
        return 'bg-purple-100 text-purple-800';
      case 'documentation':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCompletedStepInfo = (stepId: string): CompletedStep | undefined => {
    return execution?.completed_steps.find(cs => cs.step_id === stepId);
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  if (loading && !execution) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !execution) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={startExecution}>Retry</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  if (!execution) return null;

  const currentStep = playbook.steps.find(step => step.step_number === execution.current_step);
  const completedStepsCount = execution.completed_steps.length;
  const totalSteps = playbook.steps.length;
  const progress = (completedStepsCount / totalSteps) * 100;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{playbook.name}</h2>
          <p className="text-gray-600">{playbook.description}</p>
          <div className="flex items-center gap-4 mt-2">
            <Badge className={getStepStatusColor(execution.status)}>
              {execution.status.replace('_', ' ')}
            </Badge>
            <span className="text-sm text-gray-600">
              Started {formatDuration(execution.started_at)} ago
            </span>
            {execution.completed_at && (
              <span className="text-sm text-gray-600">
                Completed in {formatDuration(execution.started_at, execution.completed_at)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {execution.status === ExecutionStatus.IN_PROGRESS && (
            <Button variant="outline" onClick={pauseExecution}>
              Pause
            </Button>
          )}
          {execution.status === ExecutionStatus.PAUSED && (
            <Button variant="outline" onClick={resumeExecution}>
              Resume
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Progress</h3>
          <span className="text-sm text-gray-600">
            {completedStepsCount} of {totalSteps} steps completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </Card>

      {/* Current Step */}
      {currentStep && execution.status === ExecutionStatus.IN_PROGRESS && (
        <Card className="p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Step {currentStep.step_number}: {currentStep.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getActionTypeColor(currentStep.action_type)}>
                  {currentStep.action_type}
                </Badge>
                <span className="text-sm text-gray-600">
                  ~{currentStep.estimated_time} minutes
                </span>
                {currentStep.required && (
                  <Badge className="bg-red-100 text-red-800">Required</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Description</h4>
              <p className="text-gray-700">{currentStep.description}</p>
            </div>

            {currentStep.instructions && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Instructions</h4>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{currentStep.instructions}</p>
                </div>
              </div>
            )}

            {currentStep.verification_criteria && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Verification Criteria</h4>
                <p className="text-gray-700 italic">{currentStep.verification_criteria}</p>
              </div>
            )}

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Step Notes</h4>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={currentStepNotes}
                onChange={(e) => setCurrentStepNotes(e.target.value)}
                placeholder="Add notes about this step..."
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => completeStep(currentStep.id, 'verified')}
                disabled={loading}
              >
                {loading ? 'Completing...' : 'Complete Step'}
              </Button>
              <Button
                variant="outline"
                onClick={() => completeStep(currentStep.id, 'skipped')}
                disabled={loading || currentStep.required}
              >
                Skip Step
              </Button>
              {!currentStep.required && (
                <Button
                  variant="outline"
                  onClick={() => completeStep(currentStep.id, 'failed')}
                  disabled={loading}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Mark as Failed
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* All Steps Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">All Steps</h3>
        <div className="space-y-3">
          {playbook.steps.map((step) => {
            const status = getStepStatus(step);
            const completedInfo = getCompletedStepInfo(step.id);

            return (
              <div
                key={step.id}
                className={`p-4 rounded-lg border ${status === 'current' ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium">
                    {status === 'completed' ? (
                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                        ✓
                      </div>
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'current' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                        {step.step_number}
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{step.title}</h4>
                      <Badge className={getStepStatusColor(status)}>
                        {status}
                      </Badge>
                      <Badge className={getActionTypeColor(step.action_type)}>
                        {step.action_type}
                      </Badge>
                      {step.required && (
                        <Badge className="bg-red-100 text-red-800" size="sm">Required</Badge>
                      )}
                    </div>

                    <p className="text-gray-600 text-sm mb-2">{step.description}</p>

                    {completedInfo && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        <div className="flex justify-between items-center mb-1">
                          <span>Completed by: {completedInfo.completed_by}</span>
                          <span>Status: {completedInfo.verification_status}</span>
                        </div>
                        <div>Completed at: {new Date(completedInfo.completed_at).toLocaleString()}</div>
                        {completedInfo.notes && (
                          <div className="mt-1">
                            <strong>Notes:</strong> {completedInfo.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-gray-500">
                    ~{step.estimated_time}m
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Execution Notes */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Execution Notes</h3>
        <textarea
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={executionNotes}
          onChange={(e) => setExecutionNotes(e.target.value)}
          onBlur={updateExecutionNotes}
          placeholder="Add overall notes about this playbook execution..."
        />
      </Card>

      {execution.status === ExecutionStatus.COMPLETED && (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900">Playbook Completed</h3>
              <p className="text-green-700">
                All steps have been completed successfully. Total time: {formatDuration(execution.started_at, execution.completed_at)}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}