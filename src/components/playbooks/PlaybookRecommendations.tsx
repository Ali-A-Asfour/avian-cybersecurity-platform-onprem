'use client';

import React, { useEffect, useState } from 'react';
import { PlaybookRecommendation, SecurityPlaybook } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PlaybookExecution } from './PlaybookExecution';

interface PlaybookRecommendationsProps {
  alertId: string;
  onClose?: () => void;
}

export function PlaybookRecommendations({ alertId, onClose }: PlaybookRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<PlaybookRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<SecurityPlaybook | null>(null);
  const [showExecution, setShowExecution] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, [alertId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/playbooks/recommend/${alertId}`);
      const data = await response.json();

      if (data.success) {
        setRecommendations(data.data);
      } else {
        setError(data.error?.message || 'Failed to fetch recommendations');
      }
    } catch {
      setError('Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePlaybook = (playbook: SecurityPlaybook) => {
    setSelectedPlaybook(playbook);
    setShowExecution(true);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    if (score >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
        <div className="mt-4 flex gap-2">
          <Button onClick={fetchRecommendations}>Retry</Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>
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
          <h2 className="text-2xl font-bold text-gray-900">Recommended Playbooks</h2>
          <p className="text-gray-600">
            {recommendations.length > 0 
              ? `Found ${recommendations.length} recommended playbook${recommendations.length > 1 ? 's' : ''} for this alert`
              : 'No specific playbooks recommended for this alert'
            }
          </p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {recommendations.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Specific Recommendations</h3>
          <p className="text-gray-600 mb-4">
            No playbooks match the characteristics of this alert. You can still browse all available playbooks or create a custom response procedure.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.open('/playbooks', '_blank')}>
              Browse All Playbooks
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {recommendations.map((recommendation, index) => (
            <Card key={recommendation.playbook.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {recommendation.playbook.name}
                    </h3>
                    <Badge className={getConfidenceColor(recommendation.confidence_score)}>
                      {recommendation.confidence_score}% match
                    </Badge>
                    {index === 0 && (
                      <Badge variant="default">Best Match</Badge>
                    )}
                  </div>
                  <p className="text-gray-600 mb-3">
                    {recommendation.playbook.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Playbook Details</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Threat Type:</span>
                      <Badge variant="outline">
                        {recommendation.playbook.threat_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Severity:</span>
                      <Badge className={getSeverityColor(recommendation.playbook.severity_level)}>
                        {recommendation.playbook.severity_level}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Steps:</span>
                      <span>{recommendation.playbook.steps.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Est. Duration:</span>
                      <span>~{recommendation.playbook.estimated_duration} min</span>
                    </div>
                    {recommendation.playbook.usage_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Usage:</span>
                        <span>{recommendation.playbook.usage_count} times (★ {recommendation.playbook.effectiveness_rating.toFixed(1)})</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Why Recommended</h4>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700">{recommendation.reason}</p>
                    {recommendation.matching_criteria.length > 0 && (
                      <div>
                        <span className="text-gray-600">Matching criteria:</span>
                        <ul className="list-disc list-inside text-gray-700 mt-1">
                          {recommendation.matching_criteria.map((criteria, idx) => (
                            <li key={idx}>{criteria}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Response Steps Preview</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {recommendation.playbook.steps.slice(0, 6).map((step, stepIndex) => (
                    <div key={step.id} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="font-medium text-gray-900">
                        {step.step_number}. {step.title}
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        {step.action_type} • ~{step.estimated_time}m
                      </div>
                    </div>
                  ))}
                  {recommendation.playbook.steps.length > 6 && (
                    <div className="text-sm p-2 bg-gray-50 rounded flex items-center justify-center text-gray-500">
                      +{recommendation.playbook.steps.length - 6} more steps
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/playbooks/${recommendation.playbook.id}`, '_blank')}
                >
                  View Details
                </Button>
                <Button
                  onClick={() => handleExecutePlaybook(recommendation.playbook)}
                  className={index === 0 ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  Execute Playbook
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Additional Actions */}
      <Card className="p-4 bg-gray-50">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-medium text-gray-900">Need a different approach?</h4>
            <p className="text-sm text-gray-600">
              Browse all available playbooks or create a custom response procedure.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open('/playbooks', '_blank')}>
              Browse All Playbooks
            </Button>
            <Button variant="outline" onClick={() => window.open('/playbooks/new', '_blank')}>
              Create Custom Playbook
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}