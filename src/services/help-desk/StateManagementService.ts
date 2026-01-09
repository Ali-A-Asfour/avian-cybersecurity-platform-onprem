/**
 * State Management Service for Help Desk System
 * Handles ticket state transitions, validation, and business rules
 */

import { TicketStatus, UserRole } from '@/types';

export interface StateTransitionResult {
  valid: boolean;
  newStatus?: TicketStatus;
  error?: string;
}

export class StateManagementService {
  /**
   * Validate basic state transition rules
   */
  static validateStateTransition(
    currentStatus: TicketStatus,
    newStatus: TicketStatus
  ): StateTransitionResult {
    // Define valid state transitions
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.NEW]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_RESPONSE,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.IN_PROGRESS]: [
        TicketStatus.AWAITING_RESPONSE,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED,
        TicketStatus.NEW // Can go back to new if needed
      ],
      [TicketStatus.AWAITING_RESPONSE]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.RESOLVED]: [
        TicketStatus.CLOSED,
        TicketStatus.IN_PROGRESS, // Can reopen
        TicketStatus.NEW // Can reopen to new
      ],
      [TicketStatus.CLOSED]: [
        // Closed tickets generally cannot be reopened directly
        // This would require special permissions
      ]
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      return {
        valid: false,
        error: `Invalid state transition from ${currentStatus} to ${newStatus}`
      };
    }

    return {
      valid: true,
      newStatus
    };
  }

  /**
   * Validate state transition with business rules and role permissions
   */
  static validateStateTransitionWithBusinessRules(
    currentStatus: TicketStatus,
    newStatus: TicketStatus,
    userRole: UserRole,
    isSystemTriggered: boolean = false
  ): StateTransitionResult {
    // First check basic state transition validity
    const basicValidation = this.validateStateTransition(currentStatus, newStatus);
    if (!basicValidation.valid) {
      return basicValidation;
    }

    // Business rule: Only help desk analysts and tenant admins can close tickets
    if (newStatus === TicketStatus.CLOSED) {
      const canClose = [
        UserRole.IT_HELPDESK_ANALYST,
        UserRole.SECURITY_ANALYST,
        UserRole.TENANT_ADMIN,
        UserRole.SUPER_ADMIN
      ].includes(userRole);

      if (!canClose && !isSystemTriggered) {
        return {
          valid: false,
          error: 'Only help desk analysts and tenant admins can close tickets'
        };
      }
    }

    // Business rule: Users can reopen resolved tickets
    if (currentStatus === TicketStatus.RESOLVED && 
        (newStatus === TicketStatus.IN_PROGRESS || newStatus === TicketStatus.NEW)) {
      // This is allowed for any user (reopening resolved tickets)
      return {
        valid: true,
        newStatus
      };
    }

    return {
      valid: true,
      newStatus
    };
  }

  /**
   * Process complete state transition with all validations and side effects
   */
  static processStateTransition(
    ticketId: string,
    currentStatus: TicketStatus,
    newStatus: TicketStatus,
    userRole: UserRole,
    userId: string,
    isSystemTriggered: boolean = false
  ): StateTransitionResult {
    console.log('Processing state transition:', {
      ticketId,
      currentStatus,
      newStatus,
      userRole,
      userId,
      isSystemTriggered
    });

    // Validate with business rules
    const validation = this.validateStateTransitionWithBusinessRules(
      currentStatus,
      newStatus,
      userRole,
      isSystemTriggered
    );

    if (!validation.valid) {
      console.log('State transition validation failed:', validation.error);
      return validation;
    }

    // TODO: Add SLA timer updates, notifications, etc.
    console.log('State transition validated successfully');

    return {
      valid: true,
      newStatus
    };
  }

  /**
   * Initialize SLA timer for a ticket (placeholder)
   */
  static initializeSLATimer(
    ticketId: string,
    slaDeadline: Date,
    initialStatus: TicketStatus
  ): void {
    console.log('SLA timer initialized:', { ticketId, slaDeadline, initialStatus });
    // TODO: Implement SLA timer logic
  }
}