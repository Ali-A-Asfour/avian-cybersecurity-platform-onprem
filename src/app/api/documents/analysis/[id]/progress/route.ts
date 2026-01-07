import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';

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

    const _result = await documentAnalysisService.getAnalysisProgress(tenantId, analysisId);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    // Add additional progress information for human review workflow
    const progressData = {
      ...result.data,
      workflow_stage: determineWorkflowStage(result.data!.status),
      next_actions: getNextActions(result.data!.status),
      estimated_review_time: estimateReviewTime(result.data!),
    };

    return NextResponse.json({
      success: true,
      data: progressData,
    });
  } catch (error) {
    console.error('Error fetching analysis progress:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'PROGRESS_FETCH_ERROR', 
          message: 'Failed to fetch analysis progress' 
        } 
      },
      { status: 500 }
    );
  }
}

function determineWorkflowStage(status: string): string {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'processing':
      return 'ai_analysis';
    case 'completed':
      return 'ready_for_use';
    case 'human_review_required':
      return 'awaiting_human_review';
    case 'failed':
      return 'error_state';
    default:
      return 'unknown';
  }
}

function getNextActions(status: string): string[] {
  switch (status) {
    case 'pending':
      return ['Wait for processing to begin'];
    case 'processing':
      return ['AI analysis in progress', 'Monitor for completion'];
    case 'completed':
      return ['Review results', 'Use for compliance reporting'];
    case 'human_review_required':
      return ['Assign to reviewer', 'Conduct human review', 'Provide feedback'];
    case 'failed':
      return ['Check error details', 'Retry analysis', 'Contact support'];
    default:
      return ['Check status'];
  }
}

function estimateReviewTime(progress: any): number {
  // Estimate review time in minutes based on analysis complexity
  const baseTime = 15; // Base 15 minutes for any review
  
  // Add time based on content complexity (simulated)
  let complexityMultiplier = 1;
  
  if (progress.progress_percentage > 80) {
    // High confidence analysis might need less review time
    complexityMultiplier = 0.7;
  } else if (progress.progress_percentage < 60) {
    // Low confidence analysis needs more thorough review
    complexityMultiplier = 1.5;
  }
  
  return Math.round(baseTime * complexityMultiplier);
}