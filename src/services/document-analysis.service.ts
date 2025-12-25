import {
  DocumentAnalysis,
  DocumentUpload,
  AnalysisRequest,
  BatchAnalysisRequest,
  AnalysisProgress,
  DocumentValidationResult,
  KeyFinding,
  ComplianceMapping,
  ProcessingMetadata,
  DocumentStructure,
  DocumentSection,
  AnalysisType,
  AnalysisStatus,
  DocumentProcessingMethod,
  ProcessingOptions,
  ReviewerFeedback,
  ApiResponse,
  ComplianceFramework,
  ComplianceControl,
} from '@/types';

export interface ReviewStatistics {
  total_analyses: number;
  reviewed_analyses: number;
  pending_reviews: number;
  average_confidence_before_review: number;
  average_confidence_after_review: number;
  accuracy_improvement: number;
  review_approval_rate: number;
  common_correction_categories: CorrectionCategory[];
  ml_model_performance: MLModelPerformance;
}

export interface CorrectionCategory {
  category: string;
  frequency: number;
  impact_on_accuracy: number;
}

export interface MLModelPerformance {
  precision: number;
  recall: number;
  f1_score: number;
  confidence_calibration_error: number;
}

// Mock data for demonstration
const MOCK_DOCUMENTS: DocumentUpload[] = [
  {
    id: 'doc-1',
    tenant_id: 'dev-tenant-123',
    control_id: 'control-hipaa-1',
    framework_id: 'framework-hipaa',
    filename: 'security-policy-v2.pdf',
    original_filename: 'Information Security Policy v2.0.pdf',
    file_size: 2048000,
    mime_type: 'application/pdf',
    file_path: '/uploads/documents/security-policy-v2.pdf',
    description: 'Updated information security policy document',
    uploaded_by: 'user-security-officer',
    analysis_requested: true,
    analysis_id: 'analysis-1',
    created_at: new Date('2024-10-01'),
    updated_at: new Date('2024-10-01'),
  },
  {
    id: 'doc-2',
    tenant_id: 'dev-tenant-123',
    control_id: 'control-iso-1',
    framework_id: 'framework-iso27001',
    filename: 'incident-response-plan.pdf',
    original_filename: 'Incident Response Plan 2024.pdf',
    file_size: 1536000,
    mime_type: 'application/pdf',
    file_path: '/uploads/documents/incident-response-plan.pdf',
    description: 'Comprehensive incident response procedures',
    uploaded_by: 'user-security-analyst',
    analysis_requested: true,
    analysis_id: 'analysis-2',
    created_at: new Date('2024-10-15'),
    updated_at: new Date('2024-10-15'),
  },
];

