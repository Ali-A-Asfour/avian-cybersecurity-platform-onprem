import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../../lib/auth';
import { UserRole } from '../../../../../types';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and authorize
    const authResult = await AuthService.authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only super admins can access tenant metrics
    if (authResult.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // In a real implementation, these would be calculated from actual tenant data
    // For now, return mock data that represents realistic tenant metrics
    const metrics = {
      avgUsersPerTenant: 15.7,
      totalStorageUsed: 2147483648, // 2GB in bytes
      avgStoragePerTenant: 134217728, // 128MB in bytes
      tenantsByPlan: {
        basic: 12,
        professional: 8,
        enterprise: 3,
      },
      recentActivity: [
        {
          tenant_id: 'tenant_1',
          tenant_name: 'Acme Corporation',
          last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          user_count: 25,
          storage_used: 268435456, // 256MB
        },
        {
          tenant_id: 'tenant_2',
          tenant_name: 'TechStart Inc',
          last_activity: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          user_count: 12,
          storage_used: 134217728, // 128MB
        },
        {
          tenant_id: 'tenant_3',
          tenant_name: 'Global Security',
          last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          user_count: 45,
          storage_used: 536870912, // 512MB
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch {
    console.error('Tenant metrics error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch tenant metrics' 
        } 
      },
      { status: 500 }
    );
  }
}