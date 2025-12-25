import { ReviewerFeedback, DocumentAnalysis, AuditLog } from '@/types';

export interface ReviewAuditEntry {
  id: string;
  analysis_id: string;
  tenant_id: string;
  reviewer_id: string;
  action: ReviewAction;
  previous_status?: string;
  new_status: string;
  confidence_change?: {
    before: number;
    after: number;
    delta: number;
  };
  feedback_summary: {
    overall_accuracy: number;
    findings_reviewed: number;
    findings_corrected: number;
    mappings_reviewed: number;
    mappings_corrected: number;
    approved: boolean;
  };
  ml_impact: {
    training_data_generated: boolean;
    model_update_triggered: boolean;
    confidence_calibration_updated: boolean;
  };
  review_duration_ms?: number;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export enum ReviewAction {
  REVIEW_SUBMITTED = 'review_submitted',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  FINDINGS_CORRECTED = 'findings_corrected',
  MAPPINGS_CORRECTED = 'mappings_corrected',
  BULK_APPROVED = 'bulk_approved',
  REVIEWER_ASSIGNED = 'reviewer_assigned',
  PRIORITY_MARKED = 'priority_marked',
}

export interface ReviewMetrics {
  total_reviews: number;
  average_accuracy: number;
  approval_rate: number;
  average_review_time_ms: number;
  corrections_rate: number;
  reviewer_performance: ReviewerPerformance[];
  ml_improvement_metrics: MLImprovementMetrics;
}

export interface ReviewerPerformance {
  reviewer_id: string;
  reviews_completed: number;
  average_accuracy_rating: number;
  average_review_time_ms: number;
  corrections_made: number;
  approval_rate: number;
  consistency_score: number; // How consistent their ratings are
}

export interface MLImprovementMetrics {
  confidence_calibration_accuracy: number;
  model_accuracy_improvement: number;
  training_samples_generated: number;
  false_positive_reduction: number;
  false_negative_reduction: number;
}

// Mock data for demonstration
const MOCK_AUDIT_ENTRIES: ReviewAuditEntry[] = [];

export class ReviewAuditService {
  // Log review submission
  async logReviewSubmission(
    analysisId: string,
    tenantId: string,
    reviewerId: string,
    feedback: ReviewerFeedback,
    previousAnalysis: DocumentAnalysis,
    updatedAnalysis: DocumentAnalysis,
    reviewDurationMs?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ReviewAuditEntry> {
    const auditEntry: ReviewAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      analysis_id: analysisId,
      tenant_id: tenantId,
      reviewer_id: reviewerId,
      action: feedback.approved ? ReviewAction.REVIEW_APPROVED : ReviewAction.REVIEW_REJECTED,
      previous_status: previousAnalysis.status,
      new_status: updatedAnalysis.status,
      confidence_change: {
        before: previousAnalysis.confidence_score,
        after: updatedAnalysis.confidence_score,
        delta: updatedAnalysis.confidence_score - previousAnalysis.confidence_score,
      },
      feedback_summary: {
        overall_accuracy: feedback.overall_accuracy,
        findings_reviewed: feedback.findings_feedback.length,
        findings_corrected: feedback.findings_feedback.filter(f => 
          f.corrected_category || f.corrected_finding || !f.is_relevant
        ).length,
        mappings_reviewed: feedback.mappings_feedback.length,
        mappings_corrected: feedback.mappings_feedback.filter(m => 
          m.corrected_status || m.corrected_evidence || !m.is_correct
        ).length,
        approved: feedback.approved,
      },
      ml_impact: {
        training_data_generated: true,
        model_update_triggered: Math.abs(updatedAnalysis.confidence_score - previousAnalysis.confidence_score) > 10,
        confidence_calibration_updated: feedback.overall_accuracy !== previousAnalysis.confidence_score,
      },
      review_duration_ms: reviewDurationMs,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date(),
    };

    MOCK_AUDIT_ENTRIES.push(auditEntry);

    // Log to system audit log as well
    await this.createSystemAuditLog({
      tenant_id: tenantId,
      user_id: reviewerId,
      action: 'DOCUMENT_REVIEW_SUBMITTED',
      resource_type: 'document_analysis',
      resource_id: analysisId,
      details: {
        previous_confidence: previousAnalysis.confidence_score,
        new_confidence: updatedAnalysis.confidence_score,
        overall_accuracy: feedback.overall_accuracy,
        approved: feedback.approved,
        corrections_made: auditEntry.feedback_summary.findings_corrected + auditEntry.feedback_summary.mappings_corrected,
        review_duration_ms: reviewDurationMs,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return auditEntry;
  }

  // Log bulk operations
  async logBulkOperation(
    action: ReviewAction,
    analysisIds: string[],
    tenantId: string,
    reviewerId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ReviewAuditEntry[]> {
    const auditEntries: ReviewAuditEntry[] = [];

    for (const analysisId of analysisIds) {
      const auditEntry: ReviewAuditEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        analysis_id: analysisId,
        tenant_id: tenantId,
        reviewer_id: reviewerId,
        action,
        new_status: this.getStatusForAction(action),
        feedback_summary: {
          overall_accuracy: 0, // Not applicable for bulk operations
          findings_reviewed: 0,
          findings_corrected: 0,
          mappings_reviewed: 0,
          mappings_corrected: 0,
          approved: action === ReviewAction.BULK_APPROVED,
        },
        ml_impact: {
          training_data_generated: false,
          model_update_triggered: false,
          confidence_calibration_updated: false,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date(),
      };

      auditEntries.push(auditEntry);
      MOCK_AUDIT_ENTRIES.push(auditEntry);
    }

    // Log bulk operation to system audit log
    await this.createSystemAuditLog({
      tenant_id: tenantId,
      user_id: reviewerId,
      action: `BULK_${action.toUpperCase()}`,
      resource_type: 'document_analysis',
      resource_id: analysisIds.join(','),
      details: {
        action,
        analysis_count: analysisIds.length,
        analysis_ids: analysisIds,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return auditEntries;
  }

  // Get audit trail for specific analysis
  async getAnalysisAuditTrail(analysisId: string, tenantId: string): Promise<ReviewAuditEntry[]> {
    return MOCK_AUDIT_ENTRIES.filter(
      entry => entry.analysis_id === analysisId && entry.tenant_id === tenantId
    ).sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // Get audit trail for reviewer
  async getReviewerAuditTrail(
    reviewerId: string, 
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ReviewAuditEntry[]> {
    let entries = MOCK_AUDIT_ENTRIES.filter(
      entry => entry.reviewer_id === reviewerId && entry.tenant_id === tenantId
    );

    if (startDate) {
      entries = entries.filter(entry => entry.created_at >= startDate);
    }

    if (endDate) {
      entries = entries.filter(entry => entry.created_at <= endDate);
    }

    return entries.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // Get review metrics
  async getReviewMetrics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ReviewMetrics> {
    let entries = MOCK_AUDIT_ENTRIES.filter(entry => entry.tenant_id === tenantId);

    if (startDate) {
      entries = entries.filter(entry => entry.created_at >= startDate);
    }

    if (endDate) {
      entries = entries.filter(entry => entry.created_at <= endDate);
    }

    const reviewSubmissions = entries.filter(entry => 
      entry.action === ReviewAction.REVIEW_SUBMITTED ||
      entry.action === ReviewAction.REVIEW_APPROVED ||
      entry.action === ReviewAction.REVIEW_REJECTED
    );

    const totalReviews = reviewSubmissions.length;
    const approvedReviews = reviewSubmissions.filter(entry => entry.feedback_summary.approved).length;
    const totalCorrections = reviewSubmissions.reduce((sum, entry) => 
      sum + entry.feedback_summary.findings_corrected + entry.feedback_summary.mappings_corrected, 0
    );

    const averageAccuracy = totalReviews > 0 
      ? reviewSubmissions.reduce((sum, entry) => sum + entry.feedback_summary.overall_accuracy, 0) / totalReviews
      : 0;

    const averageReviewTime = totalReviews > 0
      ? reviewSubmissions
          .filter(entry => entry.review_duration_ms)
          .reduce((sum, entry) => sum + (entry.review_duration_ms || 0), 0) / totalReviews
      : 0;

    // Calculate reviewer performance
    const reviewerPerformance = this.calculateReviewerPerformance(reviewSubmissions);

    // Calculate ML improvement metrics
    const mlMetrics = this.calculateMLImprovementMetrics(entries);

    return {
      total_reviews: totalReviews,
      average_accuracy: Math.round(averageAccuracy * 100) / 100,
      approval_rate: totalReviews > 0 ? Math.round((approvedReviews / totalReviews) * 100) / 100 : 0,
      average_review_time_ms: Math.round(averageReviewTime),
      corrections_rate: totalReviews > 0 ? Math.round((totalCorrections / totalReviews) * 100) / 100 : 0,
      reviewer_performance: reviewerPerformance,
      ml_improvement_metrics: mlMetrics,
    };
  }

  // Export audit data for compliance reporting
  async exportAuditData(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const entries = MOCK_AUDIT_ENTRIES.filter(entry => 
      entry.tenant_id === tenantId &&
      entry.created_at >= startDate &&
      entry.created_at <= endDate
    );

    if (format === 'csv') {
      return this.convertToCSV(entries);
    }

    return JSON.stringify({
      export_date: new Date().toISOString(),
      tenant_id: tenantId,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      total_entries: entries.length,
      entries: entries,
    }, null, 2);
  }

  // Private helper methods
  private getStatusForAction(action: ReviewAction): string {
    switch (action) {
      case ReviewAction.REVIEW_APPROVED:
      case ReviewAction.BULK_APPROVED:
        return 'completed';
      case ReviewAction.REVIEW_REJECTED:
        return 'human_review_required';
      case ReviewAction.REVIEWER_ASSIGNED:
        return 'assigned_for_review';
      case ReviewAction.PRIORITY_MARKED:
        return 'priority_review';
      default:
        return 'under_review';
    }
  }

  private calculateReviewerPerformance(entries: ReviewAuditEntry[]): ReviewerPerformance[] {
    const reviewerMap = new Map<string, ReviewAuditEntry[]>();

    entries.forEach(entry => {
      if (!reviewerMap.has(entry.reviewer_id)) {
        reviewerMap.set(entry.reviewer_id, []);
      }
      reviewerMap.get(entry.reviewer_id)!.push(entry);
    });

    return Array.from(reviewerMap.entries()).map(([reviewerId, reviewerEntries]) => {
      const totalReviews = reviewerEntries.length;
      const approvedReviews = reviewerEntries.filter(entry => entry.feedback_summary.approved).length;
      const totalCorrections = reviewerEntries.reduce((sum, entry) => 
        sum + entry.feedback_summary.findings_corrected + entry.feedback_summary.mappings_corrected, 0
      );

      const averageAccuracy = totalReviews > 0
        ? reviewerEntries.reduce((sum, entry) => sum + entry.feedback_summary.overall_accuracy, 0) / totalReviews
        : 0;

      const averageReviewTime = totalReviews > 0
        ? reviewerEntries
            .filter(entry => entry.review_duration_ms)
            .reduce((sum, entry) => sum + (entry.review_duration_ms || 0), 0) / totalReviews
        : 0;

      // Calculate consistency score based on standard deviation of accuracy ratings
      const accuracyRatings = reviewerEntries.map(entry => entry.feedback_summary.overall_accuracy);
      const consistencyScore = this.calculateConsistencyScore(accuracyRatings);

      return {
        reviewer_id: reviewerId,
        reviews_completed: totalReviews,
        average_accuracy_rating: Math.round(averageAccuracy * 100) / 100,
        average_review_time_ms: Math.round(averageReviewTime),
        corrections_made: totalCorrections,
        approval_rate: totalReviews > 0 ? Math.round((approvedReviews / totalReviews) * 100) / 100 : 0,
        consistency_score: consistencyScore,
      };
    });
  }

  private calculateMLImprovementMetrics(entries: ReviewAuditEntry[]): MLImprovementMetrics {
    const mlEntries = entries.filter(entry => entry.ml_impact.training_data_generated);
    const modelUpdates = entries.filter(entry => entry.ml_impact.model_update_triggered).length;
    const calibrationUpdates = entries.filter(entry => entry.ml_impact.confidence_calibration_updated).length;

    // Simulate ML improvement calculations
    const confidenceCalibrationAccuracy = mlEntries.length > 0 
      ? mlEntries.reduce((sum, entry) => {
          const accuracyDelta = Math.abs(entry.feedback_summary.overall_accuracy - (entry.confidence_change?.before || 0));
          return sum + (100 - accuracyDelta);
        }, 0) / mlEntries.length
      : 0;

    return {
      confidence_calibration_accuracy: Math.round(confidenceCalibrationAccuracy * 100) / 100,
      model_accuracy_improvement: modelUpdates > 0 ? Math.round(Math.random() * 15 + 5) : 0, // Simulated
      training_samples_generated: mlEntries.length,
      false_positive_reduction: Math.round(Math.random() * 10 + 2), // Simulated
      false_negative_reduction: Math.round(Math.random() * 8 + 3), // Simulated
    };
  }

  private calculateConsistencyScore(ratings: number[]): number {
    if (ratings.length < 2) return 100;

    const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const variance = ratings.reduce((sum, rating) => sum + Math.pow(rating - mean, 2), 0) / ratings.length;
    const standardDeviation = Math.sqrt(variance);

    // Convert standard deviation to consistency score (lower deviation = higher consistency)
    const maxStdDev = 25; // Assume max reasonable standard deviation
    const consistencyScore = Math.max(0, 100 - (standardDeviation / maxStdDev) * 100);

    return Math.round(consistencyScore * 100) / 100;
  }

  private convertToCSV(entries: ReviewAuditEntry[]): string {
    const headers = [
      'ID', 'Analysis ID', 'Tenant ID', 'Reviewer ID', 'Action', 'Previous Status', 'New Status',
      'Confidence Before', 'Confidence After', 'Confidence Delta', 'Overall Accuracy',
      'Findings Reviewed', 'Findings Corrected', 'Mappings Reviewed', 'Mappings Corrected',
      'Approved', 'Review Duration (ms)', 'Created At'
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.analysis_id,
      entry.tenant_id,
      entry.reviewer_id,
      entry.action,
      entry.previous_status || '',
      entry.new_status,
      entry.confidence_change?.before || '',
      entry.confidence_change?.after || '',
      entry.confidence_change?.delta || '',
      entry.feedback_summary.overall_accuracy,
      entry.feedback_summary.findings_reviewed,
      entry.feedback_summary.findings_corrected,
      entry.feedback_summary.mappings_reviewed,
      entry.feedback_summary.mappings_corrected,
      entry.feedback_summary.approved,
      entry.review_duration_ms || '',
      entry.created_at.toISOString(),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private async createSystemAuditLog(auditData: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    // In a real implementation, this would save to the audit_logs table
    console.log('System Audit Log Entry:', {
      id: `audit-${Date.now()}`,
      ...auditData,
      created_at: new Date(),
    });
  }
}

export const reviewAuditService = new ReviewAuditService();