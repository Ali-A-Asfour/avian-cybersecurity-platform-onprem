import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock integrations storage
const integrationsStore = new Map<string, any[]>();

function getDefaultIntegrations() {
  return [
    {
      id: 'int_microsoft',
      name: 'Microsoft 365',
      type: 'Identity Provider',
      enabled: true,
      status: 'connected' as const,
      lastSync: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'int_slack',
      name: 'Slack',
      type: 'Notifications',
      enabled: false,
      status: 'disconnected' as const,
      lastSync: null,
    },
    {
      id: 'int_jira',
      name: 'Jira',
      type: 'Ticketing',
      enabled: true,
      status: 'connected' as const,
      lastSync: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'int_splunk',
      name: 'Splunk',
      type: 'SIEM',
      enabled: false,
      status: 'disconnected' as const,
      lastSync: null,
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: authResult.error || 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: tenantResult.error || {
            code: 'TENANT_ERROR',
            message: 'Failed to process tenant context',
          },
        },
        { status: 500 }
      );
    }

    const { tenant } = tenantResult;
    const integrationsKey = tenant!.id;
    
    let integrations = integrationsStore.get(integrationsKey);
    if (!integrations) {
      integrations = getDefaultIntegrations();
      integrationsStore.set(integrationsKey, integrations);
    }

    return NextResponse.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_INTEGRATIONS_ERROR',
          message: 'Failed to fetch integrations',
        },
      },
      { status: 500 }
    );
  }
}
