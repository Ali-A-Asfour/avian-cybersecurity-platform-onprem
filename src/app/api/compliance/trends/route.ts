import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _tenantId = searchParams.get('tenant_id') || 'dev-tenant-123';
    const frameworkId = searchParams.get('framework_id') || undefined;
    const period = (searchParams.get('period') as 'daily' | 'weekly' | 'monthly' | 'quarterly') || 'weekly';

    const _result = await complianceService.getComplianceTrends(tenantId, frameworkId, period);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching compliance trends:', error);
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