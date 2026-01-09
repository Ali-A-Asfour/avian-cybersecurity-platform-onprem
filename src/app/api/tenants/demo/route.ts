import { NextRequest, NextResponse } from 'next/server';
import { demoTenantStore } from '../../../../lib/demo-tenant-store';

export async function GET(request: NextRequest) {
  try {
    // Get tenants from demo store instead of hardcoded data
    const allTenants = demoTenantStore.getAllTenants();
    
    // Convert to the format expected by the demo API
    const mockTenants = allTenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      industry: 'Technology',
      size: 'Large Enterprise',
      status: tenant.is_active ? 'active' : 'inactive',
      created_at: tenant.created_at.toISOString(),
      data_sources_count: Math.floor(Math.random() * 10) + 1,
      users_count: Math.floor(Math.random() * 100) + 10,
      events_today: Math.floor(Math.random() * 500000) + 50000,
      location: 'Various Locations',
      subscription_tier: 'Enterprise'
    }));

    return NextResponse.json({
      success: true,
      tenants: mockTenants,
      total: mockTenants.length
    });
  } catch (error) {
    console.error('Failed to fetch demo tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch demo tenants' },
      { status: 500 }
    );
  }
}