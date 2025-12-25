import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';

export async function GET(request: NextRequest) {
  try {
    const _tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sort_by') || 'analyzed_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const frameworkId = searchParams.get('framework_id');
    const analysisType = searchParams.get('analysis_type');
    const confidenceThreshold = searchParams.get('confidence_threshold');

    const _result = await documentAnalysisService.getPendingReviews(tenantId);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    let pendingReviews = result.data || [];

    // Apply filters
    if (frameworkId) {
      pendingReviews = pendingReviews.filter(analysis => analysis.framework_id === frameworkId);
    }

    if (analysisType) {
      pendingReviews = pendingReviews.filter(analysis => analysis.analysis_type === analysisType);
    }

    if (confidenceThreshold) {
      const threshold = parseInt(confidenceThreshold);
      pendingReviews = pendingReviews.filter(analysis => analysis.confidence_score <= threshold);
    }

    // Apply sorting
    pendingReviews.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'confidence_score':
          aValue = a.confidence_score;
          bValue = b.confidence_score;
          break;
        case 'analyzed_at':
          aValue = new Date(a.analyzed_at).getTime();
          bValue = new Date(b.analyzed_at).getTime();
          break;
        case 'analysis_type':
          aValue = a.analysis_type;
          bValue = b.analysis_type;
          break;
        default:
          aValue = new Date(a.analyzed_at).getTime();
          bValue = new Date(b.analyzed_at).getTime();
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const total = pendingReviews.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedReviews = pendingReviews.slice(startIndex, endIndex);

    // Add priority scoring for review queue management
    const reviewsWithPriority = paginatedReviews.map(analysis => {
      const priority = calculateReviewPriority(analysis);
      return {
        ...analysis,
        review_priority: priority,
      };
    });

    return NextResponse.json({
      success: true,
      data: reviewsWithPriority,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: endIndex < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'PENDING_REVIEWS_ERROR', 
          message: 'Failed to fetch pending reviews' 
        } 
      },
      { status: 500 }
    );
  }
}

function calculateReviewPriority(analysis: any): { score: number; factors: string[] } {
  let score = 0;
  const factors: string[] = [];

  // Low confidence scores need higher priority review
  if (analysis.confidence_score < 60) {
    score += 30;
    factors.push('Low confidence score');
  } else if (analysis.confidence_score < 75) {
    score += 15;
    factors.push('Medium confidence score');
  }

  // Age of analysis (older analyses get higher priority)
  const daysSinceAnalysis = Math.floor(
    (Date.now() - new Date(analysis.analyzed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceAnalysis > 7) {
    score += 25;
    factors.push('Analysis over 7 days old');
  } else if (daysSinceAnalysis > 3) {
    score += 15;
    factors.push('Analysis over 3 days old');
  } else if (daysSinceAnalysis > 1) {
    score += 5;
    factors.push('Analysis over 1 day old');
  }

  // Critical compliance frameworks get higher priority
  const criticalFrameworks = ['hipaa', 'pci', 'sox'];
  if (analysis.framework_id && criticalFrameworks.some(fw => 
    analysis.framework_id.toLowerCase().includes(fw)
  )) {
    score += 20;
    factors.push('Critical compliance framework');
  }

  // High number of findings or mappings may indicate complex analysis
  const totalItems = analysis.key_findings.length + analysis.compliance_mappings.length;
  if (totalItems > 20) {
    score += 15;
    factors.push('Complex analysis with many findings');
  } else if (totalItems > 10) {
    score += 10;
    factors.push('Moderate complexity analysis');
  }

  // Security-related documents get higher priority
  const securityTypes = ['security_policy', 'incident_response_plan'];
  if (securityTypes.includes(analysis.analysis_type)) {
    score += 10;
    factors.push('Security-related document');
  }

  return { score, factors };
}

// POST endpoint for bulk review operations
export async function POST(request: NextRequest) {
  try {
    const _tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, analysis_ids, reviewer_id } = body;

    if (!action || !analysis_ids || !Array.isArray(analysis_ids)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_REQUEST', 
            message: 'Action and analysis_ids array are required' 
          } 
        },
        { status: 400 }
      );
    }

    const results = [];

    switch (action) {
      case 'assign_reviewer':
        if (!reviewer_id) {
          return NextResponse.json(
            { 
              success: false, 
              error: { 
                code: 'MISSING_REVIEWER', 
                message: 'Reviewer ID is required for assignment' 
              } 
            },
            { status: 400 }
          );
        }

        // In a real implementation, this would update the database
        // to assign analyses to specific reviewers
        for (const analysisId of analysis_ids) {
          results.push({
            analysis_id: analysisId,
            action: 'assigned',
            reviewer_id,
            assigned_at: new Date(),
          });
        }
        break;

      case 'mark_priority':
        // Mark analyses as high priority for review
        for (const analysisId of analysis_ids) {
          results.push({
            analysis_id: analysisId,
            action: 'priority_marked',
            marked_at: new Date(),
          });
        }
        break;

      case 'bulk_approve':
        // Bulk approve analyses (with caution - should have additional validation)
        if (!reviewer_id) {
          return NextResponse.json(
            { 
              success: false, 
              error: { 
                code: 'MISSING_REVIEWER', 
                message: 'Reviewer ID is required for bulk approval' 
              } 
            },
            { status: 400 }
          );
        }

        for (const analysisId of analysis_ids) {
          // This would typically require additional validation
          // and should only be used for high-confidence analyses
          results.push({
            analysis_id: analysisId,
            action: 'bulk_approved',
            reviewer_id,
            approved_at: new Date(),
          });
        }
        break;

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'INVALID_ACTION', 
              message: 'Invalid action specified' 
            } 
          },
          { status: 400 }
        );
    }

    // Log bulk operation for audit trail
    console.log(`Bulk review operation performed`, {
      action,
      analysisCount: analysis_ids.length,
      reviewerId: reviewer_id,
      tenantId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        action,
        processed_count: results.length,
        results,
      },
    });
  } catch (error) {
    console.error('Error processing bulk review operation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'BULK_OPERATION_ERROR', 
          message: 'Failed to process bulk review operation' 
        } 
      },
      { status: 500 }
    );
  }
}