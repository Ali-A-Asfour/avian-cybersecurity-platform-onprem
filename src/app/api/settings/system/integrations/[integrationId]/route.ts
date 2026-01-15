import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock integrations storage (shared with parent route)
const integrationsStore = new Map<string, any[]>();

export async function PUT(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
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
    const body = await request.json();
    const integrationsKey = tenant!.id;
    const { integrationId } = params;

    const integrations = integrationsStore.get(integrationsKey) || [];
    const updatedIntegrations = integrations.map(int =>
      int.id === integrationId
        ? { ...int, enabled: body.enabled, status: body.enabled ? 'connected' : 'disconnected' }
        : int
    );
    integrationsStore.set(integrationsKey, updatedIntegrations);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Integration updated successfully',
      },
    });
  } catch (error) {
    console.error('Error updating integration:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_INTEGRATION_ERROR',
          message: 'Failed to update integration',
        },
      },
      { status: 500 }
    );
  }
}
