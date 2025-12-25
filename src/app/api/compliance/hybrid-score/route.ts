import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _tenantId = searchParams.get('tenant_id') || 'dev-tenant-123';
    const frameworkId = searchParams.get('framework_id') || undefined;

    const _result = await complianceService.calculateHybridComplianceScore(tenantId, frameworkId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    console.error('Error calculating hybrid compliance score:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, framework_id } = body;

    // Trigger automated assessment and recalculate scores
    const assessmentResult = await complianceService.triggerAutomatedAssessment(tenant_id, framework_id);
    
    if (!assessmentResult.success) {
      return NextResponse.json(assessmentResult, { status: 400 });
    }

    // Get updated scores
    const scoreResult = await complianceService.calculateHybridComplianceScore(tenant_id, framework_id);
    
    return NextResponse.json({
      success: true,
      data: {
        assessment: assessmentResult.data,
        updated_score: scoreResult.data
      }
    });
  } catch {
    console.error('Error triggering compliance assessment:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}