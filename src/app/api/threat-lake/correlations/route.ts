import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _timeRange = searchParams.get('time_range') || '24h';

    // Mock correlation data for demonstration
    const correlations = [
      {
        id: 'corr-1',
        title: 'Coordinated Attack Campaign',
        severity: 'high',
        confidence_score: 0.92,
        events: [
          {
            id: 'event-1',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            title: 'Suspicious Login Attempt',
            description: 'Multiple failed login attempts from unusual location',
            severity: 'medium',
            event_type: 'authentication_failure',
            source_type: 'edr_avast',
            correlation_id: 'corr-1',
            related_events: ['event-2', 'event-3'],
            threat_indicators: ['IP-192.168.1.100', 'User-admin']
          },
          {
            id: 'event-2',
            timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            title: 'Malware Detection',
            description: 'Trojan detected on compromised system',
            severity: 'high',
            event_type: 'malware_detection',
            source_type: 'edr_avast',
            correlation_id: 'corr-1',
            related_events: ['event-1', 'event-3'],
            threat_indicators: ['Hash-abc123', 'File-malware.exe']
          },
          {
            id: 'event-3',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            title: 'Data Exfiltration Attempt',
            description: 'Large data transfer to external IP',
            severity: 'critical',
            event_type: 'data_exfiltration',
            source_type: 'firewall_pfsense',
            correlation_id: 'corr-1',
            related_events: ['event-1', 'event-2'],
            threat_indicators: ['IP-203.0.113.1', 'Bytes-50MB']
          }
        ]
      },
      {
        id: 'corr-2',
        title: 'Lateral Movement Pattern',
        severity: 'medium',
        confidence_score: 0.78,
        events: [
          {
            id: 'event-4',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            title: 'Privilege Escalation',
            description: 'User account gained administrative privileges',
            severity: 'medium',
            event_type: 'privilege_escalation',
            source_type: 'siem_splunk',
            correlation_id: 'corr-2',
            related_events: ['event-5'],
            threat_indicators: ['User-service_account', 'Privilege-admin']
          },
          {
            id: 'event-5',
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            title: 'Network Scanning',
            description: 'Port scanning activity detected',
            severity: 'low',
            event_type: 'network_scan',
            source_type: 'firewall_pfsense',
            correlation_id: 'corr-2',
            related_events: ['event-4'],
            threat_indicators: ['IP-192.168.1.50', 'Ports-22,80,443']
          }
        ]
      }
    ];

    return NextResponse.json({
      success: true,
      correlations
    });
  } catch {
    console.error('Failed to fetch correlations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch correlations' },
      { status: 500 }
    );
  }
}