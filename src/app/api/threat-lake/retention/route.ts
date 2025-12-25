import { NextRequest, NextResponse } from 'next/server';
import { threatLakeService, ThreatSeverity } from '@/services/threat-lake.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { z } from 'zod';

const retentionPolicySchema = z.object({
  policy_name: z.string().min(1).max(200),
  event_category: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  retention_days: z.number().min(1).max(3650), // Max 10 years
  archive_after_days: z.number().min(1).optional(),
  delete_after_days: z.number().min(1).max(3650),
  compression_enabled: z.boolean().default(true),
  enabled: z.boolean().default(true)
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

    // Only allow Tenant Admins and above to view retention policies
    if (!['tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view retention policies' },
        { status: 403 }
      );
    }

    const { db } = await import('@/lib/database');
    const _result = await db.query(`
      SELECT * FROM data_retention_policies 
      WHERE tenant_id = $1 
      ORDER BY created_at DESC
    `, [tenantResult.tenant.id]);

    logger.info('Retention policies retrieved', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      policyCount: result.rows.length
    });

    return NextResponse.json({ policies: result.rows });
  } catch (error) {
    logger.error('Failed to get retention policies', { error });
    return NextResponse.json(
      { error: 'Failed to get retention policies' },
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

    // Only allow Tenant Admins and above to create retention policies
    if (!['tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create retention policies' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = retentionPolicySchema.parse(body);

    // Validate that delete_after_days >= retention_days
    if (validatedData.delete_after_days < validatedData.retention_days) {
      return NextResponse.json(
        { error: 'Delete after days must be greater than or equal to retention days' },
        { status: 400 }
      );
    }

    // Validate that archive_after_days <= delete_after_days if specified
    if (validatedData.archive_after_days && validatedData.archive_after_days > validatedData.delete_after_days) {
      return NextResponse.json(
        { error: 'Archive after days must be less than or equal to delete after days' },
        { status: 400 }
      );
    }

    const policyData = {
      tenant_id: tenantResult.tenant.id,
      policy_name: validatedData.policy_name,
      event_category: validatedData.event_category,
      severity: validatedData.severity as ThreatSeverity | undefined,
      retention_days: validatedData.retention_days,
      archive_after_days: validatedData.archive_after_days,
      delete_after_days: validatedData.delete_after_days,
      compression_enabled: validatedData.compression_enabled,
      enabled: validatedData.enabled
    };

    const policy = await threatLakeService.createRetentionPolicy(policyData);

    logger.info('Retention policy created', {
      policyId: policy.id,
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      policyName: policy.policy_name
    });

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid retention policy data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to create retention policy', { error });
    return NextResponse.json(
      { error: 'Failed to create retention policy' },
      { status: 500 }
    );
  }
}

// Apply retention policies endpoint
export async function PUT(request: NextRequest) {
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

    // Only allow Tenant Admins and above to apply retention policies
    if (!['tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to apply retention policies' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action !== 'apply') {
      return NextResponse.json(
        { error: 'Invalid action. Use ?action=apply to apply retention policies' },
        { status: 400 }
      );
    }

    const _result = await threatLakeService.applyRetentionPolicies(tenantResult.tenant.id);

    logger.info('Retention policies applied', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      archivedCount: result.archived_count,
      deletedCount: result.deleted_count,
      policiesApplied: result.policies_applied
    });

    return NextResponse.json({
      message: 'Retention policies applied successfully',
      result
    });
  } catch (error) {
    logger.error('Failed to apply retention policies', { error });
    return NextResponse.json(
      { error: 'Failed to apply retention policies' },
      { status: 500 }
    );
  }
}