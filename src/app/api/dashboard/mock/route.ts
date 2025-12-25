import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Mock dashboard data for development
  const mockData = {
    tickets: {
      total: 42,
      open: 15,
      inProgress: 12,
      resolved: 15,
      byPriority: {
        critical: 3,
        high: 8,
        medium: 18,
        low: 13
      },
      bySeverity: {
        critical: 2,
        high: 6,
        medium: 20,
        low: 14
      }
    },
    alerts: {
      total: 128,
      critical: 5,
      high: 23,
      medium: 67,
      low: 33,
      byCategory: {
        malware: 15,
        phishing: 8,
        intrusion: 12,
        data_breach: 3,
        policy_violation: 25,
        anomaly: 65
      }
    },
    compliance: {
      overallScore: 87,
      frameworks: [
        { name: 'HIPAA', score: 92, controls: 45 },
        { name: 'SOC2', score: 85, controls: 32 },
        { name: 'ISO27001', score: 84, controls: 114 }
      ],
      recentChanges: 3
    },
    sla: {
      responseTime: {
        average: 2.3,
        target: 4.0,
        percentage: 94
      },
      resolutionTime: {
        average: 18.5,
        target: 24.0,
        percentage: 89
      }
    },
    activity: [
      {
        id: '1',
        type: 'alert',
        title: 'High severity alert resolved',
        description: 'Malware detection alert was investigated and resolved',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        user: 'Security Analyst'
      },
      {
        id: '2',
        type: 'ticket',
        title: 'New security incident reported',
        description: 'Suspicious email attachment detected',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        user: 'John Doe'
      },
      {
        id: '3',
        type: 'compliance',
        title: 'HIPAA control updated',
        description: 'Access control policy was reviewed and updated',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        user: 'Compliance Officer'
      }
    ]
  };

  return NextResponse.json({
    success: true,
    data: mockData
  });
}
