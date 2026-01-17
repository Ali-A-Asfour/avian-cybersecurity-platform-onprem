/**
 * User Notification Preferences API
 * GET/PUT endpoints for managing user notification preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { userNotificationPreferences } from '../../../../../../database/schemas/notifications';
import { eq } from 'drizzle-orm';

/**
 * GET /api/users/[id]/notification-preferences
 * Get user's notification preferences
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const userId = params.id;
        const db = await getDb();

        // Get user preferences
        const [prefs] = await db
            .select()
            .from(userNotificationPreferences)
            .where(eq(userNotificationPreferences.userId, userId))
            .limit(1);

        if (!prefs) {
            // Return default preferences if not set
            return NextResponse.json({
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
        }

        return NextResponse.json(prefs);
    } catch (error) {
        console.error('Error getting notification preferences:', error);
        return NextResponse.json(
            { error: 'Failed to get notification preferences' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/users/[id]/notification-preferences
 * Update user's notification preferences
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const userId = params.id;
        const body = await request.json();
        const db = await getDb();

        // Check if preferences exist
        const [existing] = await db
            .select()
            .from(userNotificationPreferences)
            .where(eq(userNotificationPreferences.userId, userId))
            .limit(1);

        if (existing) {
            // Update existing preferences
            const [updated] = await db
                .update(userNotificationPreferences)
                .set({
                    ...body,
                    updatedAt: new Date(),
                })
                .where(eq(userNotificationPreferences.userId, userId))
                .returning();

            return NextResponse.json(updated);
        } else {
            // Create new preferences
            const [created] = await db
                .insert(userNotificationPreferences)
                .values({
                    userId,
                    ...body,
                })
                .returning();

            return NextResponse.json(created);
        }
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        return NextResponse.json(
            { error: 'Failed to update notification preferences' },
            { status: 500 }
        );
    }
}
