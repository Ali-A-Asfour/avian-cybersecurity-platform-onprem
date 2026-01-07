import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';
import { ReviewerFeedback } from '@/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    const _tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const feedback: ReviewerFeedback = {
      reviewer_id: body.reviewer_id,
      review_date: new Date(body.review_date),
      overall_accuracy: body.overall_accuracy,
      findings_feedback: body.findings_feedback,
      mappings_feedback: body.mappings_feedback,
      general_comments: body.general_comments,
      approved: body.approved,
    };

    // Validate feedback data
    if (!feedback.reviewer_id || typeof feedback.overall_accuracy !== 'number') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_FEEDBACK', 
            message: 'Invalid feedback data provided' 
          } 
        },
        { status: 400 }
      );
    }

    if (feedback.overall_accuracy < 0 || feedback.overall_accuracy > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_ACCURACY', 
            message: 'Overall accuracy must be between 0 and 100' 
          } 
        },
        { status: 400 }
      );
    }

    const _result = await documentAnalysisService.submitReview(tenantId, analysisId, feedback);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    // Log the review submission for audit trail
    console.log(`Human review submitted for analysis ${analysisId} by ${feedback.reviewer_id}`, {
      analysisId,
      reviewerId: feedback.reviewer_id,
      overallAccuracy: feedback.overall_accuracy,
      approved: feedback.approved,
      findingsCount: feedback.findings_feedback.length,
      mappingsCount: feedback.mappings_feedback.length,
      timestamp: new Date().toISOString(),
    });

    // Trigger machine learning feedback processing (in a real implementation, this would be async)
    await processMachineLearningFeedback(analysisId, feedback);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'REVIEW_SUBMISSION_ERROR', 
          message: 'Failed to submit review' 
        } 
      },
      { status: 500 }
    );
  }
}

// Machine Learning Feedback Processing
async function processMachineLearningFeedback(analysisId: string, feedback: ReviewerFeedback) {
  try {
    // In a real implementation, this would:
    // 1. Extract training data from the feedback
    // 2. Update ML model weights based on accuracy ratings
    // 3. Store feedback patterns for model improvement
    // 4. Adjust confidence thresholds based on human corrections

    const trainingData = {
      analysisId,
      overallAccuracy: feedback.overall_accuracy,
      findingsFeedback: feedback.findings_feedback.map(f => ({
        originalConfidence: f.accuracy_rating,
        humanRating: f.accuracy_rating,
        isRelevant: f.is_relevant,
        correctionsMade: !!(f.corrected_category || f.corrected_finding),
      })),
      mappingsFeedback: feedback.mappings_feedback.map(m => ({
        originalConfidence: m.accuracy_rating,
        humanRating: m.accuracy_rating,
        isCorrect: m.is_correct,
        correctionsMade: !!(m.corrected_status || m.corrected_evidence),
      })),
      approved: feedback.approved,
      timestamp: new Date(),
    };

    // Log training data for ML pipeline
    console.log('ML Training Data Generated:', {
      analysisId,
      trainingDataSize: trainingData.findingsFeedback.length + trainingData.mappingsFeedback.length,
      overallAccuracy: trainingData.overallAccuracy,
      approved: trainingData.approved,
    });

    // In production, this would:
    // - Send data to ML training pipeline
    // - Update model confidence calibration
    // - Adjust NLP extraction algorithms
    // - Improve compliance mapping accuracy

    // Simulate ML model update
    await updateModelWeights(trainingData);
    
  } catch (error) {
    console.error('Error processing ML feedback:', error);
    // Don't fail the review submission if ML processing fails
  }
}

async function updateModelWeights(trainingData: any) {
  // Simulate model weight updates based on human feedback
  const accuracyDelta = trainingData.overallAccuracy - 85; // Assume 85% baseline
  
  if (Math.abs(accuracyDelta) > 10) {
    console.log(`Significant accuracy deviation detected: ${accuracyDelta}%`);
    
    // In production, this would trigger:
    // - Model retraining with corrected examples
    // - Confidence threshold adjustments
    // - Feature weight modifications
    
    // Log model update recommendation
    console.log('ML Model Update Recommended:', {
      analysisId: trainingData.analysisId,
      accuracyDelta,
      recommendedActions: [
        accuracyDelta < -10 ? 'Increase confidence thresholds' : 'Decrease confidence thresholds',
        'Retrain NLP extraction model',
        'Update compliance mapping rules',
      ],
    });
  }

  // Simulate confidence calibration update
  const findingsAccuracy = trainingData.findingsFeedback.reduce((sum: number, f: any) => sum + f.humanRating, 0) / trainingData.findingsFeedback.length;
  const mappingsAccuracy = trainingData.mappingsFeedback.reduce((sum: number, m: any) => sum + m.humanRating, 0) / trainingData.mappingsFeedback.length;

  console.log('Confidence Calibration Update:', {
    findingsAccuracy: findingsAccuracy.toFixed(1),
    mappingsAccuracy: mappingsAccuracy.toFixed(1),
    overallAccuracy: trainingData.overallAccuracy,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    const _tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const _result = await documentAnalysisService.getAnalysis(tenantId, analysisId);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    // Return only the review-related information
    const reviewInfo = {
      id: result.data!.id,
      status: result.data!.status,
      confidence_score: result.data!.confidence_score,
      human_reviewed: result.data!.human_reviewed,
      reviewer_feedback: result.data!.reviewer_feedback,
      reviewed_at: result.data!.reviewed_at,
      key_findings_count: result.data!.key_findings.length,
      compliance_mappings_count: result.data!.compliance_mappings.length,
    };

    return NextResponse.json({
      success: true,
      data: reviewInfo,
    });
  } catch (error) {
    console.error('Error fetching review info:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'REVIEW_FETCH_ERROR', 
          message: 'Failed to fetch review information' 
        } 
      },
      { status: 500 }
    );
  }
}