import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock data for ACME Corporation demonstration
    const mockDataSources = [
      // ACME Corporation - Large Enterprise
      {
        id: 'acme-edr-crowdstrike-01',
        name: 'ACME - CrowdStrike EDR Primary',
        type: 'edr_crowdstrike',
        status: 'active',
        company: 'ACME Corporation',
        location: 'San Francisco HQ',
        last_heartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        events_processed: 45230,
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'acme-firewall-fortinet-01',
        name: 'ACME - Fortinet FortiGate Cluster',
        type: 'firewall_fortinet',
        status: 'active',
        company: 'ACME Corporation',
        location: 'San Francisco HQ',
        last_heartbeat: new Date(Date.now() - 30 * 1000).toISOString(),
        events_processed: 128450,
        created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'acme-siem-qradar-01',
        name: 'ACME - IBM QRadar SIEM',
        type: 'siem_qradar',
        status: 'active',
        company: 'ACME Corporation',
        location: 'San Francisco HQ',
        last_heartbeat: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        events_processed: 89320,
        created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'acme-edr-sentinelone-01',
        name: 'ACME - SentinelOne EDR',
        type: 'edr_sentinelone',
        status: 'active',
        company: 'ACME Corporation',
        location: 'San Francisco Branch',
        last_heartbeat: new Date(Date.now() - 45 * 1000).toISOString(),
        events_processed: 23100,
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'acme-firewall-cisco-01',
        name: 'ACME - Cisco ASA Firewall',
        type: 'firewall_cisco',
        status: 'active',
        company: 'ACME Corporation',
        location: 'San Francisco Branch',
        last_heartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        events_processed: 67890,
        created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'acme-email-o365-01',
        name: 'ACME - Office 365 Email Security',
        type: 'email_o365',
        status: 'active',
        company: 'ACME Corporation',
        location: 'Cloud',
        last_heartbeat: new Date(Date.now() - 15 * 1000).toISOString(),
        events_processed: 34567,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return NextResponse.json({
      success: true,
      data: mockDataSources,
      total: mockDataSources.length
    });
  } catch (error) {
    console.error('Failed to fetch demo data sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch demo data sources' },
      { status: 500 }
    );
  }
}