import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, extract tenant ID from JWT token
    const _tenantId = 'dev-tenant-123';

    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get('framework_id') || undefined;

    const _result = await complianceService.calculateComplianceScore(tenantId, frameworkId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calculating compliance score:', error);
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