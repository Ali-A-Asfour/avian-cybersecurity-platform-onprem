import { NextRequest, NextResponse } from 'next/server';
import { demoTenantStore } from '../../../../../lib/demo-tenant-store';

export async function GET(request: NextRequest) {
  try {
    // Get all tenants from demo store
    const allTenants = demoTenantStore.getAllTenants();
    
    // Calculate real metrics
    const totalTenants = allTenants.length;
    const activeTenants = allTenants.filter(t => t.is_active).length;
    const inactiveTenants = totalTenants - activeTenants;
    
    // Calculate storage metrics
    const totalStorageUsed = demoTenantStore.getTotalStorage();
    const avgStoragePerTenant = totalTenants > 0 ? totalStorageUsed / totalTenants : 0;
    
    // Calculate user metrics
    const avgUsersPerTenant = demoTenantStore.getAverageUsers();
    
    // Calculate tenant distribution by plan
    const tenantsByPlan = allTenants.reduce((acc, tenant) => {
      const plan = tenant.settings?.subscription_tier || 'Enterprise';
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Recent activity (mock data based on tenants)
    const recentActivity = allTenants.slice(0, 5).map(tenant => ({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      last_activity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random within last week
      user_count: Math.floor(Math.random() * (tenant.settings?.max_users || 100) * 0.8),
      storage_used: Math.floor(Math.random() * 1000 * 1024 * 1024), // Random storage in bytes
    }));

    const metrics = {
      totalTenants,
      activeTenants,
      inactiveTenants,
      avgUsersPerTenant: Math.round(avgUsersPerTenant * 10) / 10, // Round to 1 decimal
      totalStorageUsed,
      avgStoragePerTenant: Math.round(avgStoragePerTenant),
      tenantsByPlan,
      recentActivity,
    };

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Failed to calculate tenant metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to calculate tenant metrics' 
      },
      { status: 500 }
    );
  }
}