const MOCK_ANALYSES: DocumentAnalysis[] = [
  {
    id: 'analysis-1',
    document_id: 'doc-1',
    tenant_id: 'dev-tenant-123',
    framework_id: 'framework-hipaa',
    control_id: 'control-hipaa-1',
    analysis_type: AnalysisType.SECURITY_POLICY,
    processing_method: DocumentProcessingMethod.HYBRID,
    content_extracted: 'Information Security Policy\n\n1. Purpose and Scope\nThis policy establishes the framework for protecting information assets...\n\n2. Access Control\nAll users must authenticate using multi-factor authentication...\n\n3. Data Classification\nData shall be classified as Public, Internal, Confidential, or Restricted...',
    key_findings: [
      {
        id: 'finding-1',
        category: 'Access Control',
        finding: 'Multi-factor authentication requirement identified',
        confidence: 95,
        location: { page: 1, paragraph: 3, section: 'Access Control' },
        compliance_relevance: 'Directly addresses HIPAA access control requirements',
        severity: 'high',
        keywords: ['multi-factor', 'authentication', 'MFA', 'access control'],
      },
      {
        id: 'finding-2',
        category: 'Data Classification',
        finding: 'Four-tier data classification system implemented',
        confidence: 88,
        location: { page: 2, paragraph: 1, section: 'Data Classification' },
        compliance_relevance: 'Supports HIPAA data protection requirements',
        severity: 'medium',
        keywords: ['data classification', 'confidential', 'restricted'],
      },
    ],
    compliance_mappings: [
      {
        id: 'mapping-1',
        control_id: 'control-hipaa-1',
        framework_id: 'framework-hipaa',
        requirement: 'Assign security responsibilities to an individual',
        document_section: 'Section 1.2 - Security Officer Role',
        compliance_status: 'satisfied',
        confidence: 92,
        evidence_text: 'The Chief Information Security Officer (CISO) is designated as the primary security officer responsible for implementing and maintaining this policy.',
        recommendations: ['Consider adding deputy security officer for redundancy'],
      },
      {
        id: 'mapping-2',
        control_id: 'control-hipaa-2',
        framework_id: 'framework-hipaa',
        requirement: 'Implement procedures for workforce training',
        document_section: 'Section 4 - Training and Awareness',
        compliance_status: 'partial',
        confidence: 78,
        evidence_text: 'Annual security awareness training is required for all employees.',
        gap_analysis: 'Missing specific procedures for role-based training',
        recommendations: ['Add role-specific training requirements', 'Include training documentation procedures'],
      },
    ],
    confidence_score: 87,
    status: AnalysisStatus.COMPLETED,
    human_reviewed: false,
    processing_metadata: {
      file_size: 2048000,
      page_count: 15,
      word_count: 3500,
      processing_time_ms: 45000,
      ocr_confidence: 98,
      language_detected: 'en',
      document_structure: {
        has_table_of_contents: true,
        sections: [
          { title: 'Purpose and Scope', level: 1, page_start: 1, page_end: 2, word_count: 450 },
          { title: 'Access Control', level: 1, page_start: 3, page_end: 5, word_count: 680 },
          { title: 'Data Classification', level: 1, page_start: 6, page_end: 8, word_count: 720 },
          { title: 'Training and Awareness', level: 1, page_start: 9, page_end: 12, word_count: 890 },
        ],
        tables_count: 3,
        images_count: 2,
        footnotes_count: 8,
      },
      extraction_method: 'PDF text extraction with OCR fallback',
      ai_model_version: 'gpt-4-turbo-2024-04-09',
    },
    analyzed_at: new Date('2024-10-01T10:30:00Z'),
    created_at: new Date('2024-10-01T10:00:00Z'),
    updated_at: new Date('2024-10-01T10:30:00Z'),
  },
];

export class DocumentAnalysisService {
  // Document upload and management
  async uploadDocument(
    tenantId: string,
    file: {
      filename: string;
      originalFilename: string;
      fileSize: number;
      mimeType: string;
      filePath: string;
    },
    metadata: {
      controlId?: string;
      frameworkId?: string;
      description?: string;
      analysisRequested?: boolean;
    },
    uploadedBy: string
  ): Promise<ApiResponse<DocumentUpload>> {
    try {
      const document: DocumentUpload = {
        id: `doc-${Date.now()}`,
        tenant_id: tenantId,
        control_id: metadata.controlId,
        framework_id: metadata.frameworkId,
        filename: file.filename,
        original_filename: file.originalFilename,
        file_size: file.fileSize,
        mime_type: file.mimeType,
        file_path: file.filePath,
        description: metadata.description,
        uploaded_by: uploadedBy,
        analysis_requested: metadata.analysisRequested || false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      MOCK_DOCUMENTS.push(document);

      return {
        success: true,
        data: document,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'DOCUMENT_UPLOAD_ERROR',
          message: 'Failed to upload document',
        },
      };
    }
  }

