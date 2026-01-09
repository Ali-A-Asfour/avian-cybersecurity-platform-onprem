import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock flow data for ACME Corporation demonstration
    const flow_nodes = [
      // Data Sources - ACME Corporation
      {
        id: 'acme-edr-crowdstrike-01',
        name: 'ACME CrowdStrike EDR',
        type: 'source',
        status: 'active',
        throughput: 452,
        connections: ['normalizer'],
        company: 'ACME Corporation',
        location: 'San Francisco HQ'
      },
      {
        id: 'acme-firewall-fortinet-01',
        name: 'ACME Fortinet Firewall',
        type: 'source',
        status: 'active',
        throughput: 1284,
        connections: ['normalizer'],
        company: 'ACME Corporation',
        location: 'San Francisco HQ'
      },
      {
        id: 'acme-edr-sentinelone-01',
        name: 'ACME SentinelOne EDR',
        type: 'source',
        status: 'active',
        throughput: 231,
        connections: ['normalizer'],
        company: 'ACME Corporation',
        location: 'San Francisco Branch'
      },
      {
        id: 'acme-siem-qradar-01',
        name: 'ACME IBM QRadar SIEM',
        type: 'source',
        status: 'active',
        throughput: 1567,
        connections: ['normalizer'],
        company: 'ACME Corporation',
        location: 'San Francisco HQ'
      },
      {
        id: 'acme-firewall-cisco-01',
        name: 'ACME Cisco ASA Firewall',
        type: 'source',
        status: 'active',
        throughput: 2345,
        connections: ['normalizer'],
        company: 'ACME Corporation',
        location: 'San Francisco Branch'
      },
      {
        id: 'acme-email-o365-01',
        name: 'ACME Office 365 Email Security',
        type: 'source',
        status: 'active',
        throughput: 54,
        connections: ['normalizer'],
        company: 'ACME Corporation',
        location: 'Cloud'
      },

      // Processing Pipeline
      {
        id: 'normalizer',
        name: 'Data Normalizer',
        type: 'processor',
        status: 'active',
        throughput: 6433,
        connections: ['enricher', 'threat-intel']
      },
      {
        id: 'enricher',
        name: 'Context Enricher',
        type: 'processor',
        status: 'active',
        throughput: 5821,
        connections: ['correlation-engine']
      },
      {
        id: 'threat-intel',
        name: 'Threat Intelligence',
        type: 'processor',
        status: 'active',
        throughput: 4567,
        connections: ['correlation-engine']
      },
      {
        id: 'correlation-engine',
        name: 'Correlation Engine',
        type: 'processor',
        status: 'active',
        throughput: 3456,
        connections: ['alert-manager', 'incident-manager']
      },

      // Output Systems
      {
        id: 'alert-manager',
        name: 'Alert Manager',
        type: 'output',
        status: 'active',
        throughput: 234,
        connections: []
      },
      {
        id: 'incident-manager',
        name: 'Incident Manager',
        type: 'output',
        status: 'active',
        throughput: 45,
        connections: []
      }
    ];

    const flow_edges = [
      // Data Sources to Normalizer
      { from: 'acme-edr-crowdstrike-01', to: 'normalizer', throughput: 452 },
      { from: 'acme-firewall-fortinet-01', to: 'normalizer', throughput: 1284 },
      { from: 'acme-edr-sentinelone-01', to: 'normalizer', throughput: 231 },
      { from: 'acme-siem-qradar-01', to: 'normalizer', throughput: 1567 },
      { from: 'acme-firewall-cisco-01', to: 'normalizer', throughput: 2345 },
      { from: 'acme-email-o365-01', to: 'normalizer', throughput: 54 },
      
      // Processing Pipeline
      { from: 'normalizer', to: 'enricher', throughput: 5821 },
      { from: 'normalizer', to: 'threat-intel', throughput: 4567 },
      { from: 'enricher', to: 'correlation-engine', throughput: 5821 },
      { from: 'threat-intel', to: 'correlation-engine', throughput: 4567 },
      
      // Output
      { from: 'correlation-engine', to: 'alert-manager', throughput: 234 },
      { from: 'correlation-engine', to: 'incident-manager', throughput: 45 }
    ];

    return NextResponse.json({
      success: true,
      data: {
        nodes: flow_nodes,
        edges: flow_edges
      }
    });
  } catch (error) {
    console.error('Failed to fetch flow data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flow data' },
      { status: 500 }
    );
  }
}