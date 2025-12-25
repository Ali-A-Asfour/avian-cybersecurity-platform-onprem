import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { user, tenant } = tenantResult;
    const _agentId = params.id;

    // Only Security Analysts, Tenant Admins, and Super Admins can perform correlation
    if (!['super_admin', 'tenant_admin', 'security_analyst'].includes(user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to perform data correlation',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const correlationRequest = await request.json();

    // Validate correlation request
    if (!correlationRequest.event_data) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_CORRELATION_REQUEST',
          message: 'Event data is required for correlation',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Perform data correlation
    const correlationResults = await agentService.correlateAgentData(
      agentId, 
      correlationRequest.event_data
    );

    // Generate additional insights if requested
    let insights = null;
    if (correlationRequest.generate_insights) {
      insights = await generateCorrelationInsights(correlationResults);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        agent_id: agentId,
        correlation_results: correlationResults,
        insights: insights,
        processed_at: new Date(),
      },
    };

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to correlate agent data', { error, agentId: params.id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CORRELATION_ERROR',
        message: 'Failed to correlate agent data',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: _id } = await params;
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { user, tenant } = tenantResult;
    const _agentId = params.id;

    // Only Security Analysts, Tenant Admins, and Super Admins can view correlation data
    if (!['super_admin', 'tenant_admin', 'security_analyst'].includes(user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to view correlation data',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const _timeRange = searchParams.get('time_range') || '24h';
    const correlationType = searchParams.get('type') || 'all';

    // Get correlation history for the agent
    const correlationHistory = await getCorrelationHistory(agentId, timeRange, correlationType);

    const response: ApiResponse = {
      success: true,
      data: correlationHistory,
    };

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to get correlation history', { error, agentId: params.id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CORRELATION_HISTORY_ERROR',
        message: 'Failed to retrieve correlation history',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

async function generateCorrelationInsights(correlationResults: any): Promise<any> {
  const insights = {
    risk_assessment: 'low',
    threat_level: 'minimal',
    recommendations: [],
    priority_actions: [],
  };

  // Analyze threat matches
  if (correlationResults.threat_matches.length > 0) {
    insights.threat_level = 'elevated';
    insights.recommendations.push('Review threat intelligence matches and implement countermeasures');
    
    if (correlationResults.threat_matches.length > 5) {
      insights.threat_level = 'high';
      insights.priority_actions.push('Immediate investigation required');
    }
  }

  // Analyze SIEM correlations
  if (correlationResults.siem_correlations.length > 0) {
    insights.recommendations.push('Correlate with SIEM data for broader context');
  }

  // Assess overall risk
  if (correlationResults.risk_score > 70) {
    insights.risk_assessment = 'high';
    insights.priority_actions.push('Implement additional security controls');
  } else if (correlationResults.risk_score > 40) {
    insights.risk_assessment = 'medium';
    insights.recommendations.push('Monitor closely for additional indicators');
  }

  return insights;
}

async function getCorrelationHistory(agentId: string, timeRange: string, correlationType: string): Promise<any> {
  // In a real implementation, this would query the correlation database
  // For now, return mock data
  const mockHistory = {
    agent_id: agentId,
    time_range: timeRange,
    correlation_type: correlationType,
    total_correlations: 23,
    correlations: [
      {
        id: 'corr-1',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        event_type: 'network_connection',
        correlation_type: 'threat_intelligence',
        risk_score: 85,
        threat_matches: [
          {
            indicator: '192.168.1.100',
            type: 'ip_address',
            threat_type: 'malware_c2',
            confidence: 90,
          },
        ],
        siem_correlations: [],
        status: 'investigated',
      },
      {
        id: 'corr-2',
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        event_type: 'file_modification',
        correlation_type: 'behavioral_analysis',
        risk_score: 45,
        threat_matches: [],
        siem_correlations: [
          {
            rule_name: 'Suspicious File Activity',
            severity: 'medium',
            confidence: 75,
          },
        ],
        status: 'pending_review',
      },
      {
        id: 'corr-3',
        timestamp: new Date(Date.now() - 10800000), // 3 hours ago
        event_type: 'process_execution',
        correlation_type: 'anomaly_detection',
        risk_score: 30,
        threat_matches: [],
        siem_correlations: [],
        status: 'false_positive',
      },
    ],
    summary: {
      high_risk_correlations: 1,
      medium_risk_correlations: 1,
      low_risk_correlations: 1,
      pending_investigations: 1,
      false_positives: 1,
    },
  };

  return mockHistory;
}