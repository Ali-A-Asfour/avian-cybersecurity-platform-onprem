'use client';

import React, { useEffect, useState } from 'react';
import { DocumentAnalysis, AnalysisStatus, ReviewerFeedback, FindingFeedback, MappingFeedback } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { documentAnalysisService } from '@/services/document-analysis.service';

interface PendingReviewsProps {
  tenantId: string;
  onReviewComplete?: (analysisId: string) => void;
}

export function PendingReviews({ tenantId, onReviewComplete }: PendingReviewsProps) {
  const [pendingAnalyses, setPendingAnalyses] = useState<DocumentAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<DocumentAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchPendingReviews();
  }, [tenantId]);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const response = await documentAnalysisService.getPendingReviews(tenantId);
      if (response.success && response.data) {
        setPendingAnalyses(response.data);
      }
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (analysis: DocumentAnalysis) => {
    setSelectedAnalysis(analysis);
    setReviewModalOpen(true);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
    return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Pending Document Reviews
        </h2>
        <Badge variant="secondary" className="text-sm">
          {pendingAnalyses.length} pending
        </Badge>
      </div>

      {pendingAnalyses.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">All caught up!</h3>
              <p className="text-gray-500 dark:text-gray-400">No documents are currently pending review.</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          {pendingAnalyses.map((analysis) => (
            <Card key={analysis.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Document Analysis #{analysis.id.slice(-8)}
                    </h3>
                    <Badge variant="warning">
                      Review Required
                    </Badge>
                    <Badge 
                      variant="secondary" 
                      className={getConfidenceColor(analysis.confidence_score)}
                    >
                      {analysis.confidence_score}% confidence
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Analysis Type:</span>
                      <p className="text-gray-900 dark:text-white capitalize">
                        {analysis.analysis_type.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Key Findings:</span>
                      <p className="text-gray-900 dark:text-white">
                        {analysis.key_findings.length} findings
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Compliance Mappings:</span>
                      <p className="text-gray-900 dark:text-white">
                        {analysis.compliance_mappings.length} mappings
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Analyzed:</span>
                      <p className="text-gray-900 dark:text-white">
                        {formatDate(analysis.analyzed_at)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">Key Findings Preview:</h4>
                    <div className="space-y-1">
                      {analysis.key_findings.slice(0, 2).map((finding) => (
                        <div key={finding.id} className="flex items-center space-x-2 text-sm">
                          <Badge 
                            variant="secondary" 
                            className={getConfidenceColor(finding.confidence)}
                          >
                            {finding.confidence}%
                          </Badge>
                          <span className="text-gray-600 dark:text-gray-400">{finding.category}:</span>
                          <span className="text-gray-900 dark:text-white">{finding.finding}</span>
                        </div>
                      ))}
                      {analysis.key_findings.length > 2 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          +{analysis.key_findings.length - 2} more findings
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-2 ml-6">
                  <Button
                    onClick={() => handleReviewClick(analysis)}
                    className="min-w-[120px]"
                  >
                    Review Analysis
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedAnalysis && (
        <DocumentReviewModal
          analysis={selectedAnalysis}
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setSelectedAnalysis(null);
          }}
          onSubmitReview={async (feedback) => {
            setSubmittingReview(true);
            try {
              const response = await documentAnalysisService.submitReview(
                tenantId,
                selectedAnalysis.id,
                feedback
              );
              
              if (response.success) {
                // Remove from pending list
                setPendingAnalyses(prev => 
                  prev.filter(a => a.id !== selectedAnalysis.id)
                );
                
                setReviewModalOpen(false);
                setSelectedAnalysis(null);
                onReviewComplete?.(selectedAnalysis.id);
              }
            } catch (error) {
              console.error('Error submitting review:', error);
            } finally {
              setSubmittingReview(false);
            }
          }}
          submitting={submittingReview}
        />
      )}
    </div>
  );
}

interface DocumentReviewModalProps {
  analysis: DocumentAnalysis;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (feedback: ReviewerFeedback) => Promise<void>;
  submitting: boolean;
}

function DocumentReviewModal({
  analysis,
  isOpen,
  onClose,
  onSubmitReview,
  submitting,
}: DocumentReviewModalProps) {
  const [overallAccuracy, setOverallAccuracy] = useState(80);
  const [findingsFeedback, setFindingsFeedback] = useState<FindingFeedback[]>([]);
  const [mappingsFeedback, setMappingsFeedback] = useState<MappingFeedback[]>([]);
  const [generalComments, setGeneralComments] = useState('');
  const [approved, setApproved] = useState(true);
  const [activeTab, setActiveTab] = useState<'findings' | 'mappings' | 'summary'>('findings');

  useEffect(() => {
    // Initialize feedback arrays
    setFindingsFeedback(
      analysis.key_findings.map(finding => ({
        finding_id: finding.id,
        accuracy_rating: finding.confidence,
        is_relevant: true,
        comments: '',
      }))
    );

    setMappingsFeedback(
      analysis.compliance_mappings.map(mapping => ({
        mapping_id: mapping.id,
        accuracy_rating: mapping.confidence,
        is_correct: mapping.compliance_status === 'satisfied',
        comments: '',
      }))
    );
  }, [analysis]);

  const updateFindingFeedback = (findingId: string, updates: Partial<FindingFeedback>) => {
    setFindingsFeedback(prev =>
      prev.map(feedback =>
        feedback.finding_id === findingId
          ? { ...feedback, ...updates }
          : feedback
      )
    );
  };

  const updateMappingFeedback = (mappingId: string, updates: Partial<MappingFeedback>) => {
    setMappingsFeedback(prev =>
      prev.map(feedback =>
        feedback.mapping_id === mappingId
          ? { ...feedback, ...updates }
          : feedback
      )
    );
  };

  const handleSubmit = async () => {
    const feedback: ReviewerFeedback = {
      reviewer_id: 'current-user-id', // This would come from auth context
      review_date: new Date(),
      overall_accuracy: overallAccuracy,
      findings_feedback: findingsFeedback,
      mappings_feedback: mappingsFeedback,
      general_comments: generalComments,
      approved,
    };

    await onSubmitReview(feedback);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Review Document Analysis
          </h2>
          <Badge 
            variant="secondary" 
            className={`${getConfidenceColor(analysis.confidence_score)} bg-opacity-20`}
          >
            {analysis.confidence_score}% AI Confidence
          </Badge>
        </div>

        {/* Analysis Overview */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500 dark:text-gray-400">Analysis Type:</span>
              <p className="text-gray-900 dark:text-white capitalize">
                {analysis.analysis_type.replace('_', ' ')}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-500 dark:text-gray-400">Processing Method:</span>
              <p className="text-gray-900 dark:text-white capitalize">
                {analysis.processing_method.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'findings', label: 'Key Findings', count: analysis.key_findings.length },
              { id: 'mappings', label: 'Compliance Mappings', count: analysis.compliance_mappings.length },
              { id: 'summary', label: 'Review Summary', count: null },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-h-96 overflow-y-auto">
          {activeTab === 'findings' && (
            <div className="space-y-4">
              {analysis.key_findings.map((finding, index) => {
                const feedback = findingsFeedback.find(f => f.finding_id === finding.id);
                if (!feedback) return null;

                return (
                  <div key={finding.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="secondary">{finding.category}</Badge>
                          <Badge 
                            variant="secondary" 
                            className={getConfidenceColor(finding.confidence)}
                          >
                            {finding.confidence}% confidence
                          </Badge>
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium">{finding.finding}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {finding.compliance_relevance}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={feedback.is_relevant}
                            onChange={(e) => updateFindingFeedback(finding.id, { is_relevant: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Relevant finding</span>
                        </label>

                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-700 dark:text-gray-300">Accuracy:</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={feedback.accuracy_rating}
                            onChange={(e) => updateFindingFeedback(finding.id, { accuracy_rating: parseInt(e.target.value) })}
                            className="w-20"
                          />
                          <span className="text-sm font-medium text-gray-900 dark:text-white w-12">
                            {feedback.accuracy_rating}%
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Comments (optional)
                        </label>
                        <textarea
                          value={feedback.comments || ''}
                          onChange={(e) => updateFindingFeedback(finding.id, { comments: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                          placeholder="Add feedback about this finding..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'mappings' && (
            <div className="space-y-4">
              {analysis.compliance_mappings.map((mapping) => {
                const feedback = mappingsFeedback.find(f => f.mapping_id === mapping.id);
                if (!feedback) return null;

                return (
                  <div key={mapping.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="secondary">{mapping.control_id}</Badge>
                          <Badge 
                            variant={mapping.compliance_status === 'satisfied' ? 'success' : 
                                   mapping.compliance_status === 'partial' ? 'warning' : 'error'}
                          >
                            {mapping.compliance_status}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={getConfidenceColor(mapping.confidence)}
                          >
                            {mapping.confidence}% confidence
                          </Badge>
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium">{mapping.requirement}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Section: {mapping.document_section}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                          {mapping.evidence_text}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={feedback.is_correct}
                            onChange={(e) => updateMappingFeedback(mapping.id, { is_correct: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Correct mapping</span>
                        </label>

                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-700 dark:text-gray-300">Accuracy:</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={feedback.accuracy_rating}
                            onChange={(e) => updateMappingFeedback(mapping.id, { accuracy_rating: parseInt(e.target.value) })}
                            className="w-20"
                          />
                          <span className="text-sm font-medium text-gray-900 dark:text-white w-12">
                            {feedback.accuracy_rating}%
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Comments (optional)
                        </label>
                        <textarea
                          value={feedback.comments || ''}
                          onChange={(e) => updateMappingFeedback(mapping.id, { comments: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                          placeholder="Add feedback about this mapping..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Overall Analysis Accuracy
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overallAccuracy}
                    onChange={(e) => setOverallAccuracy(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-lg font-medium text-gray-900 dark:text-white w-16">
                    {overallAccuracy}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  General Comments
                </label>
                <textarea
                  value={generalComments}
                  onChange={(e) => setGeneralComments(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Provide overall feedback about the AI analysis quality, accuracy, and any suggestions for improvement..."
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="approval"
                    checked={approved}
                    onChange={() => setApproved(true)}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Approve Analysis</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="approval"
                    checked={!approved}
                    onChange={() => setApproved(false)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Reject Analysis</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Submitting...</span>
              </div>
            ) : (
              'Submit Review'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}