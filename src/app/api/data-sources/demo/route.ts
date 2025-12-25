import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock data for multiple companies demonstration
    const mockDataSources = [
      // TechCorp Inc. - Large Enterprise
      {
        id: 'techcorp-edr-crowdstrike-01',
        name: 'TechCorp - CrowdStrike EDR Primary',
        type: 'edr_crowdstrike',
        status: 'active',
        company: 'TechCorp Inc.',
        location: 'New York HQ',
        last_heartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        events_processed: 45230,
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'techcorp-firewall-fortinet-01',
        name: 'TechCorp - Fortinet FortiGate Cluster',
        type: 'firewall_fortinet',
        status: 'active',
        company: 'TechCorp Inc.',
        location: 'New York HQ',
        last_heartbeat: new Date(Date.now() - 30 * 1000).toISOString(),
        events_processed: 128450,
        created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'techcorp-siem-qradar-01',
        name: 'TechCorp - IBM QRadar SIEM',
        type: 'siem_qradar',
        status: 'active',
        company: 'TechCorp Inc.',
        location: 'New York HQ',
        last_heartbeat: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        events_processed: 89320,
        created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      },
      
      // MedHealth Systems - Healthcare
      {
        id: 'medhealth-edr-sentinelone-01',
        name: 'MedHealth - SentinelOne EDR',
        type: 'edr_sentinelone',
        status: 'active',
        company: 'MedHealth Systems',
        location: 'Chicago Medical Center',
        last_heartbeat: new Date(Date.now() - 45 * 1000).toISOString(),
        events_processed: 23180,
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'medhealth-firewall-cisco-01',
        name: 'MedHealth - Cisco ASA Firewall',
        type: 'firewall_cisco',
        status: 'active',
        company: 'MedHealth Systems',
        location: 'Chicago Medical Center',
        last_heartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        events_processed: 67890,
        created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      },
      
      // StartupCo - Small Business
      {
        id: 'startupco-edr-avast-01',
        name: 'StartupCo - Avast Business EDR',
        type: 'edr_avast',
        status: 'active',
        company: 'StartupCo Ltd.',
        location: 'Austin Office',
        last_heartbeat: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        events_processed: 5420,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'startupco-firewall-pfsense-01',
        name: 'StartupCo - pfSense Firewall',
        type: 'firewall_pfsense',
        status: 'active',
        company: 'StartupCo Ltd.',
        location: 'Austin Office',
        last_heartbeat: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        events_processed: 12340,
        created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      },
      
      // GlobalBank - Financial Services
      {
        id: 'globalbank-edr-crowdstrike-01',
        name: 'GlobalBank - CrowdStrike Falcon',
        type: 'edr_crowdstrike',
        status: 'active',
        company: 'GlobalBank Corp.',
        location: 'London Trading Floor',
        last_heartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        events_processed: 156780,
        created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'globalbank-siem-splunk-01',
        name: 'GlobalBank - Splunk Enterprise Security',
        type: 'siem_splunk',
        status: 'active',
        company: 'GlobalBank Corp.',
        location: 'London SOC',
        last_heartbeat: new Date(Date.now() - 30 * 1000).toISOString(),
        events_processed: 234560,
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'globalbank-firewall-fortinet-02',
        name: 'GlobalBank - Fortinet Perimeter Defense',
        type: 'firewall_fortinet',
        status: 'warning',
        company: 'GlobalBank Corp.',
        location: 'London Data Center',
        last_heartbeat: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        events_processed: 445230,
        created_at: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString()
      },
      
      // RetailChain - Retail
      {
        id: 'retailchain-edr-generic-01',
        name: 'RetailChain - Custom EDR Solution',
        type: 'edr_generic',
        status: 'error',
        company: 'RetailChain Stores',
        location: 'Phoenix Distribution Center',
        last_heartbeat: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        events_processed: 0,
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'retailchain-syslog-01',
        name: 'RetailChain - Syslog Aggregator',
        type: 'syslog',
        status: 'active',
        company: 'RetailChain Stores',
        location: 'Phoenix Distribution Center',
        last_heartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        events_processed: 78920,
        created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      },

      // ManufacturingCorp - Industrial
      {
        id: 'manufacturing-edr-avast-02',
        name: 'ManufacturingCorp - Avast Industrial EDR',
        type: 'edr_avast',
        status: 'active',
        company: 'ManufacturingCorp',
        location: 'Detroit Factory',
        last_heartbeat: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        events_processed: 18750,
        created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'manufacturing-firewall-cisco-02',
        name: 'ManufacturingCorp - Cisco Industrial Firewall',
        type: 'firewall_cisco',
        status: 'active',
        company: 'ManufacturingCorp',
        location: 'Detroit Factory',
        last_heartbeat: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        events_processed: 34560,
        created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString()
      },

      // EduTech University - Education
      {
        id: 'edutech-edr-sentinelone-02',
        name: 'EduTech University - SentinelOne Campus',
        type: 'edr_sentinelone',
        status: 'active',
        company: 'EduTech University',
        location: 'Boston Campus',
        last_heartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        events_processed: 12890,
        created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'edutech-siem-splunk-02',
        name: 'EduTech University - Splunk IT Security',
        type: 'siem_splunk',
        status: 'active',
        company: 'EduTech University',
        location: 'Boston IT Center',
        last_heartbeat: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        events_processed: 45670,
        created_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return NextResponse.json({
      success: true,
      data_sources: mockDataSources,
      total: mockDataSources.length,
      companies: [
        { name: 'TechCorp Inc.', industry: 'Technology', size: 'Large Enterprise', sources: 3 },
        { name: 'MedHealth Systems', industry: 'Healthcare', size: 'Medium Enterprise', sources: 2 },
        { name: 'StartupCo Ltd.', industry: 'Technology', size: 'Small Business', sources: 2 },
        { name: 'GlobalBank Corp.', industry: 'Financial Services', size: 'Large Enterprise', sources: 3 },
        { name: 'RetailChain Stores', industry: 'Retail', size: 'Medium Enterprise', sources: 2 },
        { name: 'ManufacturingCorp', industry: 'Manufacturing', size: 'Large Enterprise', sources: 2 },
        { name: 'EduTech University', industry: 'Education', size: 'Large Organization', sources: 2 }
      ]
    });
  } catch {
    console.error('Failed to fetch demo data sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch demo data sources' },
      { status: 500 }
    );
  }
}