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
    const includeMLMetrics = searchParams.get('include_ml_metrics') === 'true';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const _result = await documentAnalysisService.getReviewStatistics(tenantId);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    let statistics = result.data!;

    // Filter by date range if provided
    if (startDate || endDate) {
      // In a real implementation, this would filter the underlying data
      // For now, we'll just add metadata about the date range
      statistics = {
        ...statistics,
        date_range: {
          start: startDate,
          end: endDate,
        },
      } as any;
    }

    // Add additional ML improvement insights
    if (includeMLMetrics) {
      const mlInsights = generateMLInsights(statistics);
      statistics = {
        ...statistics,
        ml_insights: mlInsights,
      } as any;
    }

    return NextResponse.json({
      success: true,
      data: statistics,
      meta: {
        generated_at: new Date().toISOString(),
        tenant_id: tenantId,
        includes_ml_metrics: includeMLMetrics,
      },
    });
  } catch {
    console.error('Error fetching review statistics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'STATISTICS_ERROR', 
          message: 'Failed to fetch review statistics' 
        } 
      },
      { status: 500 }
    );
  }
}

function generateMLInsights(statistics: any) {
  const insights = [];

  // Confidence calibration insights
  if (statistics.ml_model_performance.confidence_calibration_error > 0.1) {
    insights.push({
      type: 'confidence_calibration',
      severity: 'medium',
      message: 'Model confidence calibration needs improvement',
      recommendation: 'Increase human review samples for better confidence estimation',
      impact: 'Medium impact on review efficiency',
    });
  }

  // Accuracy improvement insights
  if (statistics.accuracy_improvement > 5) {
    insights.push({
      type: 'accuracy_improvement',
      severity: 'low',
      message: 'Human reviews are significantly improving accuracy',
      recommendation: 'Continue current review process and consider model retraining',
      impact: 'Positive impact on overall system accuracy',
    });
  } else if (statistics.accuracy_improvement < -2) {
    insights.push({
      type: 'accuracy_decline',
      severity: 'high',
      message: 'Human reviews indicate declining model performance',
      recommendation: 'Immediate model retraining recommended',
      impact: 'High impact on system reliability',
    });
  }

  // Review volume insights
  const reviewRate = statistics.reviewed_analyses / statistics.total_analyses;
  if (reviewRate < 0.3) {
    insights.push({
      type: 'low_review_rate',
      severity: 'medium',
      message: 'Low human review rate may impact ML improvement',
      recommendation: 'Consider increasing review coverage for better model training',
      impact: 'Medium impact on ML model improvement',
    });
  }

  // Common correction patterns
  if (statistics.common_correction_categories.length > 0) {
    const topCategory = statistics.common_correction_categories[0];
    if (topCategory.frequency > 5) {
      insights.push({
        type: 'correction_pattern',
        severity: 'medium',
        message: `Frequent corrections in ${topCategory.category}`,
        recommendation: `Focus model improvement on ${topCategory.category} detection`,
        impact: 'Targeted improvement opportunity',
      });
    }
  }

  // Model performance insights
  const f1Score = statistics.ml_model_performance.f1_score;
  if (f1Score < 0.8) {
    insights.push({
      type: 'model_performance',
      severity: 'high',
      message: 'Model F1 score below acceptable threshold',
      recommendation: 'Model retraining with additional data recommended',
      impact: 'High impact on analysis quality',
    });
  } else if (f1Score > 0.9) {
    insights.push({
      type: 'model_performance',
      severity: 'low',
      message: 'Excellent model performance detected',
      recommendation: 'Consider reducing human review requirements for high-confidence analyses',
      impact: 'Opportunity for efficiency improvement',
    });
  }

  return insights;
}

// POST endpoint for triggering ML model updates based on review feedback
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
    const { action, parameters } = body;

    if (!action) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_ACTION', 
            message: 'Action is required' 
          } 
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'trigger_model_update':
        result = await triggerModelUpdate(tenantId, parameters);
        break;
      
      case 'recalibrate_confidence':
        result = await recalibrateConfidence(tenantId, parameters);
        break;
      
      case 'export_training_data':
        result = await exportTrainingData(tenantId, parameters);
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

    return NextResponse.json(result);
  } catch {
    console.error('Error processing ML action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'ML_ACTION_ERROR', 
          message: 'Failed to process ML action' 
        } 
      },
      { status: 500 }
    );
  }
}

async function triggerModelUpdate(tenantId: string, parameters: any) {
  // In a real implementation, this would:
  // 1. Collect all human feedback data
  // 2. Prepare training dataset
  // 3. Trigger ML pipeline for model retraining
  // 4. Schedule model deployment after validation

  console.log('Triggering model update for tenant:', tenantId, parameters);

  return {
    success: true,
    data: {
      action: 'trigger_model_update',
      status: 'initiated',
      job_id: `model-update-${Date.now()}`,
      estimated_completion: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      training_samples_count: 150, // Simulated
      expected_improvements: [
        'Improved confidence calibration',
        'Better finding categorization',
        'Enhanced compliance mapping accuracy',
      ],
    },
  };
}

async function recalibrateConfidence(tenantId: string, parameters: any) {
  // In a real implementation, this would:
  // 1. Analyze human feedback vs. AI confidence scores
  // 2. Adjust confidence thresholds
  // 3. Update confidence calibration model

  console.log('Recalibrating confidence for tenant:', tenantId, parameters);

  return {
    success: true,
    data: {
      action: 'recalibrate_confidence',
      status: 'completed',
      calibration_improvements: {
        before_error: 0.12,
        after_error: 0.08,
        improvement_percentage: 33.3,
      },
      threshold_adjustments: {
        high_confidence: 85, // Adjusted from 90
        medium_confidence: 70, // Adjusted from 75
        low_confidence: 50, // Adjusted from 60
      },
    },
  };
}

async function exportTrainingData(tenantId: string, parameters: any) {
  // In a real implementation, this would:
  // 1. Collect human feedback data
  // 2. Format for ML training pipeline
  // 3. Export to training data store

  console.log('Exporting training data for tenant:', tenantId, parameters);

  return {
    success: true,
    data: {
      action: 'export_training_data',
      status: 'completed',
      export_summary: {
        total_samples: 245,
        positive_samples: 189,
        negative_samples: 56,
        export_format: 'jsonl',
        file_size_mb: 12.5,
        export_path: `/exports/training-data-${tenantId}-${Date.now()}.jsonl`,
      },
    },
  };
}