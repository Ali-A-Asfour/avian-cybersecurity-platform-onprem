/**
 * Manual test to verify workflow enforcement is working
 * This test directly calls the middleware functions to verify behavior
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateEscalationWorkflow } from '../incident-workflow.middleware';

// Mock database with controlled responses
jest.mock('../../lib/database', () => ({
    db: {
        select: jest.fn(),
    }
}));

import { db } from '../../lib/database';
const mockDb = db as jest.Mocked<typeof db>;

describe('Workflow Enforcement Manual Test', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';
    const mockAlertId = 'alert-789';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should enforce investigation requirement - block assigned status', async () => {
        // Mock alert in assigned status (should be blocked)
        const mockAlert = {
            id: mockAlertId,
            tenantId: mockTenantId,
            status: 'assigned',
            assignedTo: mockUserId,
            assignedAt: new Date(),
        };

        mockDb.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([mockAlert])
                })
            })
        } as any);

        const result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);

        // Verify escalation is blocked
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVESTIGATION_REQUIRED');
        expect(result.error?.message).toContain('Alert must be investigated before escalation');
        expect(result.error?.details?.currentStatus).toBe('assigned');
        expect(result.error?.details?.requiredStatus).toBe('investigating');
        expect(result.error?.details?.workflowStep).toBe('investigation_required');
        expect(result.error?.details?.nextAction).toContain('Click "Investigate"');

        console.log('✅ BLOCKED assigned status - Investigation required');
        console.log('Error message:', result.error?.message);
        console.log('Next action:', result.error?.details?.nextAction);
    });

    it('should allow escalation from investigating status', async () => {
        // Mock alert in investigating status (should be allowed)
        const mockAlert = {
            id: mockAlertId,
            tenantId: mockTenantId,
            status: 'investigating',
            assignedTo: mockUserId,
            assignedAt: new Date(),
        };

        mockDb.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([mockAlert])
                })
            })
        } as any);

        const result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);

        // Verify escalation is allowed
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();

        console.log('✅ ALLOWED investigating status - Escalation permitted');
    });

    it('should block escalation from open status', async () => {
        // Mock alert in open status (should be blocked)
        const mockAlert = {
            id: mockAlertId,
            tenantId: mockTenantId,
            status: 'open',
            assignedTo: null,
            assignedAt: null,
        };

        mockDb.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([mockAlert])
                })
            })
        } as any);

        const result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);

        // Verify escalation is blocked
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ESCALATION_DENIED');
        expect(result.error?.message).toContain('Alert must be assigned to you before escalation');
        expect(result.error?.details?.workflowStep).toBe('assignment_required');

        console.log('✅ BLOCKED open status - Assignment required');
        console.log('Error message:', result.error?.message);
    });

    it('should provide clear workflow guidance', async () => {
        const testCases = [
            {
                status: 'open',
                assignedTo: null,
                expectedCode: 'ESCALATION_DENIED',
                expectedStep: 'assignment_required'
            },
            {
                status: 'assigned',
                assignedTo: mockUserId,
                expectedCode: 'INVESTIGATION_REQUIRED',
                expectedStep: 'investigation_required'
            },
            {
                status: 'escalated',
                assignedTo: mockUserId,
                expectedCode: 'INVESTIGATION_REQUIRED',
                expectedStep: 'already_escalated'
            }
        ];

        for (const testCase of testCases) {
            const mockAlert = {
                id: mockAlertId,
                tenantId: mockTenantId,
                status: testCase.status,
                assignedTo: testCase.assignedTo,
                assignedAt: testCase.assignedTo ? new Date() : null,
            };

            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockAlert])
                    })
                })
            } as any);

            const result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(testCase.expectedCode);
            expect(result.error?.details?.workflowStep).toBe(testCase.expectedStep);
            expect(result.error?.details?.currentStatus).toBe(testCase.status);
            expect(result.error?.details?.requiredStatus).toBe('investigating');
            expect(result.error?.details?.nextAction).toBeDefined();

            console.log(`✅ Status ${testCase.status}: ${result.error?.message}`);
        }
    });
});