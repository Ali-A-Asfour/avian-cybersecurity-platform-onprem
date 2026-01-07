import { NextRequest, NextResponse } from 'next/server';
import { AlertService } from '@/services/alert.service';
import { TicketService } from '@/services/ticket.service';
import { NotificationService } from '@/services/notification.service';
import { UserService } from '@/services/user.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { 
  TicketCategory, 
  TicketSeverity, 
  TicketPriority, 
  AlertSeverity,
  UserRole 
} from '@/types';

interface EscalateAlertRequest {
  incident_title?: string;
  incident_description?: string;
  assignee?: string;
  priority?: TicketPriority;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(authResult, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json(tenantResult, { status: 403 });
    }

    const user = authResult.user!;
    const tenant = tenantResult.tenant!;
    const { id: alertId } = await params;

    // Only Security Analysts can escalate alerts to incidents
    if (user.role !== UserRole.SECURITY_ANALYST) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only Security Analysts can escalate alerts to incidents',
          },
        },
        { status: 403 }
      );
    }

    // Get the alert
    const alertResult = await AlertService.getAlertById(tenant.id, alertId);
    if (!alertResult.success || !alertResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALERT_NOT_FOUND',
            message: 'Alert not found',
          },
        },
        { status: 404 }
      );
    }

    const alert = alertResult.data;

    // Parse request body
    const body: EscalateAlertRequest = await request.json().catch(() => ({}));

    // Map alert severity to ticket severity
    const severityMapping: Record<AlertSeverity, TicketSeverity> = {
      'critical': TicketSeverity.CRITICAL,
      'high': TicketSeverity.HIGH,
      'medium': TicketSeverity.MEDIUM,
      'low': TicketSeverity.LOW,
      'info': TicketSeverity.LOW,
    };

    // Generate incident title and description
    const incidentTitle = body.incident_title || `Security Incident: ${alert.title}`;
    const incidentDescription = body.incident_description || 
      `This incident was automatically escalated from a ${alert.severity} severity alert.

**Original Alert Details:**
- Alert ID: ${alert.id}
- Source: ${alert.source}
- Category: ${alert.category}
- Severity: ${alert.severity}
- Created: ${new Date(alert.created_at).toLocaleString()}

**Alert Description:**
${alert.description}

**Alert Metadata:**
${JSON.stringify(alert.metadata, null, 2)}

**Recommended Actions:**
1. Investigate the alert details and metadata
2. Assess the potential impact and scope
3. Implement containment measures if necessary
4. Document findings and response actions
5. Update incident status as investigation progresses`;

    // Determine ticket priority
    const ticketPriority = body.priority || 
      (alert.severity === 'critical' ? TicketPriority.URGENT : TicketPriority.HIGH);

    // Create incident ticket
    const incidentTicket = await TicketService.createTicket(
      tenant.id,
      user.user_id,
      {
        requester: user.email,
        assignee: body.assignee,
        title: incidentTitle,
        description: incidentDescription,
        category: TicketCategory.SECURITY_INCIDENT,
        severity: severityMapping[alert.severity],
        priority: ticketPriority,
        tags: [
          'incident',
          'escalated-from-alert',
          alert.category,
          alert.severity,
          `source-${alert.source.toLowerCase().replace(/\s+/g, '-')}`
        ],
      }
    );

    // Update alert status to indicate escalation
    await AlertService.escalateToIncident(tenant.id, alertId, incidentTicket.id, user.user_id);

    // Get tenant admin users for notification
    const tenantAdmins = await UserService.getUsersByRoles(
      tenant.id, 
      [UserRole.TENANT_ADMIN]
    );

    // Send notifications to tenant admins
    const notificationPromises = tenantAdmins.map(async (admin) => {
      // Create incident summary email template
      const emailTemplate = {
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
                <strong>Incident ID:</strong> ${incidentTicket.id}<br>
                <strong>Title:</strong> ${incidentTitle}<br>
                <strong>Severity:</strong> ${severityMapping[alert.severity].toUpperCase()}<br>
                <strong>Priority:</strong> ${ticketPriority.toUpperCase()}<br>
                <strong>Escalated by:</strong> ${user.first_name} ${user.last_name} (${user.email})<br>
                <strong>Created:</strong> ${new Date().toLocaleString()}<br>
                ${body.assignee ? `<strong>Assigned to:</strong> ${body.assignee}<br>` : ''}
              </div>

              <div style="background-color: white; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #f59e0b;">Original Alert Information</h3>
                <strong>Alert ID:</strong> ${alert.id}<br>
                <strong>Source:</strong> ${alert.source}<br>
                <strong>Category:</strong> ${alert.category}<br>
                <strong>Alert Severity:</strong> ${alert.severity.toUpperCase()}<br>
                <strong>Alert Created:</strong> ${new Date(alert.created_at).toLocaleString()}<br>
              </div>

              <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #92400e;">⚠️ Action Required</h3>
                <p style="margin-bottom: 0;">This incident requires immediate review and response. Please log into the AVIAN platform to assess the situation and coordinate the response.</p>
              </div>

              <div style="text-align: center; margin: 20px 0;">
                <a href="/tickets/${incidentTicket.id}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Incident</a>
                <a href="/alerts/${alert.id}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-left: 10px;">View Original Alert</a>
              </div>

              <div style="background-color: #e5e7eb; padding: 10px; border-radius: 5px; margin-top: 20px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280;">
                  This is an automated notification from the AVIAN Cybersecurity Platform for ${tenant.name}.
                </p>
              </div>
            </div>
          </div>
        `,
        textBody: `
🚨 SECURITY INCIDENT ALERT

A security analyst has escalated an alert to a formal incident that requires immediate attention.

INCIDENT DETAILS:
- Incident ID: ${incidentTicket.id}
- Title: ${incidentTitle}
- Severity: ${severityMapping[alert.severity].toUpperCase()}
- Priority: ${ticketPriority.toUpperCase()}
- Escalated by: ${user.first_name} ${user.last_name} (${user.email})
- Created: ${new Date().toLocaleString()}
${body.assignee ? `- Assigned to: ${body.assignee}` : ''}

ORIGINAL ALERT INFORMATION:
- Alert ID: ${alert.id}
- Source: ${alert.source}
- Category: ${alert.category}
- Alert Severity: ${alert.severity.toUpperCase()}
- Alert Created: ${new Date(alert.created_at).toLocaleString()}

⚠️ ACTION REQUIRED
This incident requires immediate review and response. Please log into the AVIAN platform to assess the situation and coordinate the response.

View Incident: /tickets/${incidentTicket.id}
View Original Alert: /alerts/${alert.id}

This is an automated notification from the AVIAN Cybersecurity Platform for ${tenant.name}.
        `,
      };

      // Send comprehensive notification (in-app + email)
      return NotificationService.sendComprehensiveNotification(
        tenant.id,
        admin.id,
        {
          user_id: admin.id,
          title: '🚨 Security Incident Created',
          message: `Security incident "${incidentTitle}" has been created and requires immediate attention.`,
          type: 'error',
          metadata: {
            incident_id: incidentTicket.id,
            alert_id: alert.id,
            severity: severityMapping[alert.severity],
            priority: ticketPriority,
            escalated_by: user.user_id,
          },
        },
        emailTemplate,
        { email_enabled: true } // Force email for security incidents
      );
    });

    // Wait for all notifications to be sent
    await Promise.all(notificationPromises);

    // Return success response with incident details
    return NextResponse.json({
      success: true,
      data: {
        incident: incidentTicket,
        alert: {
          ...alert,
          status: 'investigating',
          escalated_to_incident: incidentTicket.id,
        },
        notifications_sent: tenantAdmins.length,
        message: `Alert successfully escalated to incident ${incidentTicket.id}. ${tenantAdmins.length} tenant admin(s) have been notified.`,
      },
    });

  } catch (error) {
    console.error('Error escalating alert to incident:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ESCALATION_ERROR',
          message: 'Failed to escalate alert to incident',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}