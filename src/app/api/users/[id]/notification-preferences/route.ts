/**
 * User Notification Preferences API
 * Users can only read/update their own preferences.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/database';
import { userNotificationPreferences } from '../../../../../../database/schemas/notifications';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { UserRole } from '@/types';

async function getAuthContext(request: NextRequest, targetUserId: string) {
  const authResult = await authMiddleware(request);
  if (!authResult.success) return { success: false as const, status: 401, message: authResult.error || 'Authentication failed' };

  const tenantResult = await tenantMiddleware(request, authResult.user!);
  if (!tenantResult.success) return { success: false as const, status: 403, message: tenantResult.error?.message || 'Access denied' };

  // Users can only access their own preferences; admins can access any within their tenant
  const isSelf = authResult.user!.user_id === targetUserId;
  const isAdmin = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user!.role as UserRole);
  if (!isSelf && !isAdmin) return { success: false as const, status: 403, message: 'Access denied' };

  return { success: true as const, user: authResult.user!, tenantId: tenantResult.tenant!.id };
}

const defaultPreferences = (userId: string) => ({
  userId,
  criticalAlertChannel: 'both',
  highAlertChannel: 'email',
  mediumAlertChannel: 'email',
  lowAlertChannel: 'none',
  ticketAssignedChannel: 'email',
  ticketUpdatedChannel: 'email',
  ticketCommentChannel: 'email',
  slaBreachChannel: 'both',
  deviceOfflineChannel: 'email',
  integrationFailureChannel: 'email',
  phoneNumber: null,
  phoneNumberVerified: false,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursTimezone: 'America/New_York',
  emailDigestEnabled: false,
  emailDigestFrequency: 'daily',
  emailEnabled: true,
  smsEnabled: true,
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request, params.id);
  if (!ctx.success) return NextResponse.json({ error: ctx.message }, { status: ctx.status });

  try {
    const prefs = await withTenantContext(ctx.tenantId, ctx.user.role, async (db) => {
      const [row] = await db.select().from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, params.id)).limit(1);
      return row;
    });

    return NextResponse.json(prefs ?? defaultPreferences(params.id));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get notification preferences' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request, params.id);
  if (!ctx.success) return NextResponse.json({ error: ctx.message }, { status: ctx.status });

  const body = await request.json();

  try {
    const result = await withTenantContext(ctx.tenantId, ctx.user.role, async (db) => {
      const [existing] = await db.select().from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, params.id)).limit(1);

      if (existing) {
        const [updated] = await db.update(userNotificationPreferences)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(userNotificationPreferences.userId, params.id))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(userNotificationPreferences)
          .values({ userId: params.id, ...body })
          .returning();
        return created;
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update notification preferences' }, { status: 500 });
  }
}
