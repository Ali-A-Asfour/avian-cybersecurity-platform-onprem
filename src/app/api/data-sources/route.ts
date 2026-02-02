import { NextRequest, NextResponse } from 'next/server';
import { dataIngestionService } from '@/services/data-ingestion.service';
import { createEDRConnector } from '@/lib/connectors/edr-connector';
import { createFirewallConnector } from '@/lib/connectors/firewall-connector';
import { syslogServerManager } from '@/lib/syslog-server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { logger } from '@/lib/logger';
import { validateRequest } from '@/lib/validation';
import { z } from 'zod';

const createDataSourceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'edr_avast',
    'edr_crowdstrike', 
    'edr_sentinelone',
    'edr_generic',
    'firewall_pfsense',
    'firewall_fortinet',
    'firewall_cisco',
    'siem_splunk',
    'siem_qradar',
    'syslog'
  ]),
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
  })
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    const dataSources = await dataIngestionService.getDataSources(tenantResult.tenant.id);

    return NextResponse.json({
      data_sources: dataSources,
      total: dataSources.length
    });
  } catch (error) {
    logger.error('Failed to get data sources', { error });
    return NextResponse.json(
      { error: 'Failed to get data sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    // Only admins can create data sources
    if (!['super_admin', 'tenant_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = validateRequest(createDataSourceSchema, body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.errors },
        { status: 400 }
      );
    }

    const { name, type, connection_config } = validationResult.data;

    const dataSource = await dataIngestionService.createDataSource({
      tenant_id: tenantResult.tenant.id,
      name,
      type,
      connection_config,
      status: 'inactive',
      last_heartbeat: new Date(),
      events_processed: 0
    });

    // Start connector if it's not syslog
    if (type !== 'syslog') {
      try {
        let connector;
        if (type.startsWith('edr_')) {
          connector = createEDRConnector(dataSource);
        } else if (type.startsWith('firewall_')) {
          connector = createFirewallConnector(dataSource);
        }

        if (connector) {
          await connector.start();
          dataIngestionService.registerConnector(dataSource.id, connector);
          
          // Update status to active
          await dataIngestionService.updateDataSource(dataSource.id, tenantResult.tenant.id, {
            status: 'active'
          });
        }
      } catch (connectorError) {
        logger.error('Failed to start connector', { 
          error: connectorError, 
          dataSourceId: dataSource.id 
        });
        
        await dataIngestionService.updateDataSource(dataSource.id, tenantResult.tenant.id, {
          status: 'error'
        });
      }
    } else {
      // For syslog, create a syslog server if needed
      try {
        const port = connection_config.port || 514;
        const protocol = connection_config.use_tls ? 'tls' : 'udp';
        
        const tenantMapping = new Map();
        tenantMapping.set('*', tenantResult.tenant.id); // Map all to this tenant for now
        
        await syslogServerManager.createServer(dataSource.id, {
          port,
          protocol: protocol as 'udp' | 'tcp' | 'tls',
          tenantMapping
        });

        await dataIngestionService.updateDataSource(dataSource.id, tenantResult.tenant.id, {
          status: 'active'
        });
      } catch (syslogError) {
        logger.error('Failed to start syslog server', { 
          error: syslogError, 
          dataSourceId: dataSource.id 
        });
        
        await dataIngestionService.updateDataSource(dataSource.id, tenantResult.tenant.id, {
          status: 'error'
        });
      }
    }

    return NextResponse.json(dataSource, { status: 201 });
  } catch (error) {
    logger.error('Failed to create data source', { error });
    return NextResponse.json(
      { error: 'Failed to create data source' },
      { status: 500 }
    );
  }
}