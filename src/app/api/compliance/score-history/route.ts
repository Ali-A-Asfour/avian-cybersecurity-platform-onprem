import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _tenantId = searchParams.get('tenant_id') || 'dev-tenant-123';
    const frameworkId = searchParams.get('framework_id') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');

    const _result = await complianceService.getComplianceScoreHistory(tenantId, frameworkId, limit);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    console.error('Error fetching compliance score history:', error);
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