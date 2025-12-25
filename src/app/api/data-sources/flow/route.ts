import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock flow data for multi-company demonstration
    const flow_nodes = [
      // Data Sources - Multiple Companies
      {
        id: 'techcorp-edr-crowdstrike-01',
        name: 'TechCorp CrowdStrike EDR',
        type: 'source',
        status: 'active',
        throughput: 452,
        connections: ['normalizer'],
        company: 'TechCorp Inc.',
        location: 'New York HQ'
      },
      {
        id: 'techcorp-firewall-fortinet-01',
        name: 'TechCorp Fortinet Firewall',
        type: 'source',
        status: 'active',
        throughput: 1284,
        connections: ['normalizer'],
        company: 'TechCorp Inc.',
        location: 'New York HQ'
      },
      {
        id: 'medhealth-edr-sentinelone-01',
        name: 'MedHealth SentinelOne EDR',
        type: 'source',
        status: 'active',
        throughput: 231,
        connections: ['normalizer'],
        company: 'MedHealth Systems',
        location: 'Chicago Medical Center'
      },
      {
        id: 'globalbank-edr-crowdstrike-01',
        name: 'GlobalBank CrowdStrike Falcon',
        type: 'source',
        status: 'active',
        throughput: 1567,
        connections: ['normalizer'],
        company: 'GlobalBank Corp.',
        location: 'London Trading Floor'
      },
      {
        id: 'globalbank-siem-splunk-01',
        name: 'GlobalBank Splunk Enterprise',
        type: 'source',
        status: 'active',
        throughput: 2345,
        connections: ['normalizer'],
        company: 'GlobalBank Corp.',
        location: 'London SOC'
      },
      {
        id: 'startupco-edr-avast-01',
        name: 'StartupCo Avast EDR',
        type: 'source',
        status: 'active',
        throughput: 54,
        connections: ['normalizer'],
        company: 'StartupCo Ltd.',
        location: 'Austin Office'
      },
      {
        id: 'retailchain-edr-generic-01',
        name: 'RetailChain Custom EDR',
        type: 'source',
        status: 'error',
        throughput: 0,
        connections: ['normalizer'],
        company: 'RetailChain Stores',
        location: 'Phoenix Distribution Center'
      },
      // Processing Nodes
      {
        id: 'normalizer',
        name: 'Multi-Tenant Data Normalizer',
        type: 'processor',
        status: 'active',
        throughput: 5933,
        connections: ['enricher']
      },
      {
        id: 'enricher',
        name: 'AI Threat Intelligence Enricher',
        type: 'processor',
        status: 'active',
        throughput: 5845,
        connections: ['correlator', 'threat-lake']
      },
      {
        id: 'correlator',
        name: 'Cross-Tenant Event Correlator',
        type: 'processor',
        status: 'active',
        throughput: 1234,
        connections: ['alert-engine']
      },
      // Destinations
      {
        id: 'threat-lake',
        name: 'AVIAN Global Threat Lake',
        type: 'destination',
        status: 'active',
        throughput: 5845,
        connections: []
      },
      {
        id: 'alert-engine',
        name: 'Multi-Tenant Alert Engine',
        type: 'destination',
        status: 'active',
        throughput: 1234,
        connections: []
      }
    ];

    return NextResponse.json({
      success: true,
      flow_nodes
    });
  } catch {
    console.error('Failed to fetch flow data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flow data' },
      { status: 500 }
    );
  }
}