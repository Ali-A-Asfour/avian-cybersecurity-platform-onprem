/**
 * Integration tests for Single Security Incident Creation Path Enforcement
 * 
 * Verifies API-level enforcement of workflow:
 * Alert → Assigned → Investigate → Escalate → Security Incident
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST as escalatePost } from '../[id]/escalate/route';
import { POST as incidentsPost } from '../../incidents/route';

// Mock dependencies
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn().mockResolvedValue({
        success: true,
        user: { user_id: 'test-user-123' }
    })
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn().mockResolvedValue({
        success: true,
        tenant: { id: 'test-tenant-123' }
    })
}));

jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
        transaction: jest.fn(),
    }
}));

jest.mock('@/services/alerts-incidents/IncidentManager', () => ({
    IncidentManager: {
        escalateAlert: jest.fn(),
    }
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    }
}));

import { db } from '@/lib/database';
import { IncidentManager } from '@/services/alerts-incidents/IncidentManager';

const mockDb = db as jest.Mocked<typeof db>;
const mockIncidentManager = IncidentManager as jest.Mocked<typeof IncidentManager>;

describe('Escalation Workflow Integration Tests', () => {
    const mockAlertId = '550e8400-e29b-41d4-a716-446655440000';
    const mockTenantId = 'test-tenant-123';
    const mockUserId = 'test-user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('POST /api/alerts-incidents/alerts/[id]/escalate', () => {
        it('should allow escalation when alert is in investigating status', async () => {
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

            mockIncidentManager.escalateAlert.mockResolvedValue('incident-123');

            const request = new NextRequest(`http://localhost/api/alerts-incidents/alerts/${mockAlertId}/escalate`, {
                method: 'POST',
                body: JSON.stringify({
                    incidentTitle: 'Test Incident',
                    incidentDescription: 'Test Description'
                }),
                headers: {
                    'content-type': 'application/json'
                }
            });

            const response = await escalatePost(request, { params: { id: mockAlertId } });
            const responseData = await response.json();

            expect(response.status).toBe(201);
            expect(responseData.success).toBe(true);
            expect(responseData.data.incidentId).toBe('incident-123');
            expect(mockIncidentManager.escalateAlert).toHaveBeenCalledWith({
                alertId: mockAlertId,
                tenantId: mockTenantId,
                incidentTitle: 'Test Incident',
                incidentDescription: 'Test Description'
            });
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

            const request = new NextRequest(`http://localhost/api/alerts-incidents/alerts/${mockAlertId}/escalate`, {
                method: 'POST',
                body: JSON.stringify({}),
                headers: {
                    'content-type': 'application/json'
                }
            });

            const response = await escalatePost(request, { params: { id: mockAlertId } });
            const responseData = await response.json();

            expect(response.status).toBe(409); // Conflict
            expect(responseData.success).toBe(false);
            expect(responseData.error.code).toBe('INVESTIGATION_REQUIRED');
            expect(responseData.error.message).toContain('Alert must be investigated before escalation');
            expect(responseData.error.details.currentStatus).toBe('assigned');
            expect(responseData.error.details.requiredStatus).toBe('investigating');
            expect(responseData.error.details.nextAction).toContain('Click "Investigate"');
            expect(mockIncidentManager.escalateAlert).not.toHaveBeenCalled();
        });

        it('should block escalation when alert is unassigned (open status)', async () => {
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

            const request = new NextRequest(`http://localhost/api/alerts-incidents/alerts/${mockAlertId}/escalate`, {
                method: 'POST',
                body: JSON.stringify({}),
                headers: {
                    'content-type': 'application/json'
                }
            });

            const response = await escalatePost(request, { params: { id: mockAlertId } });
            const responseData = await response.json();

            expect(response.status).toBe(400); // Bad Request
            expect(responseData.success).toBe(false);
            expect(responseData.error.code).toBe('ESCALATION_DENIED');
            expect(responseData.error.message).toContain('Alert must be assigned to you before escalation');
            expect(responseData.error.details.workflowStep).toBe('assignment_required');
            expect(mockIncidentManager.escalateAlert).not.toHaveBeenCalled();
        });

        it('should block escalation when alert is assigned to different user', async () => {
            // Mock alert assigned to different user
            const mockAlert = {
                id: mockAlertId,
                tenantId: mockTenantId,
                status: 'investigating',
                assignedTo: 'other-user-456',
                assignedAt: new Date(),
            };

            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockAlert])
                    })
                })
            } as any);

            const request = new NextRequest(`http://localhost/api/alerts-incidents/alerts/${mockAlertId}/escalate`, {
                method: 'POST',
                body: JSON.stringify({}),
                headers: {
                    'content-type': 'application/json'
                }
            });

            const response = await escalatePost(request, { params: { id: mockAlertId } });
            const responseData = await response.json();

            expect(response.status).toBe(400); // Bad Request
            expect(responseData.success).toBe(false);
            expect(responseData.error.code).toBe('ESCALATION_DENIED');
            expect(responseData.error.message).toContain('Alert must be assigned to you before escalation');
            expect(mockIncidentManager.escalateAlert).not.toHaveBeenCalled();
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

            const request = new NextRequest(`http://localhost/api/alerts-incidents/alerts/${mockAlertId}/escalate`, {
                method: 'POST',
                body: JSON.stringify({}),
                headers: {
                    'content-type': 'application/json'
                }
            });

            const response = await escalatePost(request, { params: { id: mockAlertId } });
            const responseData = await response.json();

            expect(response.status).toBe(409); // Conflict
            expect(responseData.success).toBe(false);
            expect(responseData.error.code).toBe('INVESTIGATION_REQUIRED');
            expect(responseData.error.message).toContain('Alert has already been escalated');
            expect(responseData.error.details.workflowStep).toBe('already_escalated');
            expect(mockIncidentManager.escalateAlert).not.toHaveBeenCalled();
        });

        it('should handle invalid alert ID format', async () => {
            const invalidAlertId = 'invalid-id';

            const request = new NextRequest(`http://localhost/api/alerts-incidents/alerts/${invalidAlertId}/escalate`, {
                method: 'POST',
                body: JSON.stringify({}),
                headers: {
                    'content-type': 'application/json'
                }
            });

            const response = await escalatePost(request, { params: { id: invalidAlertId } });
            const responseData = await response.json();

            expect(response.status).toBe(400);
            expect(responseData.success).toBe(false);
            expect(responseData.error.code).toBe('VALIDATION_ERROR');
            expect(responseData.error.message).toBe('Invalid alert ID format');
        });
    });

    describe('POST /api/alerts-incidents/incidents (Direct Creation Blocking)', () => {
        it('should block direct incident creation attempts', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents', {
                method: 'POST',
                body: JSON.stringify({
                    title: 'Direct Incident',
                    description: 'This should be blocked'
                }),
                headers: {
                    'content-type': 'application/json'
                }
            });

            const response = await incidentsPost(request);
            const responseData = await response.json();

            expect(response.status).toBe(403); // Forbidden
            expect(responseData.success).toBe(false);
            expect(responseData.error.code).toBe('DIRECT_INCIDENT_CREATION_BLOCKED');
            expect(responseData.error.message).toContain('Security Incidents can only be created through alert escalation workflow');
            expect(responseData.error.details.workflowStep).toBe('direct_creation_blocked');
            expect(responseData.error.details.nextAction).toContain('Navigate to My Alerts, investigate an alert, then escalate');
        });
    });

    describe('Workflow Error Messages', () => {
        it('should provide comprehensive error details for each blocked scenario', async () => {
            const testScenarios = [
                {
                    alertStatus: 'open',
                    assignedTo: null,
                    expectedCode: 'ESCALATION_DENIED',
                    expectedWorkflowStep: 'assignment_required',
                    expectedNextAction: 'Assign the alert to yourself'
                },
                {
                    alertStatus: 'assigned',
                    assignedTo: mockUserId,
                    expectedCode: 'INVESTIGATION_REQUIRED',
                    expectedWorkflowStep: 'investigation_required',
                    expectedNextAction: 'Click "Investigate"'
                },
                {
                    alertStatus: 'escalated',
                    assignedTo: mockUserId,
                    expectedCode: 'INVESTIGATION_REQUIRED',
                    expectedWorkflowStep: 'already_escalated',
                    expectedNextAction: 'check My Security Incidents tab'
                },
                {
                    alertStatus: 'closed_benign',
                    assignedTo: mockUserId,
                    expectedCode: 'INVESTIGATION_REQUIRED',
                    expectedWorkflowStep: 'already_resolved',
                    expectedNextAction: 'escalation is no longer possible'
                }
            ];

            for (const scenario of testScenarios) {
                const mockAlert = {
                    id: mockAlertId,
                    tenantId: mockTenantId,
                    status: scenario.alertStatus,
                    assignedTo: scenario.assignedTo,
                    assignedAt: scenario.assignedTo ? new Date() : null,
                };

                mockDb.select.mockReturnValue({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([mockAlert])
                        })
                    })
                } as any);

                const request = new NextRequest(`http://localhost/api/alerts-incidents/alerts/${mockAlertId}/escalate`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: {
                        'content-type': 'application/json'
                    }
                });

                const response = await escalatePost(request, { params: { id: mockAlertId } });
                const responseData = await response.json();

                expect(responseData.success).toBe(false);
                expect(responseData.error.code).toBe(scenario.expectedCode);
                expect(responseData.error.details.workflowStep).toBe(scenario.expectedWorkflowStep);
                expect(responseData.error.details.nextAction).toContain(scenario.expectedNextAction);
                expect(responseData.error.details.currentStatus).toBe(scenario.alertStatus);
                expect(responseData.error.details.requiredStatus).toBe('investigating');
            }
        });
    });
});