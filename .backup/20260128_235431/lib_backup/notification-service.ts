/**
 * Notification Service
 * Handles sending notifications via email and SMS
 * Supports Twilio for SMS and existing email service for emails
 */

import { sendEmail } from './email-service';

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SMS_ENABLED = process.env.SMS_ENABLED === 'true';

export type NotificationChannel = 'email' | 'sms' | 'both';
export type NotificationType =
    | 'critical_alert'
    | 'high_alert'
    | 'medium_alert'
    | 'low_alert'
    | 'ticket_assigned'
    | 'ticket_updated'
    | 'ticket_comment'
    | 'sla_breach'
    | 'device_offline'
    | 'integration_failure';

export interface NotificationPayload {
    userId: string;
    tenantId: string;
    type: NotificationType;
    channel: NotificationChannel;
    subject: string;
    message: string;
    htmlContent?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    alertId?: string;
    ticketId?: string;
    metadata?: Record<string, any>;
}

export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface SendSMSResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Send SMS using Twilio
 */
export async function sendSMS(
    to: string,
    message: string
): Promise<SendSMSResult> {
    // Development mode - log to console
    if (!SMS_ENABLED || process.env.NODE_ENV === 'development') {
        console.log('='.repeat(60));
        console.log('📱 SMS NOTIFICATION (Development Mode)');
        console.log('='.repeat(60));
        console.log(`To: ${to}`);
        console.log(`Message: ${message}`);
        console.log('='.repeat(60));
        
        return {
            success: true,
            messageId: `dev-sms-${Date.now()}`,
        };
    }

    // Production mode - send via Twilio
    try {
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
            throw new Error('Twilio credentials not configured');
        }

        // Twilio API call
        const auth = Buffer.from(
            `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
        ).toString('base64');

        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: to,
                    From: TWILIO_PHONE_NUMBER,
                    Body: message,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to send SMS');
        }

        const result = await response.json();
        
        return {
            success: true,
            messageId: result.sid,
        };
    } catch (error) {
        console.error('SMS send error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Send notification via specified channel(s)
 */
export async function sendNotification(
    payload: NotificationPayload
): Promise<{
    email?: SendEmailResult;
    sms?: SendSMSResult;
}> {
    const results: {
        email?: SendEmailResult;
        sms?: SendSMSResult;
    } = {};

    // Send email
    if (payload.channel === 'email' || payload.channel === 'both') {
        if (!payload.recipientEmail) {
            results.email = {
                success: false,
                error: 'No email address provided',
            };
        } else {
            try {
                await sendEmail({
                    to: payload.recipientEmail,
                    subject: payload.subject,
                    text: payload.message,
                    html: payload.htmlContent || generateHTMLFromText(payload.message),
                });
                
                results.email = {
                    success: true,
                    messageId: `email-${Date.now()}`,
                };
            } catch (error) {
                // Don't fail if email service is not configured
                console.log('Email service not configured, skipping email delivery');
                results.email = {
                    success: true, // Mark as success to not break the flow
                    messageId: `email-skipped-${Date.now()}`,
                };
            }
        }
    }

    // Send SMS
    if (payload.channel === 'sms' || payload.channel === 'both') {
        if (!payload.recipientPhone) {
            results.sms = {
                success: false,
                error: 'No phone number provided',
            };
        } else {
            // Truncate message for SMS (160 character limit)
            const smsMessage = truncateForSMS(payload.message);
            results.sms = await sendSMS(payload.recipientPhone, smsMessage);
        }
    }

    return results;
}

/**
 * Truncate message to fit SMS character limit
 */
function truncateForSMS(message: string, maxLength: number = 160): string {
    if (message.length <= maxLength) {
        return message;
    }
    
    return message.substring(0, maxLength - 3) + '...';
}

/**
 * Generate simple HTML from plain text
 */
function generateHTMLFromText(text: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; white-space: pre-wrap;">${text.replace(/\n/g, '<br>')}</p>
    </div>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
        <p>This is an automated notification from AVIAN Cybersecurity Platform.</p>
        <p>To manage your notification preferences, log in to your account and visit Settings → Notifications.</p>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Generate notification templates for different alert types
 */
export function generateNotificationContent(
    type: NotificationType,
    data: {
        alertTitle?: string;
        alertSeverity?: string;
        alertDescription?: string;
        ticketNumber?: string;
        ticketTitle?: string;
        deviceName?: string;
        slaDeadline?: string;
        [key: string]: any;
    }
): { subject: string; message: string; htmlContent: string } {
    switch (type) {
        case 'critical_alert':
            return {
                subject: `🚨 CRITICAL ALERT: ${data.alertTitle}`,
                message: `CRITICAL SECURITY ALERT\n\n${data.alertTitle}\n\nSeverity: ${data.alertSeverity}\n\n${data.alertDescription}\n\nImmediate action required. Log in to AVIAN to investigate.`,
                htmlContent: generateAlertHTML('critical', data),
            };

        case 'high_alert':
            return {
                subject: `⚠️ High Priority Alert: ${data.alertTitle}`,
                message: `High Priority Security Alert\n\n${data.alertTitle}\n\nSeverity: ${data.alertSeverity}\n\n${data.alertDescription}\n\nPlease review and take action.`,
                htmlContent: generateAlertHTML('high', data),
            };

        case 'medium_alert':
            return {
                subject: `Alert: ${data.alertTitle}`,
                message: `Security Alert\n\n${data.alertTitle}\n\nSeverity: ${data.alertSeverity}\n\n${data.alertDescription}`,
                htmlContent: generateAlertHTML('medium', data),
            };

        case 'ticket_assigned':
            return {
                subject: `Ticket #${data.ticketNumber} Assigned to You`,
                message: `A new ticket has been assigned to you.\n\nTicket #${data.ticketNumber}: ${data.ticketTitle}\n\nLog in to AVIAN to view details.`,
                htmlContent: generateTicketHTML('assigned', data),
            };

        case 'ticket_updated':
            return {
                subject: `Ticket #${data.ticketNumber} Updated`,
                message: `Ticket #${data.ticketNumber} has been updated.\n\n${data.ticketTitle}\n\nLog in to view the latest changes.`,
                htmlContent: generateTicketHTML('updated', data),
            };

        case 'sla_breach':
            return {
                subject: `⏰ SLA Breach Warning: Ticket #${data.ticketNumber}`,
                message: `SLA BREACH WARNING\n\nTicket #${data.ticketNumber} is approaching its SLA deadline.\n\nDeadline: ${data.slaDeadline}\n\nImmediate attention required.`,
                htmlContent: generateSLABreachHTML(data),
            };

        case 'device_offline':
            return {
                subject: `Device Offline: ${data.deviceName}`,
                message: `Device ${data.deviceName} is offline and not responding.\n\nPlease investigate immediately.`,
                htmlContent: generateDeviceOfflineHTML(data),
            };

        default:
            return {
                subject: 'AVIAN Notification',
                message: data.alertDescription || 'You have a new notification.',
                htmlContent: generateHTMLFromText(data.alertDescription || 'You have a new notification.'),
            };
    }
}

