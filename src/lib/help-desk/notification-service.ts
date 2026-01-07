/**
 * Help Desk Notification Service
 * 
 * Handles email notifications for help desk operations with retry mechanisms,
 * error handling, and graceful degradation when email service is unavailable.
 */

import { HelpDeskRetryManager, HelpDeskErrors, HelpDeskValidator } from './error-handling';
import { Ticket, User } from '@/types';
import { api } from '@/lib/api-client';

export interface NotificationConfig {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    retryAttempts: number;
    retryDelay: number;
}

export interface EmailTemplate {
    subject: string;
    htmlBody: string;
    textBody: string;
}

export interface NotificationContext {
    ticketId: string;
    ticketTitle: string;
    ticketStatus: string;
    assignee?: string;
    requester: string;
    requesterEmail: string;
    tenantName: string;
    resolution?: string;
    deviceId?: string;
    contactMethod?: string;
    phoneNumber?: string;
}

export interface NotificationResult {
    success: boolean;
    messageId?: string;
    error?: string;
    retryCount?: number;
}

/**
 * Email notification service with error handling and retry logic
 */
export class NotificationService {
    private static config: NotificationConfig | null = null;
    private static isServiceAvailable = true;
    private static lastServiceCheck = 0;
    private static readonly SERVICE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

    /**
     * Initialize notification service with configuration
     */
    static initialize(config: NotificationConfig): void {
        this.config = config;
    }

    /**
     * Send ticket creation notification
     */
    static async sendTicketCreatedNotification(
        ticket: Ticket,
        user: User
    ): Promise<NotificationResult> {
        const context: NotificationContext = {
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            ticketStatus: ticket.status,
            requester: user.first_name + ' ' + user.last_name,
            requesterEmail: user.email,
            tenantName: 'Help Desk', // This would come from tenant info
            deviceId: ticket.device_name,
        };

        const template = this.getTicketCreatedTemplate(context);

        return this.sendNotificationWithRetry(
            context.requesterEmail,
            template,
            'ticket_created',
            context
        );
    }

    /**
     * Send ticket assignment notification
     */
    static async sendTicketAssignedNotification(
        context: NotificationContext
    ): Promise<NotificationResult> {
        const template = this.getTicketAssignedTemplate(context);

        return this.sendNotificationWithRetry(
            context.requesterEmail,
            template,
            'ticket_assigned',
            context
        );
    }

    /**
     * Send ticket resolution notification
     */
    static async sendTicketResolvedNotification(
        context: NotificationContext
    ): Promise<NotificationResult> {
        const template = this.getTicketResolvedTemplate(context);

        return this.sendNotificationWithRetry(
            context.requesterEmail,
            template,
            'ticket_resolved',
            context
        );
    }

    /**
     * Send notification with retry mechanism
     */
    private static async sendNotificationWithRetry(
        to: string,
        template: EmailTemplate,
        type: string,
        context: NotificationContext
    ): Promise<NotificationResult> {
        // Validate email address
        if (!HelpDeskValidator.isValidEmail(to)) {
            return {
                success: false,
                error: 'Invalid email address',
            };
        }

        // Check if service is available
        if (!await this.checkServiceAvailability()) {
            console.warn(`Email service unavailable, skipping ${type} notification for ticket ${context.ticketId}`);
            return {
                success: false,
                error: 'Email service temporarily unavailable',
            };
        }

        try {
            const result = await HelpDeskRetryManager.executeWithRetry(
                () => this.sendEmail(to, template),
                {
                    maxRetries: this.config?.retryAttempts || 3,
                    baseDelay: this.config?.retryDelay || 1000,
                    shouldRetry: (error) => this.shouldRetryNotification(error),
                    onRetry: (attempt, error) => {
                        console.warn(`Email notification retry attempt ${attempt} for ${type}:`, error.message);
                    },
                }
            );

            return {
                success: true,
                messageId: result.messageId,
                retryCount: result.retryCount,
            };

        } catch (error) {
            console.error(`Failed to send ${type} notification:`, error);

            // Mark service as unavailable if it's a service error
            if (this.isServiceError(error)) {
                this.isServiceAvailable = false;
                this.lastServiceCheck = Date.now();
            }

            return {
                success: false,
                error: this.getNotificationErrorMessage(error),
            };
        }
    }

