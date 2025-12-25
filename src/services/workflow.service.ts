import { TicketService } from './ticket.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';
import { 
  Ticket, 
  TicketStatus, 
  TicketSeverity, 
  UserRole,
  User 
} from '@/types';

export interface EscalationRule {
  severity: TicketSeverity;
  hoursBeforeEscalation: number;
  escalateTo: UserRole[];
}

export interface WorkloadMetrics {
  userId: string;
  openTickets: number;
  criticalTickets: number;
  workloadScore: number;
}

export class WorkflowService {
  private static readonly ESCALATION_RULES: EscalationRule[] = [
    {
      severity: TicketSeverity.CRITICAL,
      hoursBeforeEscalation: 2,
      escalateTo: [UserRole.TENANT_ADMIN],
    },
    {
      severity: TicketSeverity.HIGH,
      hoursBeforeEscalation: 8,
      escalateTo: [UserRole.TENANT_ADMIN],
    },
    {
      severity: TicketSeverity.MEDIUM,
      hoursBeforeEscalation: 24,
      escalateTo: [UserRole.TENANT_ADMIN],
    },
    {
      severity: TicketSeverity.LOW,
      hoursBeforeEscalation: 72,
      escalateTo: [UserRole.TENANT_ADMIN],
    },
  ];

  /**
   * Check for tickets that need escalation
   */
  static async checkForEscalations(_tenantId: string): Promise<void> {
    try {
      const overdueTickets = await TicketService.getOverdueTickets(tenantId);
      
      for (const ticket of overdueTickets) {
        await this.processTicketEscalation(tenantId, ticket);
      }
    } catch (error) {
      console.error('Error checking for escalations:', error);
    }
  }

  /**
   * Process escalation for a specific ticket
   */
  private static async processTicketEscalation(tenantId: string, ticket: Ticket): Promise<void> {
    const escalationRule = this.ESCALATION_RULES.find(rule => rule.severity === ticket.severity);
    if (!escalationRule) return;

    const now = new Date();
    const slaDeadline = new Date(ticket.sla_deadline!);
    const hoursOverdue = Math.floor((now.getTime() - slaDeadline.getTime()) / (1000 * 60 * 60));

    if (hoursOverdue >= escalationRule.hoursBeforeEscalation) {
      // Find users to escalate to
      const escalationUsers = await UserService.getUsersByRoles(tenantId, escalationRule.escalateTo);
      
      for (const user of escalationUsers) {
        await NotificationService.sendEscalationNotification(
          tenantId,
          ticket.id,
          user.id,
          ticket.title,
          `Ticket overdue by ${hoursOverdue} hours`
        );
      }

      // If ticket has an assignee, also notify them about the escalation
      if (ticket.assignee) {
        const assignee = await UserService.getUserByEmailSimple(tenantId, ticket.assignee);
        if (assignee) {
          await NotificationService.sendSLABreachNotification(
            tenantId,
            ticket.id,
            assignee.id,
            ticket.title,
            hoursOverdue
          );
        }
      }
    }
  }

