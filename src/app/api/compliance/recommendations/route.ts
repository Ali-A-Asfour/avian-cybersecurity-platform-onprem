import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _tenantId = searchParams.get('tenant_id') || 'dev-tenant-123';
    const frameworkId = searchParams.get('framework_id') || undefined;

    const _result = await complianceService.generateComplianceRecommendations(tenantId, frameworkId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating compliance recommendations:', error);
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