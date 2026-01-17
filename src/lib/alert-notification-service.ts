/**
 * Alert Notification Service
 * Automatically sends notifications when alerts are created or updated
 * Integrates with the notification service for email and SMS delivery
 */

import { getDb } from './database';
import { users } from '../../database/schemas/main';
import { userNotificationPreferences, notificationQueue } from '../../database/schemas/notifications';
import { eq, and } from 'drizzle-orm';
import {
    sendNotification,
    generateNotificationContent,
    type NotificationChannel,
    type NotificationType,
} from './notification-service';

export interface AlertNotificationPayload {
    tenantId: string;
    alertId: string;
    alertTitle: string;
    alertSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    alertDescription: string;
    alertSource: string;
    alertMetadata?: Record<string, any>;
}

export interface TicketNotificationPayload {
    tenantId: string;
    ticketId: string;
    ticketNumber: string;
    ticketTitle: string;
    ticketPriority?: string;
    ticketStatus?: string;
    assignedToUserId?: string;
    action: 'assigned' | 'updated' | 'comment';
}

/**
 * Map alert severity to notification type
 */
function mapSeverityToNotificationType(
    severity: string
): NotificationType {
    switch (severity.toLowerCase()) {
        case 'critical':
            return 'critical_alert';
        case 'high':
            return 'high_alert';
        case 'medium':
            return 'medium_alert';
        case 'low':
            return 'low_alert';
        default:
            return 'medium_alert';
    }
}

/**
 * Get notification channel for a user based on their preferences
 */
async function getUserNotificationChannel(
    userId: string,
    notificationType: NotificationType
): Promise<NotificationChannel> {
    try {
        const db = await getDb();
        
        // Get user preferences
        const [prefs] = await db
            .select()
            .from(userNotificationPreferences)
            .where(eq(userNotificationPreferences.userId, userId))
            .limit(1);

        if (!prefs) {
            // Default preferences if not set
            if (notificationType === 'critical_alert' || notificationType === 'sla_breach') {
                return 'both'; // Email + SMS for critical
            }
            return 'email'; // Email only for others
        }

        // Check if notifications are globally disabled
        if (!prefs.emailEnabled && !prefs.smsEnabled) {
            return 'none';
        }

        // Get channel based on notification type
        let channel: NotificationChannel = 'none';
        
        switch (notificationType) {
            case 'critical_alert':
                channel = prefs.criticalAlertChannel;
                break;
            case 'high_alert':
                channel = prefs.highAlertChannel;
                break;
            case 'medium_alert':
                channel = prefs.mediumAlertChannel;
                break;
            case 'low_alert':
                channel = prefs.lowAlertChannel;
                break;
            case 'ticket_assigned':
                channel = prefs.ticketAssignedChannel;
                break;
            case 'ticket_updated':
                channel = prefs.ticketUpdatedChannel;
                break;
            case 'ticket_comment':
                channel = prefs.ticketCommentChannel;
                break;
            case 'sla_breach':
                channel = prefs.slaBreachChannel;
                break;
            case 'device_offline':
                channel = prefs.deviceOfflineChannel;
                break;
            case 'integration_failure':
                channel = prefs.integrationFailureChannel;
                break;
        }

        // Apply global toggles
        if (channel === 'email' && !prefs.emailEnabled) {
            return 'none';
        }
        if (channel === 'sms' && !prefs.smsEnabled) {
            return 'none';
        }
        if (channel === 'both') {
            if (!prefs.emailEnabled && !prefs.smsEnabled) {
                return 'none';
            }
            if (!prefs.emailEnabled) {
                return 'sms';
            }
            if (!prefs.smsEnabled) {
                return 'email';
            }
        }

        return channel;
    } catch (error) {
        console.error('Error getting user notification channel:', error);
        // Default to email on error
        return 'email';
    }
}

/**
 * Get users who should be notified for an alert
 * Returns security analysts and admins for the tenant
 */
async function getUsersToNotify(tenantId: string): Promise<Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
}>> {
    try {
        const db = await getDb();
        
        // Get security analysts and admins for this tenant
        const usersToNotify = await db
            .select({
                id: users.id,
                email: users.email,
                firstName: users.first_name,
                lastName: users.last_name,
            })
            .from(users)
            .where(
                and(
                    eq(users.tenant_id, tenantId),
                    eq(users.is_active, true)
                )
            );

        // Get phone numbers from preferences
        const usersWithPhones = await Promise.all(
            usersToNotify.map(async (user) => {
                const [prefs] = await db
                    .select()
                    .from(userNotificationPreferences)
                    .where(eq(userNotificationPreferences.userId, user.id))
                    .limit(1);

                return {
                    ...user,
                    phoneNumber: prefs?.phoneNumber || undefined,
                };
            })
        );

        return usersWithPhones;
    } catch (error) {
        console.error('Error getting users to notify:', error);
        return [];
    }
}

/**
 * Send alert notification to relevant users
 */
