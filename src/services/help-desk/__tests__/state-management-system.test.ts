/**
 * Help Desk State Management System Tests
 * 
 * **Feature: avian-help-desk**
 * **Properties: 16, 17, 18 - State Management System**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**
 * 
 * Tests the complete state management system including:
 * - State transition validation (Property 16)
 * - SLA timer management (Property 17) 
 * - Manual closure requirement (Property 18)
 */

import { TicketStatus, TicketSeverity } from '@/types';

// State Management Service Implementation
class StateManagementService {
    private static readonly STATE_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
        [TicketStatus.NEW]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
        [TicketStatus.IN_PROGRESS]: [TicketStatus.AWAITING_RESPONSE, TicketStatus.RESOLVED, TicketStatus.CLOSED],
        [TicketStatus.AWAITING_RESPONSE]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED],
        [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
        [TicketStatus.CLOSED]: [], // Requirement 8.6: No transitions from closed
    };

    private static readonly SLA_PAUSED_STATES = [
        TicketStatus.AWAITING_RESPONSE, // Requirement 8.5: Pause on "Waiting on User"
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
    ];

    static validateStateTransition(currentStatus: TicketStatus, newStatus: TicketStatus) {
        if (currentStatus === newStatus) {
            return { valid: true, newStatus };
        }

        const allowedTransitions = this.STATE_TRANSITIONS[currentStatus];
        if (!allowedTransitions.includes(newStatus)) {
            return {
                valid: false,
                error: `Invalid state transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`
            };
        }

        return { valid: true, newStatus };
    }

    static getValidNextStates(currentStatus: TicketStatus): TicketStatus[] {
        return this.STATE_TRANSITIONS[currentStatus] || [];
    }

    static getInitialState(): TicketStatus {
        return TicketStatus.NEW; // Requirement 8.1
    }

    static canAutoClose(): boolean {
        return false; // Requirement 8.6: No automatic closure
    }

    static shouldPauseSLA(status: TicketStatus): boolean {
        return this.SLA_PAUSED_STATES.includes(status);
    }

    static validateBusinessRules(currentStatus: TicketStatus, newStatus: TicketStatus, userRole: string, isAssigned: boolean) {
        const basicValidation = this.validateStateTransition(currentStatus, newStatus);
        if (!basicValidation.valid) {
            return basicValidation;
        }

        // Business rule: Only assigned tickets can be moved to IN_PROGRESS
        if (newStatus === TicketStatus.IN_PROGRESS && !isAssigned) {
            return { valid: false, error: 'Ticket must be assigned before moving to In Progress' };
        }

        // Business rule: Only analysts can resolve tickets
        if (newStatus === TicketStatus.RESOLVED && !['security_analyst', 'it_helpdesk_analyst'].includes(userRole)) {
            return { valid: false, error: 'Only help desk analysts can resolve tickets' };
        }

        // Business rule: Only analysts can close tickets (Requirement 8.6)
        if (newStatus === TicketStatus.CLOSED && !['security_analyst', 'it_helpdesk_analyst', 'tenant_admin'].includes(userRole)) {
            return { valid: false, error: 'Only help desk analysts and tenant admins can close tickets' };
        }

        return { valid: true };
    }
}

// SLA Timer Service Implementation
class SLATimerService {
    private static readonly DEFAULT_SLA_HOURS: Record<TicketSeverity, number> = {
        [TicketSeverity.CRITICAL]: 4,
        [TicketSeverity.HIGH]: 24,
        [TicketSeverity.MEDIUM]: 72,
        [TicketSeverity.LOW]: 168,
    };

    static calculateInitialSLADeadline(severity: TicketSeverity, createdAt: Date, customHours?: number): Date {
        const hours = customHours ?? this.DEFAULT_SLA_HOURS[severity];
        const deadline = new Date(createdAt);
        deadline.setHours(deadline.getHours() + hours);
        return deadline;
    }

    static calculateEffectiveSLADeadline(originalDeadline: Date, statusHistory: Array<{ status: TicketStatus, timestamp: Date }>): Date {
        let totalPausedMs = 0;
        let currentPauseStart: Date | null = null;

        for (const { status, timestamp } of statusHistory) {
            if (StateManagementService.shouldPauseSLA(status)) {
                if (!currentPauseStart) currentPauseStart = timestamp;
            } else if (currentPauseStart) {
                totalPausedMs += timestamp.getTime() - currentPauseStart.getTime();
                currentPauseStart = null;
            }
        }

        return new Date(originalDeadline.getTime() + totalPausedMs);
    }

