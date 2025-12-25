import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock tenant data for demonstration
    const mockTenants = [
      {
        id: 'tenant-techcorp',
        name: 'TechCorp Inc.',
        industry: 'Technology',
        size: 'Large Enterprise',
        status: 'active',
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        data_sources_count: 3,
        users_count: 45,
        events_today: 263000,
        location: 'New York, NY',
        subscription_tier: 'Enterprise'
      },
      {
        id: 'tenant-medhealth',
        name: 'MedHealth Systems',
        industry: 'Healthcare',
        size: 'Medium Enterprise',
        status: 'active',
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        data_sources_count: 2,
        users_count: 28,
        events_today: 91070,
        location: 'Chicago, IL',
        subscription_tier: 'Professional'
      },
      {
        id: 'tenant-startupco',
        name: 'StartupCo Ltd.',
        industry: 'Technology',
        size: 'Small Business',
        status: 'active',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        data_sources_count: 2,
        users_count: 8,
        events_today: 17760,
        location: 'Austin, TX',
        subscription_tier: 'Starter'
      },
      {
        id: 'tenant-globalbank',
        name: 'GlobalBank Corp.',
        industry: 'Financial Services',
        size: 'Large Enterprise',
        status: 'active',
        created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
        data_sources_count: 3,
        users_count: 156,
        events_today: 836570,
        location: 'London, UK',
        subscription_tier: 'Enterprise Plus'
      },
      {
        id: 'tenant-retailchain',
        name: 'RetailChain Stores',
        industry: 'Retail',
        size: 'Medium Enterprise',
        status: 'active',
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        data_sources_count: 2,
        users_count: 34,
        events_today: 78920,
        location: 'Phoenix, AZ',
        subscription_tier: 'Professional'
      },
      {
        id: 'tenant-manufacturing',
        name: 'ManufacturingCorp',
        industry: 'Manufacturing',
        size: 'Large Enterprise',
        status: 'active',
        created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
        data_sources_count: 2,
        users_count: 67,
        events_today: 53310,
        location: 'Detroit, MI',
        subscription_tier: 'Enterprise'
      },
      {
        id: 'tenant-edutech',
        name: 'EduTech University',
        industry: 'Education',
        size: 'Large Organization',
        status: 'active',
        created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        data_sources_count: 2,
        users_count: 23,
        events_today: 58560,
        location: 'Boston, MA',
        subscription_tier: 'Education'
      }
    ];

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