export async function sendAlertNotification(
    payload: AlertNotificationPayload
): Promise<void> {
    try {
        const notificationType = mapSeverityToNotificationType(payload.alertSeverity);
        
        // Get users to notify
        const usersToNotify = await getUsersToNotify(payload.tenantId);
        
        if (usersToNotify.length === 0) {
            console.log('No users to notify for alert');
            return;
        }

        // Generate notification content
        const content = generateNotificationContent(notificationType, {
            alertTitle: payload.alertTitle,
            alertSeverity: payload.alertSeverity,
            alertDescription: payload.alertDescription,
        });

        // Send notification to each user based on their preferences
        for (const user of usersToNotify) {
            const channel = await getUserNotificationChannel(user.id, notificationType);
            
            if (channel === 'none') {
                console.log(`User ${user.email} has notifications disabled for ${notificationType}`);
                continue;
            }

            // Send notification
            const result = await sendNotification({
                userId: user.id,
                tenantId: payload.tenantId,
                type: notificationType,
                channel,
                subject: content.subject,
                message: content.message,
                htmlContent: content.htmlContent,
                recipientEmail: user.email,
                recipientPhone: user.phoneNumber,
                alertId: payload.alertId,
                metadata: payload.alertMetadata,
            });

            console.log(`Notification sent to ${user.email}:`, result);
        }
    } catch (error) {
        console.error('Error sending alert notification:', error);
    }
}

/**
 * Send ticket notification to assigned user
 */
export async function sendTicketNotification(
    payload: TicketNotificationPayload
): Promise<void> {
    try {
        if (!payload.assignedToUserId) {
            console.log('No user assigned to ticket, skipping notification');
            return;
        }

        const db = await getDb();
        
        // Get assigned user
        const [assignedUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.assignedToUserId))
            .limit(1);

        if (!assignedUser) {
            console.log('Assigned user not found');
            return;
        }

        // Get user's phone number from preferences
        const [prefs] = await db
            .select()
            .from(userNotificationPreferences)
            .where(eq(userNotificationPreferences.userId, assignedUser.id))
            .limit(1);

        // Determine notification type
        const notificationType: NotificationType =
            payload.action === 'assigned'
                ? 'ticket_assigned'
                : payload.action === 'comment'
                ? 'ticket_comment'
                : 'ticket_updated';

        // Get user's notification channel preference
        const channel = await getUserNotificationChannel(
            assignedUser.id,
            notificationType
        );

        if (channel === 'none') {
            console.log(`User has notifications disabled for ${notificationType}`);
            return;
        }

        // Generate notification content
        const content = generateNotificationContent(notificationType, {
            ticketNumber: payload.ticketNumber,
            ticketTitle: payload.ticketTitle,
            ticketPriority: payload.ticketPriority,
            ticketStatus: payload.ticketStatus,
        });

        // Send notification
        const result = await sendNotification({
            userId: assignedUser.id,
            tenantId: payload.tenantId,
            type: notificationType,
            channel,
            subject: content.subject,
            message: content.message,
            htmlContent: content.htmlContent,
            recipientEmail: assignedUser.email,
            recipientPhone: prefs?.phoneNumber,
            ticketId: payload.ticketId,
        });

        console.log(`Ticket notification sent to ${assignedUser.email}:`, result);
    } catch (error) {
        console.error('Error sending ticket notification:', error);
    }
}

/**
 * Send SLA breach warning
 */
export async function sendSLABreachNotification(
    tenantId: string,
    ticketId: string,
    ticketNumber: string,
    ticketTitle: string,
    slaDeadline: Date,
    assignedToUserId?: string
): Promise<void> {
    try {
        const usersToNotify: Array<{
            id: string;
            email: string;
            phoneNumber?: string;
        }> = [];

        const db = await getDb();

        // Notify assigned user if exists
        if (assignedToUserId) {
            const [assignedUser] = await db
                .select()
                .from(users)
                .where(eq(users.id, assignedToUserId))
                .limit(1);

            if (assignedUser) {
                const [prefs] = await db
                    .select()
                    .from(userNotificationPreferences)
                    .where(eq(userNotificationPreferences.userId, assignedUser.id))
                    .limit(1);

                usersToNotify.push({
                    id: assignedUser.id,
                    email: assignedUser.email,
                    phoneNumber: prefs?.phoneNumber,
                });
            }
        }

        // Also notify admins
        const admins = await getUsersToNotify(tenantId);
        usersToNotify.push(...admins.filter(a => a.id !== assignedToUserId));

        // Generate notification content
        const content = generateNotificationContent('sla_breach', {
            ticketNumber,
            ticketTitle,
            slaDeadline: slaDeadline.toLocaleString(),
        });

        // Send to all users
        for (const user of usersToNotify) {
            const channel = await getUserNotificationChannel(user.id, 'sla_breach');
            
            if (channel === 'none') continue;

            await sendNotification({
                userId: user.id,
                tenantId,
                type: 'sla_breach',
                channel,
                subject: content.subject,
                message: content.message,
                htmlContent: content.htmlContent,
                recipientEmail: user.email,
                recipientPhone: user.phoneNumber,
                ticketId,
            });
        }
    } catch (error) {
        console.error('Error sending SLA breach notification:', error);
    }
}
