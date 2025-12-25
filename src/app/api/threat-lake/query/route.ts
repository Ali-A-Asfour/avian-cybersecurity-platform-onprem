import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 100 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Mock query execution - in real implementation, this would query the threat lake
    const mockResults = [];
    const numResults = Math.min(limit, Math.floor(Math.random() * 50) + 10);

    for (let i = 0; i < numResults; i++) {
      const severities = ['low', 'medium', 'high', 'critical'];
      const eventTypes = ['malware_detection', 'suspicious_login', 'network_anomaly', 'data_exfiltration'];
      const sourceTypes = ['edr_avast', 'firewall_pfsense', 'siem_splunk'];

      mockResults.push({
        id: `event-${i}`,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        source_type: sourceTypes[Math.floor(Math.random() * sourceTypes.length)],
        title: `Security Event ${i + 1}`,
        description: `Detailed description of security event ${i + 1} matching query: ${query}`,
        metadata: {
          source_ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
          user: Math.random() > 0.5 ? `user${Math.floor(Math.random() * 100)}` : undefined,
          process: Math.random() > 0.7 ? `process${Math.floor(Math.random() * 10)}.exe` : undefined
        }
      });
    }

    // Sort by timestamp (newest first)
    mockResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      results: mockResults,
      total: mockResults.length,
      query_time_ms: Math.floor(Math.random() * 1000) + 100
    });
  } catch (error) {
    console.error('Failed to execute query:', error);
    return NextResponse.json(
      { error: 'Failed to execute query' },
      { status: 500 }
    );
  }
}