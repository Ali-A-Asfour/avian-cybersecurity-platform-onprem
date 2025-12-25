// import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, sql } from 'drizzle-orm';
import { notifications } from '../../database/schemas/tenant';
import { Notification } from '@/types';
import { getTenantDatabase } from '@/lib/tenant-schema';

export interface CreateNotificationRequest {
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
}

export interface EmailNotificationTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  digest_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(
    tenantId: string,
    data: CreateNotificationRequest
  ): Promise<Notification> {
    const db = await getTenantDatabase(tenantId);

    const [notification] = await db
      .insert(notifications)
      .values({
        tenant_id: tenantId,
        user_id: data.user_id,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        metadata: JSON.stringify(data.metadata || {}),
      })
      .returning();

    return {
      ...notification,
      metadata: typeof notification.metadata === 'string'
        ? JSON.parse(notification.metadata)
        : notification.metadata
    } as Notification;
  }

  /**
   * Send SLA breach notification
   */
  static async sendSLABreachNotification(
    tenantId: string,
    ticketId: string,
    assigneeId: string,
    ticketTitle: string,
    hoursOverdue: number
  ): Promise<void> {
    await this.createNotification(tenantId, {
      user_id: assigneeId,
      title: 'SLA Breach Alert',
      message: `Ticket "${ticketTitle}" has breached its SLA deadline by ${hoursOverdue} hours.`,
      type: 'error',
      metadata: {
        ticket_id: ticketId,
        breach_type: 'sla',
        hours_overdue: hoursOverdue,
      },
    });
  }

  /**
   * Send ticket assignment notification
   */
  static async sendTicketAssignmentNotification(
    tenantId: string,
    ticketId: string,
    assigneeId: string,
    ticketTitle: string,
    assignedBy: string
  ): Promise<void> {
    await this.createNotification(tenantId, {
      user_id: assigneeId,
      title: 'Ticket Assigned',
      message: `You have been assigned to ticket "${ticketTitle}" by ${assignedBy}.`,
      type: 'info',
      metadata: {
        ticket_id: ticketId,
        assigned_by: assignedBy,
      },
    });
  }

  /**
   * Send ticket status change notification
   */
  static async sendTicketStatusChangeNotification(
    tenantId: string,
    ticketId: string,
    userId: string,
    ticketTitle: string,
    oldStatus: string,
    newStatus: string,
    changedBy: string
  ): Promise<void> {
    await this.createNotification(tenantId, {
      user_id: userId,
      title: 'Ticket Status Updated',
      message: `Ticket "${ticketTitle}" status changed from ${oldStatus} to ${newStatus} by ${changedBy}.`,
      type: 'info',
      metadata: {
        ticket_id: ticketId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: changedBy,
      },
    });
  }

  /**
   * Send escalation notification
   */
  static async sendEscalationNotification(
    tenantId: string,
    ticketId: string,
    managerId: string,
    ticketTitle: string,
    escalationReason: string
  ): Promise<void> {
    await this.createNotification(tenantId, {
      user_id: managerId,
      title: 'Ticket Escalated',
      message: `Ticket "${ticketTitle}" has been escalated. Reason: ${escalationReason}`,
      type: 'warning',
      metadata: {
        ticket_id: ticketId,
        escalation_reason: escalationReason,
      },
    });
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(
    tenantId: string,
    userId: string,
    limit: number = 50
  ): Promise<Notification[]> {
    // Development mode: return mock notifications if database is not available
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return this.getMockNotifications(userId, limit);
    }

    const db = await getTenantDatabase(tenantId);

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.tenant_id, tenantId),
          eq(notifications.user_id, userId)
        )
      )
      .orderBy(sql`${notifications.created_at} DESC`)
      .limit(limit);

    return userNotifications.map(notification => ({
      ...notification,
      metadata: typeof notification.metadata === 'string'
        ? JSON.parse(notification.metadata)
        : notification.metadata
    })) as Notification[];
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(
    tenantId: string,
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    const db = await getTenantDatabase(tenantId);

    const _result = await db
      .update(notifications)
      .set({
        is_read: true,
        read_at: new Date(),
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.tenant_id, tenantId),
          eq(notifications.user_id, userId)
        )
      );

    return true; // Assume success for now
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    // Development mode: return mock count if database is not available
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return 3; // Mock unread count
    }

    const db = await getTenantDatabase(tenantId);

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenant_id, tenantId),
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false)
        )
      );

    return Number(count);
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(tenantId: string, userId: string): Promise<number> {
    const db = await getTenantDatabase(tenantId);

    const _result = await db
      .update(notifications)
      .set({
        is_read: true,
        read_at: new Date(),
      })
      .where(
        and(
          eq(notifications.tenant_id, tenantId),
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false)
        )
      );

    return 0; // Return count of updated notifications (would need to be implemented properly)
  }

  /**
   * Send email notification
   */
  static async sendEmailNotification(
    tenantId: string,
    userId: string,
    template: EmailNotificationTemplate
  ): Promise<boolean> {
    try {
      // This would integrate with an email service like SendGrid, AWS SES, etc.
      // For now, we'll just log the email
      console.log(`Email notification sent to user ${userId}:`, {
        subject: template.subject,
        body: template.textBody,
      });

      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Generate email template for SLA breach
   */
  static generateSLABreachEmailTemplate(
    ticketTitle: string,
    ticketId: string,
    hoursOverdue: number,
    tenantName: string
  ): EmailNotificationTemplate {
    const subject = `SLA Breach Alert - Ticket ${ticketId}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SLA Breach Alert</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2 style="color: #374151;">Ticket SLA Deadline Exceeded</h2>
          <p>The following ticket has breached its SLA deadline:</p>
          <div style="background-color: white; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0;">
            <strong>Ticket:</strong> ${ticketTitle}<br>
            <strong>Ticket ID:</strong> ${ticketId}<br>
            <strong>Hours Overdue:</strong> ${hoursOverdue}<br>
            <strong>Organization:</strong> ${tenantName}
          </div>
          <p>Please take immediate action to resolve this ticket.</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="/tickets/${ticketId}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Ticket</a>
          </div>
        </div>
      </div>
    `;

    const textBody = `
SLA Breach Alert

The following ticket has breached its SLA deadline:

Ticket: ${ticketTitle}
Ticket ID: ${ticketId}
Hours Overdue: ${hoursOverdue}
Organization: ${tenantName}

Please take immediate action to resolve this ticket.

View ticket: /tickets/${ticketId}
    `;

    return { subject, htmlBody, textBody };
  }

  /**
   * Generate email template for ticket assignment
   */
  static generateTicketAssignmentEmailTemplate(
    ticketTitle: string,
    ticketId: string,
    assignedBy: string,
    tenantName: string
  ): EmailNotificationTemplate {
    const subject = `New Ticket Assignment - ${ticketTitle}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">New Ticket Assignment</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2 style="color: #374151;">You have been assigned a new ticket</h2>
          <div style="background-color: white; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0;">
            <strong>Ticket:</strong> ${ticketTitle}<br>
            <strong>Ticket ID:</strong> ${ticketId}<br>
            <strong>Assigned by:</strong> ${assignedBy}<br>
            <strong>Organization:</strong> ${tenantName}
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <a href="/tickets/${ticketId}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Ticket</a>
          </div>
        </div>
      </div>
    `;

    const textBody = `
New Ticket Assignment

You have been assigned a new ticket:

Ticket: ${ticketTitle}
Ticket ID: ${ticketId}
Assigned by: ${assignedBy}
Organization: ${tenantName}

View ticket: /tickets/${ticketId}
    `;

    return { subject, htmlBody, textBody };
  }

  /**
   * Send comprehensive notification (in-app + email + real-time)
   */
  static async sendComprehensiveNotification(
    tenantId: string,
    userId: string,
    notificationData: CreateNotificationRequest,
    emailTemplate?: EmailNotificationTemplate,
    preferences?: NotificationPreferences
  ): Promise<void> {
    // Always create in-app notification
    const notification = await this.createNotification(tenantId, notificationData);

    // Send email if enabled and template provided
    if (emailTemplate && preferences?.email_enabled !== false) {
      await this.sendEmailNotification(tenantId, userId, emailTemplate);
    }

    // Send real-time WebSocket notification
    try {
      // Import WebSocketService dynamically to avoid circular dependencies
      const { WebSocketService } = await import('./websocket.service');
      WebSocketService.sendNotification(userId, {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        metadata: notification.metadata,
      });
    } catch (error) {
      console.error('Error sending WebSocket notification:', error);
    }
  }

  /**
   * Enhanced SLA breach notification with all channels
   */
  static async sendEnhancedSLABreachNotification(
    tenantId: string,
    ticketId: string,
    assigneeId: string,
    ticketTitle: string,
    hoursOverdue: number,
    tenantName: string,
    preferences?: NotificationPreferences
  ): Promise<void> {
    const notificationData: CreateNotificationRequest = {
      user_id: assigneeId,
      title: 'SLA Breach Alert',
      message: `Ticket "${ticketTitle}" has breached its SLA deadline by ${hoursOverdue} hours.`,
      type: 'error',
      metadata: {
        ticket_id: ticketId,
        breach_type: 'sla',
        hours_overdue: hoursOverdue,
      },
    };

    const emailTemplate = this.generateSLABreachEmailTemplate(
      ticketTitle,
      ticketId,
      hoursOverdue,
      tenantName
    );

    await this.sendComprehensiveNotification(
      tenantId,
      assigneeId,
      notificationData,
      emailTemplate,
      preferences
    );
  }

  /**
   * Enhanced ticket assignment notification with all channels
   */
  static async sendEnhancedTicketAssignmentNotification(
    tenantId: string,
    ticketId: string,
    assigneeId: string,
    ticketTitle: string,
    assignedBy: string,
    tenantName: string,
    preferences?: NotificationPreferences
  ): Promise<void> {
    const notificationData: CreateNotificationRequest = {
      user_id: assigneeId,
      title: 'Ticket Assigned',
      message: `You have been assigned to ticket "${ticketTitle}" by ${assignedBy}.`,
      type: 'info',
      metadata: {
        ticket_id: ticketId,
        assigned_by: assignedBy,
      },
    };

    const emailTemplate = this.generateTicketAssignmentEmailTemplate(
      ticketTitle,
      ticketId,
      assignedBy,
      tenantName
    );

    await this.sendComprehensiveNotification(
      tenantId,
      assigneeId,
      notificationData,
      emailTemplate,
      preferences
    );
  }

  /**
   * Send high severity alert notification
   */
  static async sendHighSeverityAlertNotification(
    tenantId: string,
    userId: string,
    alertTitle: string,
    alertId: string,
    severity: string,
    tenantName: string,
    preferences?: NotificationPreferences
  ): Promise<void> {
    const notificationData: CreateNotificationRequest = {
      user_id: userId,
      title: 'High Severity Alert',
      message: `A ${severity} severity alert "${alertTitle}" requires immediate attention.`,
      type: 'error',
      metadata: {
        alert_id: alertId,
        severity: severity,
      },
    };

    const emailTemplate: EmailNotificationTemplate = {
      subject: `High Severity Alert - ${alertTitle}`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">High Severity Alert</h1>
          </div>
          <div style="padding: 20px; background-color: #f9fafb;">
            <h2 style="color: #374151;">Immediate Attention Required</h2>
            <p>A high severity security alert has been detected:</p>
            <div style="background-color: white; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0;">
              <strong>Alert:</strong> ${alertTitle}<br>
              <strong>Alert ID:</strong> ${alertId}<br>
              <strong>Severity:</strong> ${severity}<br>
              <strong>Organization:</strong> ${tenantName}
            </div>
            <div style="text-align: center; margin: 20px 0;">
              <a href="/alerts/${alertId}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Alert</a>
            </div>
          </div>
        </div>
      `,
      textBody: `
High Severity Alert

A high severity security alert has been detected:

Alert: ${alertTitle}
Alert ID: ${alertId}
Severity: ${severity}
Organization: ${tenantName}

View alert: /alerts/${alertId}
      `,
    };

    await this.sendComprehensiveNotification(
      tenantId,
      userId,
      notificationData,
      emailTemplate,
      preferences
    );
  }

  /**
   * Send incident escalation notification to tenant admins
   */
  static async sendIncidentEscalationNotification(
    tenantId: string,
    incidentId: string,
    incidentTitle: string,
    alertId: string,
    alertTitle: string,
    severity: string,
    escalatedBy: string,
    tenantName: string,
    preferences?: NotificationPreferences
  ): Promise<void> {
    // Get all tenant admin users
    const { UserService } = await import('./user.service');
    const tenantAdmins = await UserService.getUsersByRoles(tenantId, ['tenant_admin']);

    // Send notification to each tenant admin
    const notificationPromises = tenantAdmins.map(async (admin) => {
      const notificationData: CreateNotificationRequest = {
        user_id: admin.id,
        title: '🚨 Security Incident Created',
        message: `Security incident "${incidentTitle}" has been created from alert "${alertTitle}" and requires immediate attention.`,
        type: 'error',
        metadata: {
          incident_id: incidentId,
          alert_id: alertId,
          severity: severity,
          escalated_by: escalatedBy,
        },
      };

      const emailTemplate: EmailNotificationTemplate = {
        subject: `🚨 Security Incident Created - ${incidentTitle}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🚨 Security Incident Alert</h1>
            </div>
            <div style="padding: 20px; background-color: #f9fafb;">
              <h2 style="color: #374151;">Security Incident Created</h2>
              <p>A security analyst has escalated an alert to a formal incident that requires immediate attention.</p>
              
              <div style="background-color: white; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #dc2626;">Incident Details</h3>
                <strong>Incident ID:</strong> ${incidentId}<br>
                <strong>Title:</strong> ${incidentTitle}<br>
                <strong>Severity:</strong> ${severity.toUpperCase()}<br>
                <strong>Escalated by:</strong> ${escalatedBy}<br>
                <strong>Created:</strong> ${new Date().toLocaleString()}<br>
              </div>

              <div style="background-color: white; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #f59e0b;">Original Alert Information</h3>
                <strong>Alert ID:</strong> ${alertId}<br>
                <strong>Alert Title:</strong> ${alertTitle}<br>
                <strong>Organization:</strong> ${tenantName}
              </div>

              <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #92400e;">⚠️ Action Required</h3>
                <p style="margin-bottom: 0;">This incident requires immediate review and response. Please log into the AVIAN platform to assess the situation and coordinate the response.</p>
              </div>

              <div style="text-align: center; margin: 20px 0;">
                <a href="/tickets/${incidentId}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Incident</a>
                <a href="/alerts/${alertId}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-left: 10px;">View Original Alert</a>
              </div>

              <div style="background-color: #e5e7eb; padding: 10px; border-radius: 5px; margin-top: 20px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280;">
                  This is an automated notification from the AVIAN Cybersecurity Platform for ${tenantName}.
                </p>
              </div>
            </div>
          </div>
        `,
        textBody: `
🚨 SECURITY INCIDENT ALERT

A security analyst has escalated an alert to a formal incident that requires immediate attention.

INCIDENT DETAILS:
- Incident ID: ${incidentId}
- Title: ${incidentTitle}
- Severity: ${severity.toUpperCase()}
- Escalated by: ${escalatedBy}
- Created: ${new Date().toLocaleString()}

ORIGINAL ALERT INFORMATION:
- Alert ID: ${alertId}
- Alert Title: ${alertTitle}
- Organization: ${tenantName}

⚠️ ACTION REQUIRED
This incident requires immediate review and response. Please log into the AVIAN platform to assess the situation and coordinate the response.

View Incident: /tickets/${incidentId}
View Original Alert: /alerts/${alertId}

This is an automated notification from the AVIAN Cybersecurity Platform for ${tenantName}.
        `,
      };

      return this.sendComprehensiveNotification(
        tenantId,
        admin.id,
        notificationData,
        emailTemplate,
        preferences || { email_enabled: true } // Force email for security incidents
      );
    });

    await Promise.all(notificationPromises);
  }

  /**
   * Get mock notifications for development mode
   */
  private static getMockNotifications(userId: string, limit: number): Notification[] {
    const mockNotifications: Notification[] = [
      {
        id: 'mock-1',
        tenant_id: 'dev-tenant-123',
        user_id: userId,
        title: 'High Severity Security Alert',
        message: 'A critical security vulnerability has been detected on Device-001. Immediate action required.',
        type: 'error',
        is_read: false,
        metadata: {
          alert_id: 'alert-001',
          severity: 'high',
          device_id: 'device-001'
        },
        created_at: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        read_at: null
      },
      {
        id: 'mock-2',
        tenant_id: 'dev-tenant-123',
        user_id: userId,
        title: 'Ticket Assignment',
        message: 'You have been assigned to ticket "Network Configuration Review" by John Smith.',
        type: 'info',
        is_read: false,
        metadata: {
          ticket_id: 'ticket-002',
          assigned_by: 'John Smith'
        },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        read_at: null
      },
      {
        id: 'mock-3',
        tenant_id: 'dev-tenant-123',
        user_id: userId,
        title: 'SLA Breach Warning',
        message: 'Ticket "Firewall Policy Update" is approaching its SLA deadline in 2 hours.',
        type: 'warning',
        is_read: false,
        metadata: {
          ticket_id: 'ticket-003',
          hours_remaining: 2
        },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
        read_at: null
      },
      {
        id: 'mock-4',
        tenant_id: 'dev-tenant-123',
        user_id: userId,
        title: 'Compliance Report Generated',
        message: 'Your monthly compliance report has been generated and is ready for review.',
        type: 'success',
        is_read: true,
        metadata: {
          report_id: 'report-004',
          report_type: 'compliance'
        },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        read_at: new Date(Date.now() - 1000 * 60 * 60 * 20) // Read 20 hours ago
      },
      {
        id: 'mock-5',
        tenant_id: 'dev-tenant-123',
        user_id: userId,
        title: 'System Maintenance Scheduled',
        message: 'Scheduled maintenance will occur tonight from 2:00 AM to 4:00 AM EST.',
        type: 'info',
        is_read: true,
        metadata: {
          maintenance_window: '2:00 AM - 4:00 AM EST',
          affected_services: ['firewall', 'monitoring']
        },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
        read_at: new Date(Date.now() - 1000 * 60 * 60 * 24) // Read 1 day ago
      }
    ];

    return mockNotifications.slice(0, limit);
  }
}