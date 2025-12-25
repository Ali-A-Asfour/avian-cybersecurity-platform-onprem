import { NextRequest, NextResponse } from 'next/server';
import { threatLakeService, ThreatFeedType, SyncStatus } from '@/services/threat-lake.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { z } from 'zod';

const threatIntelFeedSchema = z.object({
  name: z.string().min(1).max(200),
  feed_type: z.enum(['ioc', 'yara', 'sigma', 'mitre_attack', 'custom']),
  source_url: z.string().url().optional(),
  api_key: z.string().optional(),
  update_frequency_hours: z.number().min(1).max(168).default(24), // Max 1 week
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

    // Only allow Security Analysts and above to view threat intelligence feeds
    if (!['security_analyst', 'tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view threat intelligence feeds' },
        { status: 403 }
      );
    }

    const feeds = await threatLakeService.getThreatIntelFeeds(tenantResult.tenant.id);

    // Remove sensitive information from response
    const sanitizedFeeds = feeds.map(feed => ({
      ...feed,
      api_key_encrypted: feed.api_key_encrypted ? '[ENCRYPTED]' : undefined
    }));

    logger.info('Threat intelligence feeds retrieved', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      feedCount: feeds.length
    });

    return NextResponse.json({ feeds: sanitizedFeeds });
  } catch (error) {
    logger.error('Failed to get threat intelligence feeds', { error });
    return NextResponse.json(
      { error: 'Failed to get threat intelligence feeds' },
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

    // Only allow Tenant Admins and above to create threat intelligence feeds
    if (!['tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create threat intelligence feeds' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = threatIntelFeedSchema.parse(body);

    // Encrypt API key if provided
    let api_key_encrypted: string | undefined;
    if (validatedData.api_key) {
      // In a real implementation, you would use proper encryption
      // For now, we'll just base64 encode it (NOT secure for production)
      api_key_encrypted = Buffer.from(validatedData.api_key).toString('base64');
    }

    const feedData = {
      tenant_id: tenantResult.tenant.id,
      name: validatedData.name,
      feed_type: validatedData.feed_type as ThreatFeedType,
      source_url: validatedData.source_url,
      api_key_encrypted,
      update_frequency_hours: validatedData.update_frequency_hours,
      enabled: validatedData.enabled,
      last_sync_status: SyncStatus.PENDING
    };

    const feed = await threatLakeService.createThreatIntelFeed(feedData);

    // Remove sensitive information from response
    const sanitizedFeed = {
      ...feed,
      api_key_encrypted: feed.api_key_encrypted ? '[ENCRYPTED]' : undefined
    };

    logger.info('Threat intelligence feed created', {
      feedId: feed.id,
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      feedName: feed.name,
      feedType: feed.feed_type
    });

    return NextResponse.json(sanitizedFeed, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid threat intelligence feed data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to create threat intelligence feed', { error });
    return NextResponse.json(
      { error: 'Failed to create threat intelligence feed' },
      { status: 500 }
    );
  }
}