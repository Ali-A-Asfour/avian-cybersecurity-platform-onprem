import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock alerts data for demonstration
    const alerts = [
      {
        id: 'alert-1',
        title: 'High Error Rate Detected',
        description: 'Data source "Firewall-01" showing 15% error rate',
        severity: 'high',
        source_id: 'firewall-01',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        id: 'alert-2',
        title: 'Connection Timeout',
        description: 'EDR connector experiencing connection timeouts',
        severity: 'medium',
        source_id: 'edr-avast-01',
        created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
      }
    ];

    return NextResponse.json({
      success: true,
      alerts
    });
  } catch (error) {
    console.error('Failed to fetch data source alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}