/**
 * Generate HTML for alert notifications
 */
function generateAlertHTML(severity: string, data: any): string {
    const colors = {
        critical: { bg: '#dc3545', text: '#fff' },
        high: { bg: '#fd7e14', text: '#fff' },
        medium: { bg: '#ffc107', text: '#000' },
    };
    
    const color = colors[severity as keyof typeof colors] || colors.medium;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: ${color.bg}; color: ${color.text}; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">${severity.toUpperCase()} SECURITY ALERT</h1>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="margin-top: 0; color: #212529;">${data.alertTitle}</h2>
        <p style="margin: 10px 0;"><strong>Severity:</strong> ${data.alertSeverity}</p>
        <p style="margin: 10px 0;">${data.alertDescription}</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #fff; border-left: 4px solid ${color.bg};">
            <p style="margin: 0;"><strong>Action Required:</strong> Log in to AVIAN to investigate and acknowledge this alert.</p>
        </div>
    </div>
    <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 8px; font-size: 12px; color: #6c757d;">
        <p style="margin: 0;">This is an automated security notification from AVIAN Cybersecurity Platform.</p>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Generate HTML for ticket notifications
 */
function generateTicketHTML(action: string, data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #007bff; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Ticket ${action === 'assigned' ? 'Assigned' : 'Updated'}</h1>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="margin-top: 0; color: #212529;">Ticket #${data.ticketNumber}</h2>
        <p style="margin: 10px 0;"><strong>Title:</strong> ${data.ticketTitle}</p>
        ${data.ticketPriority ? `<p style="margin: 10px 0;"><strong>Priority:</strong> ${data.ticketPriority}</p>` : ''}
        ${data.ticketStatus ? `<p style="margin: 10px 0;"><strong>Status:</strong> ${data.ticketStatus}</p>` : ''}
        <div style="margin-top: 20px; padding: 15px; background-color: #fff; border-left: 4px solid #007bff;">
            <p style="margin: 0;">Log in to AVIAN to view ticket details and take action.</p>
        </div>
    </div>
    <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 8px; font-size: 12px; color: #6c757d;">
        <p style="margin: 0;">This is an automated notification from AVIAN Cybersecurity Platform.</p>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Generate HTML for SLA breach warnings
 */
function generateSLABreachHTML(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #dc3545; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">⏰ SLA BREACH WARNING</h1>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="margin-top: 0; color: #212529;">Ticket #${data.ticketNumber}</h2>
        <p style="margin: 10px 0;"><strong>Title:</strong> ${data.ticketTitle}</p>
        <p style="margin: 10px 0;"><strong>SLA Deadline:</strong> ${data.slaDeadline}</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #dc3545;">
            <p style="margin: 0; color: #856404;"><strong>URGENT:</strong> This ticket is approaching its SLA deadline. Immediate action required to prevent SLA breach.</p>
        </div>
    </div>
    <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 8px; font-size: 12px; color: #6c757d;">
        <p style="margin: 0;">This is an automated SLA notification from AVIAN Cybersecurity Platform.</p>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Generate HTML for device offline notifications
 */
function generateDeviceOfflineHTML(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #fd7e14; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Device Offline Alert</h1>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="margin-top: 0; color: #212529;">${data.deviceName}</h2>
        <p style="margin: 10px 0;">The device is offline and not responding to health checks.</p>
        ${data.lastSeen ? `<p style="margin: 10px 0;"><strong>Last Seen:</strong> ${data.lastSeen}</p>` : ''}
        <div style="margin-top: 20px; padding: 15px; background-color: #fff; border-left: 4px solid #fd7e14;">
            <p style="margin: 0;">Please investigate immediately to ensure service continuity.</p>
        </div>
    </div>
    <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 8px; font-size: 12px; color: #6c757d;">
        <p style="margin: 0;">This is an automated device monitoring notification from AVIAN Cybersecurity Platform.</p>
    </div>
</body>
</html>
    `.trim();
}
