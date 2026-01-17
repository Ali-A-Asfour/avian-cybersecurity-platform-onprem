/**
 * Notification Preferences and Alert Notification Schema
 * Handles user notification preferences for email and SMS alerts
 */

import {
    pgTable,
    uuid,
    varchar,
    boolean,
    jsonb,
    timestamp,
    index,
    pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, tenants } from './main';

// Notification channel enum
export const notificationChannelEnum = pgEnum('notification_channel', [
    'email',
    'sms',
    'both',
    'none',
]);

// Notification type enum
export const notificationTypeEnum = pgEnum('notification_type', [
    'critical_alert',
    'high_alert',
    'medium_alert',
    'low_alert',
    'ticket_assigned',
    'ticket_updated',
    'ticket_comment',
    'sla_breach',
    'device_offline',
    'integration_failure',
]);

// Notification status enum
export const notificationStatusEnum = pgEnum('notification_status', [
    'pending',
    'sent',
    'failed',
    'delivered',
]);

/**
 * User Notification Preferences
 * Stores how each user wants to receive different types of notifications
 */
export const userNotificationPreferences = pgTable(
    'user_notification_preferences',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        
        // Critical alerts (firewall down, EDR threats, etc.)
        criticalAlertChannel: notificationChannelEnum('critical_alert_channel')
            .notNull()
            .default('both'), // Email + SMS by default
        
        // High priority alerts
        highAlertChannel: notificationChannelEnum('high_alert_channel')
            .notNull()
            .default('email'),
        
        // Medium priority alerts
        mediumAlertChannel: notificationChannelEnum('medium_alert_channel')
            .notNull()
            .default('email'),
        
        // Low priority alerts
        lowAlertChannel: notificationChannelEnum('low_alert_channel')
            .notNull()
            .default('none'),
        
        // Ticket notifications
        ticketAssignedChannel: notificationChannelEnum('ticket_assigned_channel')
            .notNull()
            .default('email'),
        
        ticketUpdatedChannel: notificationChannelEnum('ticket_updated_channel')
            .notNull()
            .default('email'),
        
        ticketCommentChannel: notificationChannelEnum('ticket_comment_channel')
            .notNull()
            .default('email'),
        
        // SLA breach notifications
        slaBreachChannel: notificationChannelEnum('sla_breach_channel')
            .notNull()
            .default('both'),
        
        // System notifications
        deviceOfflineChannel: notificationChannelEnum('device_offline_channel')
            .notNull()
            .default('email'),
        
        integrationFailureChannel: notificationChannelEnum('integration_failure_channel')
            .notNull()
            .default('email'),
        
        // Contact information
        phoneNumber: varchar('phone_number', { length: 20 }), // For SMS
        phoneNumberVerified: boolean('phone_number_verified').notNull().default(false),
        
        // Quiet hours (no SMS during these times)
        quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
        quietHoursStart: varchar('quiet_hours_start', { length: 5 }), // HH:MM format
        quietHoursEnd: varchar('quiet_hours_end', { length: 5 }), // HH:MM format
        quietHoursTimezone: varchar('quiet_hours_timezone', { length: 50 }).default('America/New_York'),
        
        // Digest options
        emailDigestEnabled: boolean('email_digest_enabled').notNull().default(false),
        emailDigestFrequency: varchar('email_digest_frequency', { length: 20 }).default('daily'), // hourly, daily, weekly
        
        // Global toggles
        emailEnabled: boolean('email_enabled').notNull().default(true),
        smsEnabled: boolean('sms_enabled').notNull().default(true),
        
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        userIdIdx: index('idx_notification_prefs_user').on(table.userId),
    })
);

/**
 * Notification Queue
 * Stores notifications to be sent (acts as a queue for background processing)
 */
export const notificationQueue = pgTable(
    'notification_queue',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        
        // Notification details
        notificationType: notificationTypeEnum('notification_type').notNull(),
        channel: notificationChannelEnum('channel').notNull(),
        
        // Recipient information
        recipientEmail: varchar('recipient_email', { length: 255 }),
        recipientPhone: varchar('recipient_phone', { length: 20 }),
        
        // Message content
        subject: varchar('subject', { length: 500 }).notNull(),
        message: varchar('message', { length: 1000 }).notNull(),
        htmlContent: varchar('html_content', { length: 10000 }), // For email
        
        // Related entities
        alertId: uuid('alert_id'), // If related to an alert
        ticketId: uuid('ticket_id'), // If related to a ticket
        metadata: jsonb('metadata').default({}),
        
        // Status tracking
        status: notificationStatusEnum('status').notNull().default('pending'),
        attempts: varchar('attempts', { length: 10 }).notNull().default('0'),
        lastAttemptAt: timestamp('last_attempt_at'),
        sentAt: timestamp('sent_at'),
        deliveredAt: timestamp('delivered_at'),
        failureReason: varchar('failure_reason', { length: 500 }),
        
        // Provider information
        provider: varchar('provider', { length: 50 }), // twilio, sendgrid, etc.
        providerMessageId: varchar('provider_message_id', { length: 255 }),
        
        // Scheduling
        scheduledFor: timestamp('scheduled_for'), // For delayed notifications
        expiresAt: timestamp('expires_at'), // Don't send after this time
        
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_notification_queue_tenant').on(table.tenantId),
        userIdx: index('idx_notification_queue_user').on(table.userId),
        statusIdx: index('idx_notification_queue_status').on(table.status),
        scheduledIdx: index('idx_notification_queue_scheduled').on(table.scheduledFor),
        createdAtIdx: index('idx_notification_queue_created').on(table.createdAt),
    })
);

/**
 * Notification History
 * Stores sent notifications for audit and tracking
 */
export const notificationHistory = pgTable(
    'notification_history',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        
        notificationType: notificationTypeEnum('notification_type').notNull(),
        channel: notificationChannelEnum('channel').notNull(),
        
        subject: varchar('subject', { length: 500 }).notNull(),
        message: varchar('message', { length: 1000 }).notNull(),
        
        alertId: uuid('alert_id'),
        ticketId: uuid('ticket_id'),
        
        status: notificationStatusEnum('status').notNull(),
        sentAt: timestamp('sent_at'),
        deliveredAt: timestamp('delivered_at'),
        
        provider: varchar('provider', { length: 50 }),
        providerMessageId: varchar('provider_message_id', { length: 255 }),
        
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_notification_history_tenant').on(table.tenantId),
        userIdx: index('idx_notification_history_user').on(table.userId),
        createdAtIdx: index('idx_notification_history_created').on(table.createdAt),
    })
);

// Relations
export const userNotificationPreferencesRelations = relations(
    userNotificationPreferences,
    ({ one }) => ({
        user: one(users, {
            fields: [userNotificationPreferences.userId],
            references: [users.id],
        }),
    })
);

export const notificationQueueRelations = relations(
    notificationQueue,
    ({ one }) => ({
        tenant: one(tenants, {
            fields: [notificationQueue.tenantId],
            references: [tenants.id],
        }),
        user: one(users, {
            fields: [notificationQueue.userId],
            references: [users.id],
        }),
    })
);

export const notificationHistoryRelations = relations(
    notificationHistory,
    ({ one }) => ({
        tenant: one(tenants, {
            fields: [notificationHistory.tenantId],
            references: [tenants.id],
        }),
        user: one(users, {
            fields: [notificationHistory.userId],
            references: [users.id],
        }),
    })
);