    static getSLAStatus(originalDeadline: Date, statusHistory: Array<{ status: TicketStatus, timestamp: Date }>, currentStatus: TicketStatus) {
        const effectiveDeadline = this.calculateEffectiveSLADeadline(originalDeadline, statusHistory);
        const remainingMs = effectiveDeadline.getTime() - Date.now();
        const isPaused = StateManagementService.shouldPauseSLA(currentStatus);

        let status: 'on_time' | 'at_risk' | 'breached' | 'paused' | 'completed';

        if (currentStatus === TicketStatus.CLOSED) {
            status = 'completed';
        } else if (isPaused) {
            status = 'paused';
        } else if (remainingMs < 0) {
            status = 'breached';
        } else if (remainingMs < 2 * 60 * 60 * 1000) {
            status = 'at_risk';
        } else {
            status = 'on_time';
        }

        return { status, effectiveDeadline, remainingMs, isPaused };
    }
}

describe('Help Desk State Management System', () => {
    describe('Property 16: State Transition Consistency (Requirements 8.1-8.4)', () => {
        it('should only allow valid state transitions according to the state machine', () => {
            // Test valid transitions
            expect(StateManagementService.validateStateTransition(TicketStatus.NEW, TicketStatus.IN_PROGRESS).valid).toBe(true);
            expect(StateManagementService.validateStateTransition(TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED).valid).toBe(true);
            expect(StateManagementService.validateStateTransition(TicketStatus.RESOLVED, TicketStatus.CLOSED).valid).toBe(true);

            // Test invalid transitions
            expect(StateManagementService.validateStateTransition(TicketStatus.CLOSED, TicketStatus.NEW).valid).toBe(false);
            expect(StateManagementService.validateStateTransition(TicketStatus.NEW, TicketStatus.RESOLVED).valid).toBe(false);
        });

        it('should return NEW as initial state (Requirement 8.1)', () => {
            expect(StateManagementService.getInitialState()).toBe(TicketStatus.NEW);
        });

        it('should return valid next states for each status', () => {
            expect(StateManagementService.getValidNextStates(TicketStatus.NEW)).toContain(TicketStatus.IN_PROGRESS);
            expect(StateManagementService.getValidNextStates(TicketStatus.CLOSED)).toHaveLength(0);
        });

        it('should enforce business rules for state transitions', () => {
            // Test assignment requirement for IN_PROGRESS
            expect(StateManagementService.validateBusinessRules(
                TicketStatus.NEW, TicketStatus.IN_PROGRESS, 'security_analyst', false
            ).valid).toBe(false);

            // Test analyst requirement for RESOLVED
            expect(StateManagementService.validateBusinessRules(
                TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, 'user', true
            ).valid).toBe(false);

            // Test analyst requirement for CLOSED
            expect(StateManagementService.validateBusinessRules(
                TicketStatus.RESOLVED, TicketStatus.CLOSED, 'user', true
            ).valid).toBe(false);
        });
    });

    describe('Property 17: SLA Timer Management (Requirement 8.5)', () => {
        it('should correctly identify SLA pause states', () => {
            expect(StateManagementService.shouldPauseSLA(TicketStatus.AWAITING_RESPONSE)).toBe(true);
            expect(StateManagementService.shouldPauseSLA(TicketStatus.RESOLVED)).toBe(true);
            expect(StateManagementService.shouldPauseSLA(TicketStatus.CLOSED)).toBe(true);
            expect(StateManagementService.shouldPauseSLA(TicketStatus.NEW)).toBe(false);
            expect(StateManagementService.shouldPauseSLA(TicketStatus.IN_PROGRESS)).toBe(false);
        });

        it('should calculate initial SLA deadline correctly', () => {
            const createdAt = new Date('2024-01-01T10:00:00Z');
            const deadline = SLATimerService.calculateInitialSLADeadline(TicketSeverity.CRITICAL, createdAt);

            expect(deadline.getTime()).toBeGreaterThan(createdAt.getTime());
            expect(deadline.getHours() - createdAt.getHours()).toBe(4); // 4 hours for critical
        });

        it('should calculate effective SLA deadline accounting for paused periods', () => {
            const originalDeadline = new Date('2024-01-01T14:00:00Z');
            const statusHistory = [
                { status: TicketStatus.NEW, timestamp: new Date('2024-01-01T10:00:00Z') },
                { status: TicketStatus.AWAITING_RESPONSE, timestamp: new Date('2024-01-01T11:00:00Z') },
                { status: TicketStatus.IN_PROGRESS, timestamp: new Date('2024-01-01T12:00:00Z') }
            ];

            const effectiveDeadline = SLATimerService.calculateEffectiveSLADeadline(originalDeadline, statusHistory);

            // Should be 1 hour later due to 1 hour pause
            expect(effectiveDeadline.getTime()).toBeGreaterThan(originalDeadline.getTime());
        });

        it('should provide correct SLA status information', () => {
            const originalDeadline = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now
            const statusHistory = [{ status: TicketStatus.NEW, timestamp: new Date() }];

            const slaStatus = SLATimerService.getSLAStatus(originalDeadline, statusHistory, TicketStatus.IN_PROGRESS);

            expect(slaStatus.status).toBe('on_time');
            expect(slaStatus.isPaused).toBe(false);
        });
    });

    describe('Property 18: Manual Closure Requirement (Requirement 8.6)', () => {
        it('should never allow automatic closure', () => {
            expect(StateManagementService.canAutoClose()).toBe(false);
        });

        it('should not allow transitions from CLOSED state', () => {
            const allStatuses = [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE, TicketStatus.RESOLVED];

            for (const status of allStatuses) {
                const result = StateManagementService.validateStateTransition(TicketStatus.CLOSED, status);
                expect(result.valid).toBe(false);
            }
        });

        it('should require analyst role for closure', () => {
            const result = StateManagementService.validateBusinessRules(
                TicketStatus.RESOLVED,
                TicketStatus.CLOSED,
                'user',
                true
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('analysts');
        });

        it('should allow analysts and tenant admins to close tickets', () => {
            const analystResult = StateManagementService.validateBusinessRules(
                TicketStatus.RESOLVED,
                TicketStatus.CLOSED,
                'security_analyst',
                true
            );
            expect(analystResult.valid).toBe(true);

            const adminResult = StateManagementService.validateBusinessRules(
                TicketStatus.RESOLVED,
                TicketStatus.CLOSED,
                'tenant_admin',
                true
            );
            expect(adminResult.valid).toBe(true);
        });
    });

    describe('Integration Tests', () => {
        it('should handle complete ticket lifecycle', () => {
            // Test complete workflow: NEW -> IN_PROGRESS -> AWAITING_RESPONSE -> IN_PROGRESS -> RESOLVED -> CLOSED
            const transitions = [
                { from: TicketStatus.NEW, to: TicketStatus.IN_PROGRESS },
                { from: TicketStatus.IN_PROGRESS, to: TicketStatus.AWAITING_RESPONSE },
                { from: TicketStatus.AWAITING_RESPONSE, to: TicketStatus.IN_PROGRESS },
                { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED },
                { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED }
            ];

            for (const { from, to } of transitions) {
                const result = StateManagementService.validateStateTransition(from, to);
                expect(result.valid).toBe(true);
            }
        });

        it('should maintain SLA timer consistency across state changes', () => {
            const createdAt = new Date('2024-01-01T10:00:00Z');
            const originalDeadline = SLATimerService.calculateInitialSLADeadline(TicketSeverity.HIGH, createdAt);

            const statusHistory = [
                { status: TicketStatus.NEW, timestamp: new Date('2024-01-01T10:00:00Z') },
                { status: TicketStatus.IN_PROGRESS, timestamp: new Date('2024-01-01T11:00:00Z') },
                { status: TicketStatus.AWAITING_RESPONSE, timestamp: new Date('2024-01-01T12:00:00Z') },
                { status: TicketStatus.IN_PROGRESS, timestamp: new Date('2024-01-01T14:00:00Z') }
            ];

            const slaStatus = SLATimerService.getSLAStatus(originalDeadline, statusHistory, TicketStatus.IN_PROGRESS);

            expect(slaStatus.effectiveDeadline.getTime()).toBeGreaterThan(originalDeadline.getTime());
            expect(slaStatus.isPaused).toBe(false);
        });
    });
});