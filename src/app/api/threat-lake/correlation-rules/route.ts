import { NextRequest, NextResponse } from 'next/server';
import { threatLakeService, CorrelationRuleLogic, ThreatSeverity } from '@/services/threat-lake.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const correlationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  rule_logic: z.object({
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'contains', 'regex', 'greater_than', 'less_than', 'in', 'not_in']),
      value: z.any(),
      case_sensitive: z.boolean().optional()
    })),
    operator: z.enum(['AND', 'OR']),
    time_window_minutes: z.number().min(1).optional(),
    threshold_count: z.number().min(1).optional(),
    grouping_fields: z.array(z.string()).optional()
  }),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean().default(true),
  time_window_minutes: z.number().min(1).max(10080).default(60), // Max 1 week
  threshold_count: z.number().min(1).max(1000).default(1)
});

export async function GET(request: NextRequest) {
  try {
    // Authentication and tenant validation
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    // Only allow Security Analysts and above to view correlation rules
    if (!['security_analyst', 'tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view correlation rules' },
        { status: 403 }
      );
    }

    const rules = await threatLakeService.getCorrelationRules(tenantResult.tenant.id);

    logger.info('Correlation rules retrieved', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      ruleCount: rules.length
    });

    return NextResponse.json({ rules });
  } catch (error) {
    logger.error('Failed to get correlation rules', { error });
    return NextResponse.json(
      { error: 'Failed to get correlation rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and tenant validation
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    // Only allow Security Analysts and above to create correlation rules
    if (!['security_analyst', 'tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create correlation rules' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = correlationRuleSchema.parse(body);

    const ruleData = {
      tenant_id: tenantResult.tenant.id,
      name: validatedData.name,
      description: validatedData.description,
      rule_logic: validatedData.rule_logic as CorrelationRuleLogic,
      severity: validatedData.severity as ThreatSeverity,
      enabled: validatedData.enabled,
      time_window_minutes: validatedData.time_window_minutes,
      threshold_count: validatedData.threshold_count,
      created_by: authResult.user!.id
    };

    const rule = await threatLakeService.createCorrelationRule(ruleData);

    logger.info('Correlation rule created', {
      ruleId: rule.id,
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      ruleName: rule.name
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid correlation rule data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to create correlation rule', { error });
    return NextResponse.json(
      { error: 'Failed to create correlation rule' },
      { status: 500 }
    );
  }
}