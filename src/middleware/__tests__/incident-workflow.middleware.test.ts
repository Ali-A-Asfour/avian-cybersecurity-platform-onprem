/**
 * Tests for Incident Workflow Validation Middleware
 * 
 * Verifies enforcement of single Security Incident creation path:
 * Alert → Assigned → Investigate → Escalate → Security Incident
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
    validateEscalationWorkflow,
    validateNoDirectIncidentCreation,
    validateIncidentWorkflow
} from '../incident-workflow.middleware';
import { db } from '../../lib/database';
import { securityAlerts } from '../../../database/schemas/alerts-incidents';
import { eq } from 'drizzle-orm';

// Mock database
jest.mock('../../lib/database', () => ({
    db: {
        select: jest.fn(),
    }
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('Incident Workflow Middleware', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';
    const mockAlertId = 'alert-789';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('validateEscalationWorkflow', () => {
        it('should allow escalation when alert is in investigating status and assigned to user', async () => {
            // Mock alert in investigating status
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

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should block escalation when alert is in assigned status (investigation required)', async () => {
            // Mock alert in assigned status (not yet investigated)
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

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVESTIGATION_REQUIRED');
            expect(result.error?.message).toContain('Alert must be investigated before escalation');
            expect(result.error?.details?.currentStatus).toBe('assigned');
            expect(result.error?.details?.requiredStatus).toBe('investigating');
            expect(result.error?.details?.nextAction).toContain('Click "Investigate"');
        });

        it('should block escalation when alert is in open status (assignment and investigation required)', async () => {
            // Mock alert in open status (unassigned)
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

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ESCALATION_DENIED');
            expect(result.error?.message).toContain('Alert must be assigned to you before escalation');
            expect(result.error?.details?.workflowStep).toBe('assignment_required');
        });

        it('should block escalation when alert is assigned to different user', async () => {
            // Mock alert assigned to different user
            const mockAlert = {
                id: mockAlertId,
                tenantId: mockTenantId,
                status: 'investigating',
                assignedTo: 'other-user-123',
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

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ESCALATION_DENIED');
            expect(result.error?.message).toContain('Alert must be assigned to you before escalation');
        });

        it('should block escalation when alert is already escalated', async () => {
            // Mock alert already escalated
            const mockAlert = {
                id: mockAlertId,
                tenantId: mockTenantId,
                status: 'escalated',
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

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVESTIGATION_REQUIRED');
            expect(result.error?.message).toContain('Alert has already been escalated');
            expect(result.error?.details?.currentStatus).toBe('escalated');
            expect(result.error?.details?.workflowStep).toBe('already_escalated');
        });

        it('should block escalation when alert is already resolved', async () => {
            // Mock resolved alert
            const mockAlert = {
                id: mockAlertId,
                tenantId: mockTenantId,
                status: 'closed_benign',
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

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVESTIGATION_REQUIRED');
            expect(result.error?.message).toContain('Alert has already been resolved');
            expect(result.error?.details?.workflowStep).toBe('already_resolved');
        });

        it('should handle alert not found', async () => {
            // Mock no alert found
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([])
                    })
                })
            } as any);

            const result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ALERT_NOT_FOUND');
            expect(result.error?.message).toContain('Alert not found or access denied');
        });
    });

    describe('validateNoDirectIncidentCreation', () => {
        it('should block POST requests to incident creation endpoint', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents', {
                method: 'POST',
            });

            const result = await validateNoDirectIncidentCreation(request);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('DIRECT_INCIDENT_CREATION_BLOCKED');
            expect(result.error?.message).toContain('Security Incidents can only be created through alert escalation workflow');
            expect(result.error?.details?.workflowStep).toBe('direct_creation_blocked');
        });

        it('should allow POST requests to incident management endpoints', async () => {
            const allowedEndpoints = [
                'http://localhost/api/alerts-incidents/incidents/123/start-work',
                'http://localhost/api/alerts-incidents/incidents/123/resolve',
                'http://localhost/api/alerts-incidents/incidents/123/dismiss',
            ];

            for (const url of allowedEndpoints) {
                const request = new NextRequest(url, { method: 'POST' });
                const result = await validateNoDirectIncidentCreation(request);

                expect(result.success).toBe(true);
                expect(result.error).toBeUndefined();
            }
        });

        it('should allow GET requests to incident endpoints', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents', {
                method: 'GET',
            });

            const result = await validateNoDirectIncidentCreation(request);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should allow non-incident API requests', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts', {
                method: 'POST',
            });

            const result = await validateNoDirectIncidentCreation(request);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });
    });

    describe('validateIncidentWorkflow', () => {
        it('should validate escalation workflow when escalate URL is provided', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/123/escalate', {
                method: 'POST',
            });

            // Mock alert in investigating status
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

            const result = await validateIncidentWorkflow(request, mockAlertId, mockTenantId, mockUserId);

            expect(result.success).toBe(true);
        });

        it('should validate direct incident creation blocking', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents', {
                method: 'POST',
            });

            const result = await validateIncidentWorkflow(request);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('UNAUTHORIZED_INCIDENT_CREATION');
        });

        it('should allow non-escalation, non-creation requests', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts', {
                method: 'GET',
            });

            const result = await validateIncidentWorkflow(request);

            expect(result.success).toBe(true);
        });
    });

    describe('Error Message Quality', () => {
        it('should provide clear guidance for each workflow step', async () => {
            const testCases = [
                {
                    status: 'open',
                    expectedMessage: 'Alert must be assigned and investigated before escalation',
                    expectedAction: 'Assign the alert to yourself, then click "Investigate"'
                },
                {
                    status: 'assigned',
                    expectedMessage: 'Alert must be investigated before escalation',
                    expectedAction: 'Click "Investigate" to begin investigation'
                },
                {
                    status: 'escalated',
                    expectedMessage: 'Alert has already been escalated',
                    expectedAction: 'check My Security Incidents tab'
                },
                {
                    status: 'closed_benign',
                    expectedMessage: 'Alert has already been resolved',
                    expectedAction: 'escalation is no longer possible'
                }
            ];

            for (const testCase of testCases) {
                const mockAlert = {
                    id: mockAlertId,
                    tenantId: mockTenantId,
                    status: testCase.status,
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

                expect(result.success).toBe(false);
                expect(result.error?.message).toContain(testCase.expectedMessage);
                expect(result.error?.details?.nextAction).toContain(testCase.expectedAction);
                expect(result.error?.details?.currentStatus).toBe(testCase.status);
                expect(result.error?.details?.requiredStatus).toBe('investigating');
            }
        });
    });
});