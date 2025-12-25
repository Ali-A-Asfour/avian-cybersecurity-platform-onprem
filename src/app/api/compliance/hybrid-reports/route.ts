import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      tenant_id, 
      framework_id, 
      report_type = 'comprehensive',
      format = 'pdf' 
    } = body;

    const _result = await complianceService.generateHybridComplianceReport(
      tenant_id,
      report_type,
      framework_id,
      format
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    console.error('Error generating hybrid compliance report:', error);
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _tenantId = searchParams.get('tenant_id') || 'dev-tenant-123';
    const frameworkId = searchParams.get('framework_id') || undefined;
    const reportType = (searchParams.get('report_type') as 'comprehensive' | 'executive_summary' | 'gap_analysis' | 'trend_analysis') || 'comprehensive';
    const format = (searchParams.get('format') as 'pdf' | 'csv' | 'json') || 'pdf';

    const _result = await complianceService.generateHybridComplianceReport(
      tenantId,
      reportType,
      frameworkId,
      format
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    console.error('Error generating hybrid compliance report:', error);
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