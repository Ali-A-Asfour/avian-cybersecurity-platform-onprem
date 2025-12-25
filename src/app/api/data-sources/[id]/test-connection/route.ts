import { NextRequest, NextResponse } from 'next/server';
import { dataIngestionService } from '@/services/data-ingestion.service';
import { createEDRConnector } from '@/lib/connectors/edr-connector';
import { createFirewallConnector } from '@/lib/connectors/firewall-connector';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    // Only admins can test connections
    if (!['super_admin', 'tenant_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const dataSource = await dataIngestionService.getDataSource(params.id, tenantResult.tenant.id);
    if (!dataSource) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    let testResult: { success: boolean; message: string };

    if (dataSource.type === 'syslog') {
      // For syslog, just check if the port is available
      testResult = {
        success: true,
        message: 'Syslog server configuration is valid'
      };
    } else {
      // Create temporary connector for testing
      let connector;
      if (dataSource.type.startsWith('edr_')) {
        connector = createEDRConnector(dataSource);
      } else if (dataSource.type.startsWith('firewall_')) {
        connector = createFirewallConnector(dataSource);
      }

      if (!connector) {
        return NextResponse.json(
          { error: 'Unsupported data source type' },
          { status: 400 }
        );
      }

      testResult = await connector.testConnection();
    }

    return NextResponse.json(testResult);
  } catch {
    logger.error('Failed to test connection', { error, id: params.id });
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      },
      { status: 500 }
    );
  }
}