  /**
   * Monitor SLA breaches and send notifications
   */
  static async monitorSLABreaches(_tenantId: string): Promise<void> {
    try {
      const overdueTickets = await TicketService.getOverdueTickets(tenantId);
      
      for (const ticket of overdueTickets) {
        if (ticket.assignee) {
          const assignee = await UserService.getUserByEmailSimple(tenantId, ticket.assignee);
          if (assignee) {
            const now = new Date();
            const slaDeadline = new Date(ticket.sla_deadline!);
            const hoursOverdue = Math.floor((now.getTime() - slaDeadline.getTime()) / (1000 * 60 * 60));

            await NotificationService.sendSLABreachNotification(
              tenantId,
              ticket.id,
              assignee.id,
              ticket.title,
              hoursOverdue
            );
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring SLA breaches:', error);
    }
  }

  /**
   * Assign ticket based on workload balancing
   */
  static async assignTicketWithWorkloadBalancing(
    tenantId: string,
    ticketId: string,
    severity: TicketSeverity
  ): Promise<string | null> {
    try {
      // Get available analysts
      const analysts = await UserService.getUsersByRoles(tenantId, [UserRole.SECURITY_ANALYST, UserRole.IT_HELPDESK_ANALYST]);
      
      if (analysts.length === 0) {
        return null;
      }

      // Calculate workload for each analyst
      const workloadMetrics = await Promise.all(
        analysts.map((analyst: User) => this.calculateUserWorkload(tenantId, analyst.id))
      );

      // Sort by workload score (lower is better)
      workloadMetrics.sort((a: WorkloadMetrics, b: WorkloadMetrics) => a.workloadScore - b.workloadScore);

      // Assign to analyst with lowest workload
      const selectedAnalyst = analysts.find((a: User) => a.id === workloadMetrics[0].userId);
      
      if (selectedAnalyst) {
        await TicketService.updateTicket(tenantId, ticketId, {
          assignee: selectedAnalyst.email,
        });

        await NotificationService.sendTicketAssignmentNotification(
          tenantId,
          ticketId,
          selectedAnalyst.id,
          `Ticket #${ticketId.slice(0, 8)}`,
          'System (Auto-assignment)'
        );

        return selectedAnalyst.email;
      }

      return null;
    } catch (error) {
      console.error('Error assigning ticket with workload balancing:', error);
      return null;
    }
  }

  /**
   * Calculate workload metrics for a user
   */
  private static async calculateUserWorkload(tenantId: string, userId: string): Promise<WorkloadMetrics> {
    try {
      const _user = await UserService.getUserByIdSimple(tenantId, userId);
      if (!user) {
        return {
          userId,
          openTickets: 0,
          criticalTickets: 0,
          workloadScore: 0,
        };
      }

      // Get user's open tickets
      const { tickets } = await TicketService.getTickets(tenantId, {
        assignee: user.email,
        status: [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE],
        limit: 1000, // Get all open tickets
      });

      const openTickets = tickets.length;
      const criticalTickets = tickets.filter(t => 
        t.severity === TicketSeverity.CRITICAL || t.severity === TicketSeverity.HIGH
      ).length;

      // Calculate workload score (higher score = more loaded)
      // Critical tickets count more heavily
      const workloadScore = openTickets + (criticalTickets * 2);

      return {
        userId,
        openTickets,
        criticalTickets,
        workloadScore,
      };
    } catch (error) {
      console.error('Error calculating user workload:', error);
      return {
        userId,
        openTickets: 0,
        criticalTickets: 0,
        workloadScore: 0,
      };
    }
  }

  /**
   * Handle ticket status change workflow
   */
  static async handleStatusChange(
    tenantId: string,
    ticketId: string,
    oldStatus: TicketStatus,
    newStatus: TicketStatus,
    changedBy: string
  ): Promise<void> {
    try {
      const ticket = await TicketService.getTicketById(tenantId, ticketId);
      if (!ticket) return;

      // Send notifications to relevant users
      const notificationTargets: string[] = [];

      // Always notify the requester
      const requester = await UserService.getUserByEmailSimple(tenantId, ticket.requester);
      if (requester) {
        notificationTargets.push(requester.id);
      }

      // Notify assignee if different from requester
      if (ticket.assignee && ticket.assignee !== ticket.requester) {
        const assignee = await UserService.getUserByEmailSimple(tenantId, ticket.assignee);
        if (assignee) {
          notificationTargets.push(assignee.id);
        }
      }

      // Send notifications
      for (const userId of notificationTargets) {
        await NotificationService.sendTicketStatusChangeNotification(
          tenantId,
          ticketId,
          userId,
          ticket.title,
          oldStatus,
          newStatus,
          changedBy
        );
      }

      // Handle specific status transitions
      if (newStatus === TicketStatus.RESOLVED) {
        await this.handleTicketResolution(tenantId, ticket);
      } else if (newStatus === TicketStatus.CLOSED) {
        await this.handleTicketClosure(tenantId, ticket);
      }
    } catch (error) {
      console.error('Error handling status change:', error);
    }
  }

  /**
   * Handle ticket resolution workflow
   */
  private static async handleTicketResolution(tenantId: string, ticket: Ticket): Promise<void> {
    // Could add additional logic here, such as:
    // - Updating SLA metrics
    // - Triggering customer satisfaction surveys
    // - Updating knowledge base
    console.log(`Ticket ${ticket.id} resolved`);
  }

  /**
   * Handle ticket closure workflow
   */
  private static async handleTicketClosure(tenantId: string, ticket: Ticket): Promise<void> {
    // Could add additional logic here, such as:
    // - Final SLA calculations
    // - Archiving ticket data
    // - Generating closure reports
    console.log(`Ticket ${ticket.id} closed`);
  }

  /**
   * Reassign ticket to another user
   */
  static async reassignTicket(
    tenantId: string,
    ticketId: string,
    newAssignee: string,
    reassignedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      const ticket = await TicketService.getTicketById(tenantId, ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      const oldAssignee = ticket.assignee;

      // Update ticket assignment
      await TicketService.updateTicket(tenantId, ticketId, {
        assignee: newAssignee,
      });

      // Notify new assignee
      const newAssigneeUser = await UserService.getUserByEmailSimple(tenantId, newAssignee);
      if (newAssigneeUser) {
        await NotificationService.sendTicketAssignmentNotification(
          tenantId,
          ticketId,
          newAssigneeUser.id,
          ticket.title,
          reassignedBy
        );
      }

      // Notify old assignee if they exist
      if (oldAssignee && oldAssignee !== newAssignee) {
        const oldAssigneeUser = await UserService.getUserByEmailSimple(tenantId, oldAssignee);
        if (oldAssigneeUser) {
          await NotificationService.createNotification(tenantId, {
            user_id: oldAssigneeUser.id,
            title: 'Ticket Reassigned',
            message: `Ticket "${ticket.title}" has been reassigned to ${newAssignee}${reason ? `. Reason: ${reason}` : '.'}`,
            type: 'info',
            metadata: {
              ticket_id: ticketId,
              new_assignee: newAssignee,
              reason,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error reassigning ticket:', error);
      throw error;
    }
  }

  /**
   * Get workload summary for all analysts
   */
  static async getWorkloadSummary(_tenantId: string): Promise<WorkloadMetrics[]> {
    try {
      const analysts = await UserService.getUsersByRoles(tenantId, [UserRole.SECURITY_ANALYST, UserRole.IT_HELPDESK_ANALYST]);
      
      const workloadMetrics = await Promise.all(
        analysts.map((analyst: User) => this.calculateUserWorkload(tenantId, analyst.id))
      );

      return workloadMetrics.sort((a: WorkloadMetrics, b: WorkloadMetrics) => b.workloadScore - a.workloadScore);
    } catch (error) {
      console.error('Error getting workload summary:', error);
      return [];
    }
  }
}