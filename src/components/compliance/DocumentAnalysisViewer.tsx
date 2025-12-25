'use client';

import React, { useEffect, useState } from 'react';
import { DocumentAnalysis, AnalysisStatus, KeyFinding, ComplianceMapping } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Modal } from '@/components/ui/Modal';
import { documentAnalysisService } from '@/services/document-analysis.service';

interface DocumentAnalysisViewerProps {
  analysisId: string;
  tenantId: string;
  onReviewRequest?: (analysisId: string) => void;
}

export function DocumentAnalysisViewer({
  analysisId,
  tenantId,
  onReviewRequest
}: DocumentAnalysisViewerProps) {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'mappings' | 'content'>('overview');
  const [selectedFinding, setSelectedFinding] = useState<KeyFinding | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<ComplianceMapping | null>(null);
  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);

  useEffect(() => {
    fetchAnalysis();
  }, [analysisId, tenantId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await documentAnalysisService.getAnalysis(tenantId, analysisId);
      if (response.success && response.data) {
        setAnalysis(response.data);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
    return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
  };

  const getStatusColor = (status: AnalysisStatus) => {
    switch (status) {
      case AnalysisStatus.COMPLETED:
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case AnalysisStatus.HUMAN_REVIEW_REQUIRED:
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case AnalysisStatus.PROCESSING:
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      case AnalysisStatus.FAILED:
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'satisfied':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'partial':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'not_satisfied':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getSeverityBadge = (severity: string) => {
    // Map to standard severity levels
    const mapSeverity = (sev: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
      switch (sev.toLowerCase()) {
        case 'critical': return 'critical';
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
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

  const handleFindingClick = (finding: KeyFinding) => {
    setSelectedFinding(finding);
    setFindingModalOpen(true);
  };

  const handleMappingClick = (mapping: ComplianceMapping) => {
    setSelectedMapping(mapping);
    setMappingModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Analysis not found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Document Analysis Results
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analysis ID: {analysis.id}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className={getStatusColor(analysis.status)}>
            {analysis.status.replace('_', ' ')}
          </Badge>
          <Badge className={getConfidenceColor(analysis.confidence_score)}>
            {analysis.confidence_score}% confidence
          </Badge>
          {analysis.status === AnalysisStatus.HUMAN_REVIEW_REQUIRED && (
            <Button onClick={() => onReviewRequest?.(analysis.id)}>
              Review Required
            </Button>
          )}
        </div>
      </div>

      {/* Analysis Overview */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Analysis Type</h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {analysis.analysis_type.replace('_', ' ')}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing Method</h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {analysis.processing_method.replace('_', ' ')}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Key Findings</h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {analysis.key_findings.length}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Compliance Mappings</h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {analysis.compliance_mappings.length}
            </p>
          </div>
        </div>

        {analysis.human_reviewed && analysis.reviewer_feedback && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Human Review Completed</h4>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Reviewed on {formatDate(analysis.reviewed_at!)} with {analysis.reviewer_feedback.overall_accuracy}% accuracy rating
            </p>
            {analysis.reviewer_feedback.general_comments && (
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                "{analysis.reviewer_feedback.general_comments}"
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'findings', label: 'Key Findings', count: analysis.key_findings.length },
            { id: 'mappings', label: 'Compliance Mappings', count: analysis.compliance_mappings.length },
            { id: 'content', label: 'Extracted Content' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Processing Metadata */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Processing Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">File Size:</span>
                  <span className="text-gray-900 dark:text-white">
                    {(analysis.processing_metadata.file_size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Page Count:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.page_count || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Word Count:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.word_count?.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Processing Time:</span>
                  <span className="text-gray-900 dark:text-white">
                    {(analysis.processing_metadata.processing_time_ms / 1000).toFixed(1)}s
                  </span>
                </div>
                {analysis.processing_metadata.ocr_confidence && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">OCR Confidence:</span>
                    <span className="text-gray-900 dark:text-white">
                      {analysis.processing_metadata.ocr_confidence}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Language:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.language_detected || 'Unknown'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Document Structure */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Document Structure
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Table of Contents:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.document_structure.has_table_of_contents ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Sections:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.document_structure.sections.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tables:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.document_structure.tables_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Images:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.document_structure.images_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Footnotes:</span>
                  <span className="text-gray-900 dark:text-white">
                    {analysis.processing_metadata.document_structure.footnotes_count}
                  </span>
                </div>
              </div>

              {analysis.processing_metadata.document_structure.sections.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Sections:</h4>
                  <div className="space-y-1">
                    {analysis.processing_metadata.document_structure.sections.slice(0, 5).map((section, index) => (
                      <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                        {section.title} ({section.word_count} words)
                      </div>
                    ))}
                    {analysis.processing_metadata.document_structure.sections.length > 5 && (
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        +{analysis.processing_metadata.document_structure.sections.length - 5} more sections
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'findings' && (
          <div className="space-y-4">
            {analysis.key_findings.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No key findings identified</p>
              </Card>
            ) : (
              analysis.key_findings.map((finding) => (
                <Card key={finding.id} className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleFindingClick(finding)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary">{finding.category}</Badge>
                        {getSeverityBadge(finding.severity)}
                        <Badge className={getConfidenceColor(finding.confidence)}>
                          {finding.confidence}% confidence
                        </Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {finding.finding}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {finding.compliance_relevance}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        {finding.location.section && (
                          <span>Section: {finding.location.section}</span>
                        )}
                        {finding.location.page && (
                          <span>Page: {finding.location.page}</span>
                        )}
                        <span>Keywords: {finding.keywords.join(', ')}</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'mappings' && (
          <div className="space-y-4">
            {analysis.compliance_mappings.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No compliance mappings identified</p>
              </Card>
            ) : (
              analysis.compliance_mappings.map((mapping) => (
                <Card key={mapping.id} className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleMappingClick(mapping)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary">{mapping.control_id}</Badge>
                        <Badge className={getComplianceStatusColor(mapping.compliance_status)}>
                          {mapping.compliance_status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getConfidenceColor(mapping.confidence)}>
                          {mapping.confidence}% confidence
                        </Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {mapping.requirement}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        Section: {mapping.document_section}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300 text-sm">
                        {mapping.evidence_text}
                      </p>
                      {mapping.gap_analysis && (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Gap Analysis:</strong> {mapping.gap_analysis}
                          </p>
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Extracted Content
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {analysis.content_extracted}
              </pre>
            </div>
          </Card>
        )}
      </div>

      {/* Finding Detail Modal */}
      {selectedFinding && (
        <Modal isOpen={findingModalOpen} onClose={() => setFindingModalOpen(false)} size="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Finding Details
              </h2>
              <div className="flex items-center space-x-2">
                {getSeverityBadge(selectedFinding.severity)}
                <Badge className={getConfidenceColor(selectedFinding.confidence)}>
                  {selectedFinding.confidence}% confidence
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Category</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedFinding.category}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Finding</h3>
                <p className="text-gray-900 dark:text-white">{selectedFinding.finding}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Compliance Relevance</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedFinding.compliance_relevance}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Location</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFinding.location.section && <p>Section: {selectedFinding.location.section}</p>}
                  {selectedFinding.location.page && <p>Page: {selectedFinding.location.page}</p>}
                  {selectedFinding.location.paragraph && <p>Paragraph: {selectedFinding.location.paragraph}</p>}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Keywords</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedFinding.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">{keyword}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Mapping Detail Modal */}
      {selectedMapping && (
        <Modal isOpen={mappingModalOpen} onClose={() => setMappingModalOpen(false)} size="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Compliance Mapping Details
              </h2>
              <div className="flex items-center space-x-2">
                <Badge className={getComplianceStatusColor(selectedMapping.compliance_status)}>
                  {selectedMapping.compliance_status.replace('_', ' ')}
                </Badge>
                <Badge className={getConfidenceColor(selectedMapping.confidence)}>
                  {selectedMapping.confidence}% confidence
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Control ID</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedMapping.control_id}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Requirement</h3>
                <p className="text-gray-900 dark:text-white">{selectedMapping.requirement}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Document Section</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedMapping.document_section}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Evidence Text</h3>
                <p className="text-gray-700 dark:text-gray-300">{selectedMapping.evidence_text}</p>
              </div>

              {selectedMapping.gap_analysis && (
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Gap Analysis</h3>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-yellow-800 dark:text-yellow-200">{selectedMapping.gap_analysis}</p>
                  </div>
                </div>
              )}

              {selectedMapping.recommendations && selectedMapping.recommendations.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Recommendations</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                    {selectedMapping.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}