  // Document analysis initiation
  async analyzeDocument(
    tenantId: string,
    request: AnalysisRequest
  ): Promise<ApiResponse<DocumentAnalysis>> {
    try {
      const document = MOCK_DOCUMENTS.find(d => d.id === request.document_id && d.tenant_id === tenantId);
      if (!document) {
        return {
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found',
          },
        };
      }

      // Simulate AI processing
      const analysis = await this.performDocumentAnalysis(document, request);

      MOCK_ANALYSES.push(analysis);

      // Update document with analysis ID
      const docIndex = MOCK_DOCUMENTS.findIndex(d => d.id === request.document_id);
      if (docIndex !== -1) {
        MOCK_DOCUMENTS[docIndex].analysis_id = analysis.id;
        MOCK_DOCUMENTS[docIndex].analysis_requested = true;
        MOCK_DOCUMENTS[docIndex].updated_at = new Date();
      }

      return {
        success: true,
        data: analysis,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'ANALYSIS_ERROR',
          message: 'Failed to analyze document',
        },
      };
    }
  }

  // Batch document analysis
  async analyzeBatch(
    tenantId: string,
    request: BatchAnalysisRequest
  ): Promise<ApiResponse<DocumentAnalysis[]>> {
    try {
      const analyses: DocumentAnalysis[] = [];

      for (const documentId of request.document_ids) {
        const analysisRequest: AnalysisRequest = {
          document_id: documentId,
          analysis_type: request.analysis_type,
          framework_id: request.framework_id,
          processing_options: request.processing_options,
        };

        const _result = await this.analyzeDocument(tenantId, analysisRequest);
        if (result.success && result.data) {
          analyses.push(result.data);
        }
      }

      return {
        success: true,
        data: analyses,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'BATCH_ANALYSIS_ERROR',
          message: 'Failed to perform batch analysis',
        },
      };
    }
  }

  // Get analysis results
  async getAnalysis(tenantId: string, analysisId: string): Promise<ApiResponse<DocumentAnalysis>> {
    try {
      const analysis = MOCK_ANALYSES.find(a => a.id === analysisId && a.tenant_id === tenantId);
      if (!analysis) {
        return {
          success: false,
          error: {
            code: 'ANALYSIS_NOT_FOUND',
            message: 'Analysis not found',
          },
        };
      }

      return {
        success: true,
        data: analysis,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'ANALYSIS_FETCH_ERROR',
          message: 'Failed to fetch analysis',
        },
      };
    }
  }

  // Get analysis progress
  async getAnalysisProgress(tenantId: string, analysisId: string): Promise<ApiResponse<AnalysisProgress>> {
    try {
      const analysis = MOCK_ANALYSES.find(a => a.id === analysisId && a.tenant_id === tenantId);
      if (!analysis) {
        return {
          success: false,
          error: {
            code: 'ANALYSIS_NOT_FOUND',
            message: 'Analysis not found',
          },
        };
      }

      const progress: AnalysisProgress = {
        analysis_id: analysisId,
        status: analysis.status,
        progress_percentage: analysis.status === AnalysisStatus.COMPLETED ? 100 : 
                           analysis.status === AnalysisStatus.PROCESSING ? 65 : 0,
        current_step: this.getCurrentProcessingStep(analysis.status),
        estimated_completion: analysis.status === AnalysisStatus.PROCESSING ? 
                            new Date(Date.now() + 300000) : undefined, // 5 minutes
      };

      return {
        success: true,
        data: progress,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'PROGRESS_FETCH_ERROR',
          message: 'Failed to fetch analysis progress',
        },
      };
    }
  }

  // Human review and feedback
  async submitReview(
    tenantId: string,
    analysisId: string,
    feedback: ReviewerFeedback
  ): Promise<ApiResponse<DocumentAnalysis>> {
    try {
      const analysisIndex = MOCK_ANALYSES.findIndex(a => a.id === analysisId && a.tenant_id === tenantId);
      if (analysisIndex === -1) {
        return {
          success: false,
          error: {
            code: 'ANALYSIS_NOT_FOUND',
            message: 'Analysis not found',
          },
        };
      }

      MOCK_ANALYSES[analysisIndex] = {
        ...MOCK_ANALYSES[analysisIndex],
        human_reviewed: true,
        reviewer_feedback: feedback,
        reviewed_at: new Date(),
        updated_at: new Date(),
      };

      // Update confidence score based on feedback
      const avgAccuracy = feedback.overall_accuracy;
      MOCK_ANALYSES[analysisIndex].confidence_score = Math.round(
        (MOCK_ANALYSES[analysisIndex].confidence_score + avgAccuracy) / 2
      );

      return {
        success: true,
        data: MOCK_ANALYSES[analysisIndex],
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'REVIEW_SUBMISSION_ERROR',
          message: 'Failed to submit review',
        },
      };
    }
  }

  // Document validation against compliance frameworks
  async validateDocument(
    tenantId: string,
    documentId: string,
    frameworkId: string
  ): Promise<ApiResponse<DocumentValidationResult>> {
    try {
      const document = MOCK_DOCUMENTS.find(d => d.id === documentId && d.tenant_id === tenantId);
      if (!document) {
        return {
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found',
          },
        };
      }

      // Simulate validation process
      const validationResult: DocumentValidationResult = {
        document_id: documentId,
        framework_id: frameworkId,
        overall_compliance_score: 78,
        validation_results: [
          {
            control_id: 'control-1',
            requirement: 'Security officer assignment',
            status: 'met',
            confidence: 92,
            evidence_found: ['CISO designation in Section 1.2'],
            gaps: [],
          },
          {
            control_id: 'control-2',
            requirement: 'Workforce training procedures',
            status: 'partially_met',
            confidence: 78,
            evidence_found: ['Annual training requirement'],
            gaps: ['Missing role-specific training', 'No training documentation procedures'],
          },
        ],
        gaps_identified: [
          {
            control_id: 'control-2',
            requirement: 'Workforce training procedures',
            gap_description: 'Missing detailed role-specific training requirements',
            severity: 'medium',
            recommendations: ['Add role-based training matrix', 'Include training record keeping procedures'],
            estimated_effort: '2-3 weeks',
          },
        ],
        recommendations: [
          'Add role-specific training requirements to Section 4',
          'Include training documentation and record-keeping procedures',
          'Consider adding deputy security officer designation',
        ],
        validated_at: new Date(),
      };

      return {
        success: true,
        data: validationResult,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to validate document',
        },
      };
    }
  }

  // Get pending reviews
  async getPendingReviews(_tenantId: string): Promise<ApiResponse<DocumentAnalysis[]>> {
    try {
      const pendingReviews = MOCK_ANALYSES.filter(
        a => a.tenant_id === tenantId && 
             a.status === AnalysisStatus.HUMAN_REVIEW_REQUIRED && 
             !a.human_reviewed
      );

      // Add some mock pending reviews for demonstration
      if (pendingReviews.length === 0) {
        const mockPendingReview: DocumentAnalysis = {
          id: 'analysis-pending-1',
          document_id: 'doc-pending-1',
          tenant_id: tenantId,
          framework_id: 'framework-hipaa',
          control_id: 'control-hipaa-1',
          analysis_type: AnalysisType.SECURITY_POLICY,
          processing_method: DocumentProcessingMethod.HYBRID,
          content_extracted: 'Sample security policy content requiring human review...',
          key_findings: [
            {
              id: 'finding-pending-1',
              category: 'Access Control',
              finding: 'Password policy requirements identified but unclear implementation',
              confidence: 65,
              location: { page: 1, paragraph: 2, section: 'Password Policy' },
              compliance_relevance: 'May address HIPAA access control requirements',
              severity: 'medium',
              keywords: ['password', 'policy', 'access'],
            },
          ],
          compliance_mappings: [
            {
              id: 'mapping-pending-1',
              control_id: 'control-hipaa-1',
              framework_id: 'framework-hipaa',
              requirement: 'Implement access control procedures',
              document_section: 'Section 3 - Access Control',
              compliance_status: 'unclear',
              confidence: 68,
              evidence_text: 'Access control procedures are mentioned but lack specific implementation details.',
            },
          ],
          confidence_score: 66,
          status: AnalysisStatus.HUMAN_REVIEW_REQUIRED,
          human_reviewed: false,
          processing_metadata: {
            file_size: 1024000,
            page_count: 8,
            word_count: 2500,
            processing_time_ms: 35000,
            ocr_confidence: 92,
            language_detected: 'en',
            document_structure: {
              has_table_of_contents: true,
              sections: [
                { title: 'Password Policy', level: 1, word_count: 350 },
                { title: 'Access Control', level: 1, word_count: 480 },
              ],
              tables_count: 1,
              images_count: 0,
              footnotes_count: 3,
            },
            extraction_method: 'OCR + NLP',
            ai_model_version: 'gpt-4-turbo-2024-04-09',
          },
          analyzed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        };

        pendingReviews.push(mockPendingReview);
      }

      return {
        success: true,
        data: pendingReviews,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'PENDING_REVIEWS_ERROR',
          message: 'Failed to fetch pending reviews',
        },
      };
    }
  }

  // Get document analyses by control
  async getAnalysesByControl(tenantId: string, controlId: string): Promise<ApiResponse<DocumentAnalysis[]>> {
    try {
      const analyses = MOCK_ANALYSES.filter(
        a => a.tenant_id === tenantId && a.control_id === controlId
      );

      return {
        success: true,
        data: analyses,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'ANALYSES_FETCH_ERROR',
          message: 'Failed to fetch analyses',
        },
      };
    }
  }

  // Get review statistics for machine learning improvement tracking
  async getReviewStatistics(_tenantId: string): Promise<ApiResponse<ReviewStatistics>> {
    try {
      const allAnalyses = MOCK_ANALYSES.filter(a => a.tenant_id === tenantId);
      const reviewedAnalyses = allAnalyses.filter(a => a.human_reviewed && a.reviewer_feedback);

      const statistics: ReviewStatistics = {
        total_analyses: allAnalyses.length,
        reviewed_analyses: reviewedAnalyses.length,
        pending_reviews: allAnalyses.filter(a => 
          a.status === AnalysisStatus.HUMAN_REVIEW_REQUIRED && !a.human_reviewed
        ).length,
        average_confidence_before_review: this.calculateAverageConfidence(allAnalyses),
        average_confidence_after_review: this.calculateAverageConfidence(reviewedAnalyses),
        accuracy_improvement: this.calculateAccuracyImprovement(reviewedAnalyses),
        review_approval_rate: this.calculateApprovalRate(reviewedAnalyses),
        common_correction_categories: this.getCommonCorrectionCategories(reviewedAnalyses),
        ml_model_performance: {
          precision: 0.87,
          recall: 0.82,
          f1_score: 0.84,
          confidence_calibration_error: 0.08,
        },
      };

      return {
        success: true,
        data: statistics,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'STATISTICS_ERROR',
          message: 'Failed to fetch review statistics',
        },
      };
    }
  }

  // Private helper methods
  private async performDocumentAnalysis(
    document: DocumentUpload,
    request: AnalysisRequest
  ): Promise<DocumentAnalysis> {
    // Simulate AI processing time
    const processingStartTime = Date.now();

    // Simulate text extraction and OCR
    const extractedText = await this.extractText(document, request.processing_options);
    
    // Simulate NLP analysis
    const keyFindings = await this.performNLPAnalysis(extractedText, request.analysis_type);
    
    // Simulate compliance mapping
    const complianceMappings = await this.performComplianceMapping(
      extractedText, 
      keyFindings, 
      request.framework_id
    );

    const processingTime = Date.now() - processingStartTime;

    return {
      id: `analysis-${Date.now()}`,
      document_id: document.id,
      tenant_id: document.tenant_id,
      framework_id: request.framework_id,
      control_id: request.control_id,
      analysis_type: request.analysis_type,
      processing_method: this.determineProcessingMethod(request.processing_options),
      content_extracted: extractedText,
      key_findings: keyFindings,
      compliance_mappings: complianceMappings,
      confidence_score: this.calculateConfidenceScore(keyFindings, complianceMappings),
      status: this.determineAnalysisStatus(keyFindings, complianceMappings),
      human_reviewed: false,
      processing_metadata: {
        file_size: document.file_size,
        page_count: this.estimatePageCount(document.file_size),
        word_count: extractedText.split(' ').length,
        processing_time_ms: processingTime,
        ocr_confidence: request.processing_options.enable_ocr ? 95 : undefined,
        language_detected: 'en',
        document_structure: this.analyzeDocumentStructure(extractedText),
        extraction_method: request.processing_options.enable_ocr ? 'OCR + NLP' : 'Text extraction + NLP',
        ai_model_version: 'gpt-4-turbo-2024-04-09',
      },
      analyzed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  private async extractText(document: DocumentUpload, options: ProcessingOptions): Promise<string> {
    // Simulate text extraction based on document type
    if (document.mime_type === 'application/pdf') {
      return 'Information Security Policy\n\n1. Purpose and Scope\nThis policy establishes the framework for protecting information assets and ensuring compliance with regulatory requirements...\n\n2. Access Control\nAll users must authenticate using multi-factor authentication before accessing sensitive systems...';
    }
    return 'Sample extracted text content...';
  }

  private async performNLPAnalysis(text: string, analysisType: AnalysisType): Promise<KeyFinding[]> {
    // Simulate NLP analysis to extract key findings
    const findings: KeyFinding[] = [
      {
        id: `finding-${Date.now()}`,
        category: 'Access Control',
        finding: 'Multi-factor authentication requirement identified',
        confidence: 95,
        location: { page: 1, paragraph: 3, section: 'Access Control' },
        compliance_relevance: 'Addresses authentication security controls',
        severity: 'high',
        keywords: ['multi-factor', 'authentication', 'MFA'],
      },
    ];

    return findings;
  }

  private async performComplianceMapping(
    text: string,
    findings: KeyFinding[],
    frameworkId?: string
  ): Promise<ComplianceMapping[]> {
    // Simulate compliance mapping analysis
    if (!frameworkId) return [];

    const mappings: ComplianceMapping[] = [
      {
        id: `mapping-${Date.now()}`,
        control_id: 'control-1',
        framework_id: frameworkId,
        requirement: 'Implement access control measures',
        document_section: 'Section 2 - Access Control',
        compliance_status: 'satisfied',
        confidence: 92,
        evidence_text: 'Multi-factor authentication is required for all users',
      },
    ];

    return mappings;
  }

  private determineProcessingMethod(options: ProcessingOptions): DocumentProcessingMethod {
    if (options.enable_ocr && options.enable_nlp) {
      return DocumentProcessingMethod.HYBRID;
    } else if (options.enable_ocr) {
      return DocumentProcessingMethod.OCR_PROCESSING;
    } else if (options.enable_nlp) {
      return DocumentProcessingMethod.NLP_ANALYSIS;
    }
    return DocumentProcessingMethod.TEXT_EXTRACTION;
  }

  private calculateConfidenceScore(findings: KeyFinding[], mappings: ComplianceMapping[]): number {
    const findingScores = findings.map(f => f.confidence);
    const mappingScores = mappings.map(m => m.confidence);
    const allScores = [...findingScores, ...mappingScores];
    
    if (allScores.length === 0) return 0;
    
    return Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length);
  }

  private determineAnalysisStatus(findings: KeyFinding[], mappings: ComplianceMapping[]): AnalysisStatus {
    const avgConfidence = this.calculateConfidenceScore(findings, mappings);
    
    if (avgConfidence < 70) {
      return AnalysisStatus.HUMAN_REVIEW_REQUIRED;
    }
    
    return AnalysisStatus.COMPLETED;
  }

  private estimatePageCount(fileSize: number): number {
    // Rough estimate: 50KB per page for PDF
    return Math.ceil(fileSize / 51200);
  }

  private analyzeDocumentStructure(text: string): DocumentStructure {
    // Simple structure analysis
    const sections = text.split('\n\n').filter(section => section.trim().length > 0);
    
    return {
      has_table_of_contents: text.toLowerCase().includes('table of contents'),
      sections: sections.slice(0, 5).map((section, index) => ({
        title: section.split('\n')[0] || `Section ${index + 1}`,
        level: 1,
        word_count: section.split(' ').length,
      })),
      tables_count: (text.match(/\|.*\|/g) || []).length,
      images_count: (text.match(/\[image\]/gi) || []).length,
      footnotes_count: (text.match(/\[\d+\]/g) || []).length,
    };
  }

  private getCurrentProcessingStep(status: AnalysisStatus): string {
    switch (status) {
      case AnalysisStatus.PENDING:
        return 'Queued for processing';
      case AnalysisStatus.PROCESSING:
        return 'Performing NLP analysis and compliance mapping';
      case AnalysisStatus.COMPLETED:
        return 'Analysis completed';
      case AnalysisStatus.HUMAN_REVIEW_REQUIRED:
        return 'Awaiting human review';
      case AnalysisStatus.FAILED:
        return 'Processing failed';
      default:
        return 'Unknown status';
    }
  }

  // Helper methods for review statistics
  private calculateAverageConfidence(analyses: DocumentAnalysis[]): number {
    if (analyses.length === 0) return 0;
    const sum = analyses.reduce((total, analysis) => total + analysis.confidence_score, 0);
    return Math.round((sum / analyses.length) * 100) / 100;
  }

  private calculateAccuracyImprovement(reviewedAnalyses: DocumentAnalysis[]): number {
    if (reviewedAnalyses.length === 0) return 0;
    
    const improvements = reviewedAnalyses
      .filter(a => a.reviewer_feedback)
      .map(a => a.reviewer_feedback!.overall_accuracy - a.confidence_score);
    
    if (improvements.length === 0) return 0;
    
    const averageImprovement = improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
    return Math.round(averageImprovement * 100) / 100;
  }

  private calculateApprovalRate(reviewedAnalyses: DocumentAnalysis[]): number {
    if (reviewedAnalyses.length === 0) return 0;
    
    const approvedCount = reviewedAnalyses
      .filter(a => a.reviewer_feedback?.approved)
      .length;
    
    return Math.round((approvedCount / reviewedAnalyses.length) * 100) / 100;
  }

  private getCommonCorrectionCategories(reviewedAnalyses: DocumentAnalysis[]): CorrectionCategory[] {
    const categoryMap = new Map<string, { count: number; totalImpact: number }>();

    reviewedAnalyses.forEach(analysis => {
      if (!analysis.reviewer_feedback) return;

      // Count finding corrections
      analysis.reviewer_feedback.findings_feedback.forEach(feedback => {
        if (feedback.corrected_category || feedback.corrected_finding || !feedback.is_relevant) {
          const category = feedback.corrected_category || 'Finding Corrections';
          const impact = Math.abs(feedback.accuracy_rating - 100);
          
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { count: 0, totalImpact: 0 });
          }
          
          const current = categoryMap.get(category)!;
          current.count += 1;
          current.totalImpact += impact;
        }
      });

      // Count mapping corrections
      analysis.reviewer_feedback.mappings_feedback.forEach(feedback => {
        if (feedback.corrected_status || feedback.corrected_evidence || !feedback.is_correct) {
          const category = 'Compliance Mapping Corrections';
          const impact = Math.abs(feedback.accuracy_rating - 100);
          
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { count: 0, totalImpact: 0 });
          }
          
          const current = categoryMap.get(category)!;
          current.count += 1;
          current.totalImpact += impact;
        }
      });
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        frequency: data.count,
        impact_on_accuracy: Math.round((data.totalImpact / data.count) * 100) / 100,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 categories
  }
}

export const documentAnalysisService = new DocumentAnalysisService();