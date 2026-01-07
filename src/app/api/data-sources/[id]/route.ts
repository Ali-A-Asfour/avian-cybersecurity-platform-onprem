import { NextRequest, NextResponse } from 'next/server';
import { dataIngestionService } from '@/services/data-ingestion.service';
import { createEDRConnector } from '@/lib/connectors/edr-connector';
import { createFirewallConnector } from '@/lib/connectors/firewall-connector';
import { syslogServerManager } from '@/lib/syslog-server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { validateRequest } from '@/lib/validation';
import { z } from 'zod';

const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  connection_config: z.object({
    endpoint: z.string().url().optional(),
    api_key: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    certificate: z.string().optional(),
    port: z.number().min(1).max(65535).optional(),
    use_tls: z.boolean().optional(),
    polling_interval: z.number().min(1000).optional(),
    custom_headers: z.record(z.string()).optional()
  }).optional(),
  status: z.enum(['active', 'inactive', 'error', 'connecting']).optional()
});

export async function GET(
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

    const dataSource = await dataIngestionService.getDataSource(params.id, tenantResult.tenant.id);
    if (!dataSource) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(dataSource);
  } catch (error) {
    logger.error('Failed to get data source', { error, id: params.id });
    return NextResponse.json(
      { error: 'Failed to get data source' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Only admins can update data sources
    if (!['super_admin', 'tenant_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = validateRequest(updateDataSourceSchema, body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.errors },
        { status: 400 }
      );
    }

    const dataSource = await dataIngestionService.updateDataSource(
      params.id,
      tenantResult.tenant.id,
      validationResult.data
    );

    if (!dataSource) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    // Restart connector if configuration changed
    if (validationResult.data.connection_config) {
      try {
        // Stop existing connector
        dataIngestionService.unregisterConnector(params.id);
        
        if (dataSource.type === 'syslog') {
          await syslogServerManager.stopServer(params.id);
        }

        // Start new connector with updated config
        if (dataSource.type !== 'syslog') {
          let connector;
          if (dataSource.type.startsWith('edr_')) {
            connector = createEDRConnector(dataSource);
          } else if (dataSource.type.startsWith('firewall_')) {
            connector = createFirewallConnector(dataSource);
          }

          if (connector) {
            await connector.start();
            dataIngestionService.registerConnector(dataSource.id, connector);
          }
        } else {
          const port = dataSource.connection_config.port || 514;
          const protocol = dataSource.connection_config.use_tls ? 'tls' : 'udp';
          
          const tenantMapping = new Map();
          tenantMapping.set('*', tenantResult.tenant.id);
          
          await syslogServerManager.createServer(dataSource.id, {
            port,
            protocol: protocol as 'udp' | 'tcp' | 'tls',
            tenantMapping
          });
        }

        await dataIngestionService.updateDataSource(params.id, tenantResult.tenant.id, {
          status: 'active'
        });
      } catch (connectorError) {
        logger.error('Failed to restart connector', { 
          error: connectorError, 
          dataSourceId: params.id 
        });
        
        await dataIngestionService.updateDataSource(params.id, tenantResult.tenant.id, {
          status: 'error'
        });
      }
    }

    return NextResponse.json(dataSource);
  } catch (error) {
    logger.error('Failed to update data source', { error, id: params.id });
    return NextResponse.json(
      { error: 'Failed to update data source' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Only admins can delete data sources
    if (!['super_admin', 'tenant_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const success = await dataIngestionService.deleteDataSource(params.id, tenantResult.tenant.id);
    if (!success) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    // Stop syslog server if it exists
    await syslogServerManager.stopServer(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete data source', { error, id: params.id });
    return NextResponse.json(
      { error: 'Failed to delete data source' },
      { status: 500 }
    );
  }
}