import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock API keys storage (shared with parent route)
const apiKeysStore = new Map<string, any[]>();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
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
    const keysKey = tenant!.id;
    const { keyId } = params;

    const keys = apiKeysStore.get(keysKey) || [];
    const filteredKeys = keys.filter(key => key.id !== keyId);
    apiKeysStore.set(keysKey, filteredKeys);

    return NextResponse.json({
      success: true,
      data: {
        message: 'API key deleted successfully',
      },
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELETE_API_KEY_ERROR',
          message: 'Failed to delete API key',
        },
      },
      { status: 500 }
    );
  }
}