    /**
     * Send email using configured SMTP service
     */
    private static async sendEmail(
        to: string,
        template: EmailTemplate
    ): Promise<{ messageId: string; retryCount: number }> {
        if (!this.config) {
            // In development, just log the email instead of sending
            if (process.env.NODE_ENV === 'development') {
                console.log('📧 Email notification (dev mode):');
                console.log(`To: ${to}`);
                console.log(`Subject: ${template.subject}`);
                console.log(`Body: ${template.textBody}`);
                return {
                    messageId: `dev_msg_${Date.now()}`,
                    retryCount: 0,
                };
            }
            throw HelpDeskErrors.emailServiceUnavailable();
        }

        // In a real implementation, this would use a proper email service
        // For now, we'll simulate the email sending process
        try {
            const response = await api.post('/api/notifications/email', {
                to,
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                subject: template.subject,
                html: template.htmlBody,
                text: template.textBody,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Email service returned ${response.status}`);
            }

            const result = await response.json();
            return {
                messageId: result.messageId || `msg_${Date.now()}`,
                retryCount: 0,
            };
        } catch (error) {
            // Fallback to console logging in development
            if (process.env.NODE_ENV === 'development') {
                console.log('📧 Email notification (fallback):');
                console.log(`To: ${to}`);
                console.log(`Subject: ${template.subject}`);
                console.log(`Body: ${template.textBody}`);
                return {
                    messageId: `fallback_msg_${Date.now()}`,
                    retryCount: 0,
                };
            }
            throw error;
        }
    }

    /**
     * Check if email service is available
     */
    private static async checkServiceAvailability(): Promise<boolean> {
        const now = Date.now();

        // If we recently checked and service was unavailable, don't check again immediately
        if (!this.isServiceAvailable && (now - this.lastServiceCheck) < this.SERVICE_CHECK_INTERVAL) {
            return false;
        }

        // In development, always return true
        if (process.env.NODE_ENV === 'development') {
            return true;
        }

        try {
            // Perform a lightweight health check
            const response = await api.get('/api/notifications/health', {
                signal: AbortSignal.timeout(5000), // 5 second timeout
            });

            this.isServiceAvailable = response.ok;
            this.lastServiceCheck = now;

            return this.isServiceAvailable;
        } catch (error) {
            this.isServiceAvailable = false;
            this.lastServiceCheck = now;
            return false;
        }
    }

    /**
     * Determine if notification error should trigger retry
     */
    private static shouldRetryNotification(error: any): boolean {
        // Don't retry on invalid email addresses or authentication errors
        if (error.message?.includes('Invalid email') || error.status === 401) {
            return false;
        }

        // Retry on network errors and server errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return true;
        }

        if (error.status >= 500) {
            return true;
        }

        // Retry on rate limiting
        if (error.status === 429) {
            return true;
        }

        return false;
    }

    /**
     * Check if error indicates service unavailability
     */
    private static isServiceError(error: any): boolean {
        return error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.status >= 500;
    }

    /**
     * Get user-friendly error message for notification failures
     */
    private static getNotificationErrorMessage(error: any): string {
        if (error.message?.includes('Invalid email')) {
            return 'Invalid email address provided';
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return 'Email service is temporarily unavailable';
        }

        if (error.status === 429) {
            return 'Email rate limit exceeded, please try again later';
        }

        if (error.status >= 500) {
            return 'Email service error, notification may be delayed';
        }

        return 'Failed to send email notification';
    }

    /**
     * Get ticket created email template
     */
    private static getTicketCreatedTemplate(context: NotificationContext): EmailTemplate {
        const expectedResponse = this.getExpectedResponseTime(context.ticketStatus);

        return {
            subject: `Ticket Created: ${context.ticketTitle} (#${context.ticketId})`,
            htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Your Support Ticket Has Been Created</h2>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Ticket Details</h3>
            <p><strong>Ticket Number:</strong> #${context.ticketId}</p>
            <p><strong>Title:</strong> ${context.ticketTitle}</p>
            <p><strong>Status:</strong> ${context.ticketStatus}</p>
            ${context.deviceId ? `<p><strong>Device:</strong> ${context.deviceId}</p>` : ''}
            <p><strong>Expected Response:</strong> ${expectedResponse}</p>
          </div>

          <p>We have received your support request and will respond ${expectedResponse}. You will receive email updates as your ticket progresses.</p>
          
          ${context.contactMethod === 'phone' && context.phoneNumber ?
                    `<p><strong>Note:</strong> You have requested phone contact at ${context.phoneNumber}. We will call you during business hours.</p>` :
                    ''
                }

          <p>If you need to add additional information, simply reply to this email.</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from ${context.tenantName} Help Desk.<br>
            Please do not reply directly to this email address.
          </p>
        </div>
      `,
            textBody: `
Your Support Ticket Has Been Created

Ticket Details:
- Ticket Number: #${context.ticketId}
- Title: ${context.ticketTitle}
- Status: ${context.ticketStatus}
${context.deviceId ? `- Device: ${context.deviceId}\n` : ''}
- Expected Response: ${expectedResponse}

We have received your support request and will respond ${expectedResponse}. You will receive email updates as your ticket progresses.

${context.contactMethod === 'phone' && context.phoneNumber ?
                    `Note: You have requested phone contact at ${context.phoneNumber}. We will call you during business hours.\n\n` :
                    ''
                }If you need to add additional information, simply reply to this email.

---
This is an automated message from ${context.tenantName} Help Desk.
Please do not reply directly to this email address.
      `.trim(),
        };
    }

    /**
     * Get ticket assigned email template
     */
    private static getTicketAssignedTemplate(context: NotificationContext): EmailTemplate {
        return {
            subject: `Ticket Update: Someone is working on your request (#${context.ticketId})`,
            htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Good News! Someone is Working on Your Ticket</h2>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0;">Ticket Update</h3>
            <p><strong>Ticket Number:</strong> #${context.ticketId}</p>
            <p><strong>Title:</strong> ${context.ticketTitle}</p>
            <p><strong>Status:</strong> In Progress</p>
            ${context.assignee ? `<p><strong>Assigned to:</strong> ${context.assignee}</p>` : ''}
          </div>

          <p>Your support ticket has been assigned to one of our help desk analysts and is now being worked on. You should expect to hear back from us soon with either a resolution or a request for additional information.</p>

          <p>If you have any additional details that might help resolve your issue faster, please reply to this email.</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from ${context.tenantName} Help Desk.<br>
            Please do not reply directly to this email address.
          </p>
        </div>
      `,
            textBody: `
Good News! Someone is Working on Your Ticket

Ticket Update:
- Ticket Number: #${context.ticketId}
- Title: ${context.ticketTitle}
- Status: In Progress
${context.assignee ? `- Assigned to: ${context.assignee}\n` : ''}

Your support ticket has been assigned to one of our help desk analysts and is now being worked on. You should expect to hear back from us soon with either a resolution or a request for additional information.

If you have any additional details that might help resolve your issue faster, please reply to this email.

---
This is an automated message from ${context.tenantName} Help Desk.
Please do not reply directly to this email address.
      `.trim(),
        };
    }

    /**
     * Get ticket resolved email template
     */
    private static getTicketResolvedTemplate(context: NotificationContext): EmailTemplate {
        return {
            subject: `Ticket Resolved: ${context.ticketTitle} (#${context.ticketId})`,
            htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Your Ticket Has Been Resolved</h2>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0;">Resolution Details</h3>
            <p><strong>Ticket Number:</strong> #${context.ticketId}</p>
            <p><strong>Title:</strong> ${context.ticketTitle}</p>
            <p><strong>Status:</strong> Resolved</p>
            ${context.assignee ? `<p><strong>Resolved by:</strong> ${context.assignee}</p>` : ''}
          </div>

          ${context.resolution ? `
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">How We Fixed It</h3>
              <p>${context.resolution}</p>
            </div>
          ` : ''}

          <p>Your support ticket has been resolved. If this solution worked for you, no further action is needed.</p>
          
          <p><strong>If you're still experiencing issues:</strong> Simply reply to this email and your ticket will be automatically reopened for further assistance.</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from ${context.tenantName} Help Desk.<br>
            Reply to this email if you need further assistance.
          </p>
        </div>
      `,
            textBody: `
Your Ticket Has Been Resolved

Resolution Details:
- Ticket Number: #${context.ticketId}
- Title: ${context.ticketTitle}
- Status: Resolved
${context.assignee ? `- Resolved by: ${context.assignee}\n` : ''}

${context.resolution ? `
How We Fixed It:
${context.resolution}

` : ''}Your support ticket has been resolved. If this solution worked for you, no further action is needed.

If you're still experiencing issues: Simply reply to this email and your ticket will be automatically reopened for further assistance.

---
This is an automated message from ${context.tenantName} Help Desk.
Reply to this email if you need further assistance.
      `.trim(),
        };
    }

    /**
     * Get expected response time based on ticket status/priority
     */
    private static getExpectedResponseTime(status: string): string {
        // This would typically be based on SLA configuration
        switch (status.toLowerCase()) {
            case 'critical':
                return 'within 4 hours';
            case 'high':
                return 'within 24 hours';
            case 'medium':
                return 'within 3 business days';
            case 'low':
                return 'within 1 week';
            default:
                return 'within 2 business days';
        }
    }

    /**
     * Queue notification for later delivery (when service is unavailable)
     */
    static async queueNotification(
        type: string,
        context: NotificationContext
    ): Promise<void> {
        // In a real implementation, this would queue the notification in a database
        // or message queue for later processing when the service becomes available
        console.log(`Queuing ${type} notification for ticket ${context.ticketId}`);

        // Store in local storage or database for retry later
        const queuedNotification = {
            id: `notification_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            type,
            context,
            queuedAt: new Date().toISOString(),
            retryCount: 0,
        };

        // TODO: Implement actual queuing mechanism
        console.log('Queued notification:', queuedNotification);
    }

    /**
     * Process queued notifications (called periodically)
     */
    static async processQueuedNotifications(): Promise<void> {
        // TODO: Implement processing of queued notifications
        // This would be called by a background job or cron task
    }
}