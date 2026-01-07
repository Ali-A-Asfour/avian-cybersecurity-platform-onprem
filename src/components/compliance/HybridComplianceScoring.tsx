'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import {
  ComplianceScore,
  ComplianceTrend,
  ComplianceRecommendation,
  ComplianceScoreHistory,
  _HybridComplianceControl,
  ControlType,
  AutomatedComplianceStatus,
  ManualComplianceStatus
} from '@/types';
import { api } from '@/lib/api-client';

interface HybridComplianceScoringProps {
  tenantId: string;
  frameworkId?: string;
}

export function HybridComplianceScoring({ tenantId, frameworkId }: HybridComplianceScoringProps) {
  const [currentScore, setCurrentScore] = useState<ComplianceScore | null>(null);
  const [trends, setTrends] = useState<ComplianceTrend | null>(null);
  const [recommendations, setRecommendations] = useState<ComplianceRecommendation[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ComplianceScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  useEffect(() => {
    loadComplianceData();
  }, [tenantId, frameworkId]);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCurrentScore(),
        loadTrends(),
        loadRecommendations(),
        loadScoreHistory()
      ]);
    } catch {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentScore = async () => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (frameworkId) params.append('framework_id', frameworkId);

    const response = await api.get(`/api/compliance/hybrid-score?${params}`);
    const result = await response.json();

    if (result.success) {
      setCurrentScore(result.data);
    }
  };

  const loadTrends = async () => {
    const params = new URLSearchParams({ tenant_id: tenantId, period: 'weekly' });
    if (frameworkId) params.append('framework_id', frameworkId);

    const response = await api.get(`/api/compliance/trends?${params}`);
    const result = await response.json();

    if (result.success) {
      setTrends(result.data);
    }
  };

  const loadRecommendations = async () => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (frameworkId) params.append('framework_id', frameworkId);

    const response = await api.get(`/api/compliance/recommendations?${params}`);
    const result = await response.json();

    if (result.success) {
      setRecommendations(result.data);
    }
  };

  const loadScoreHistory = async () => {
    const params = new URLSearchParams({ tenant_id: tenantId, limit: '5' });
    if (frameworkId) params.append('framework_id', frameworkId);

    const response = await api.get(`/api/compliance/score-history?${params}`);
    const result = await response.json();

    if (result.success) {
      setScoreHistory(result.data);
    }
  };

  const triggerAssessment = async () => {
    setAssessmentLoading(true);
    try {
      const response = await api.post('/api/compliance/hybrid-score', { 
        tenant_id: tenantId, 
        framework_id: frameworkId 
      });

      const result = await response.json();
      if (result.success) {
        await loadComplianceData(); // Reload all data
      }
    } catch {
      console.error('Error triggering assessment:', error);
    } finally {
      setAssessmentLoading(false);
    }
  };

  const generateReport = async (reportType: string, format: string) => {
    try {
      const response = await api.post('/api/compliance/hybrid-reports', {
        tenant_id: tenantId,
        framework_id: frameworkId,
        report_type: reportType,
        format: format
      });

      const result = await response.json();
      if (result.success && result.data.download_url) {
        window.open(result.data.download_url, '_blank');
      }
    } catch {
      console.error('Error generating report:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 text-green-800';
    if (confidence >= 80) return 'bg-blue-100 text-blue-800';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPriorityBadge = (priority: string) => {
    // Map priority to severity levels for visual consistency
    const mapPriority = (prio: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
      switch (prio.toLowerCase()) {
        case 'critical': return 'critical';
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapPriority(priority)} size="sm" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Hybrid Compliance Scoring
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={triggerAssessment}
            disabled={assessmentLoading}
            variant="outline"
          >
            {assessmentLoading ? 'Assessing...' : 'Run Assessment'}
          </Button>
          <Button
            onClick={() => generateReport('comprehensive', 'pdf')}
            variant="primary"
          >
            Generate Report
          </Button>
        </div>
      </div>

      {/* Current Score Overview */}
      {currentScore && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(currentScore.overall_score)}`}>
                {currentScore.overall_score}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Overall Score
              </div>
              <Badge className={`mt-2 ${getConfidenceColor(currentScore.confidence_score)}`}>
                {currentScore.confidence_score}% Confidence
              </Badge>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {currentScore.automated_score}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Automated Score
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {currentScore.automated_controls} controls
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {currentScore.ai_assisted_score}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                AI-Assisted Score
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {currentScore.ai_assisted_controls} controls
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {currentScore.manual_score}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manual Score
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {currentScore.manual_controls} controls
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Score Breakdown */}
      {currentScore && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">
                {currentScore.passed_controls}
              </div>
              <div className="text-sm text-gray-600">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">
                {currentScore.failed_controls}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600">
                {currentScore.pending_controls}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-600">
                {currentScore.total_controls}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </Card>
      )}

      {/* Trends and History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy Metrics */}
        {trends && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Accuracy Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Prediction Accuracy</span>
                <Badge className={getConfidenceColor(trends.accuracy_metrics.prediction_accuracy)}>
                  {trends.accuracy_metrics.prediction_accuracy}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Confidence Reliability</span>
                <Badge className={getConfidenceColor(trends.accuracy_metrics.confidence_reliability)}>
                  {trends.accuracy_metrics.confidence_reliability}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Trend Stability</span>
                <Badge className={getConfidenceColor(trends.accuracy_metrics.trend_stability)}>
                  {trends.accuracy_metrics.trend_stability}%
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Recent Score History */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Score History</h3>
          <div className="space-y-3">
            {scoreHistory.map((history, index) => (
              <div key={history.id} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <div>
                  <div className="text-sm font-medium">
                    {history.calculated_at.toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {history.triggered_by}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getScoreColor(history.score_data.overall_score)}`}>
                    {history.score_data.overall_score}%
                  </div>
                  {history.changes_from_previous && (
                    <div className={`text-xs ${history.changes_from_previous.score_change > 0 ? 'text-green-600' :
                      history.changes_from_previous.score_change < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                      {history.changes_from_previous.score_change > 0 ? '+' : ''}
                      {history.changes_from_previous.score_change}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Compliance Recommendations</h3>
        <div className="space-y-4">
          {recommendations.slice(0, 5).map((rec) => (
            <div key={rec.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {rec.title}
                </h4>
                <div className="flex gap-2">
                  {getPriorityBadge(rec.priority)}
                  <Badge variant="outline">
                    +{rec.potential_impact}% impact
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {rec.description}
              </p>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Effort: {rec.estimated_effort}</span>
                <span>Confidence: {rec.confidence_in_recommendation}%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Report Generation */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Generate Reports</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            onClick={() => generateReport('comprehensive', 'pdf')}
            variant="outline"
            className="w-full"
          >
            Comprehensive PDF
          </Button>
          <Button
            onClick={() => generateReport('executive_summary', 'pdf')}
            variant="outline"
            className="w-full"
          >
            Executive Summary
          </Button>
          <Button
            onClick={() => generateReport('gap_analysis', 'pdf')}
            variant="outline"
            className="w-full"
          >
            Gap Analysis
          </Button>
          <Button
            onClick={() => generateReport('trend_analysis', 'pdf')}
            variant="outline"
            className="w-full"
          >
            Trend Analysis
          </Button>
        </div>
      </Card>
    </div>
  );
}