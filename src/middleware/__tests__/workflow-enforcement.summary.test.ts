/**
 * Summary test to verify Single Security Incident Creation Path Enforcement
 * 
 * This test verifies that the implementation correctly enforces:
 * Alert → Assigned → Investigate → Escalate → Security Incident
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */

import { describe, it, expect } from '@jest/globals';
import { validateEscalationWorkflow, validateNoDirectIncidentCreation } from '../incident-workflow.middleware';
import { NextRequest } from 'next/server';

// Mock database
jest.mock('../../lib/database', () => ({
    db: {
        select: jest.fn(),
    }
}));

import { db } from '../../lib/database';
const mockDb = db as jest.Mocked<typeof db>;

describe('Workflow Enforcement Summary Test', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';
    const mockAlertId = 'alert-789';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('REQUIREMENT 13.3, 13.4, 13.5, 13.6: Investigation Gateway Validation', () => {
        it('should enforce that escalation is ONLY allowed from investigating status', async () => {
            const testCases = [
                {
                    status: 'open',
                    assignedTo: null,
                    shouldAllow: false,
                    reason: 'Unassigned alerts cannot be escalated'
                },
                {
                    status: 'assigned',
                    assignedTo: mockUserId,
                    shouldAllow: false,
                    reason: 'Assigned alerts must be investigated before escalation'
                },
                {
                    status: 'investigating',
                    assignedTo: mockUserId,
                    shouldAllow: true,
                    reason: 'Investigating alerts can be escalated'
                },
                {
                    status: 'escalated',
                    assignedTo: mockUserId,
                    shouldAllow: false,
                    reason: 'Already escalated alerts cannot be escalated again'
                },
                {
                    status: 'closed_benign',
                    assignedTo: mockUserId,
                    shouldAllow: false,
                    reason: 'Resolved alerts cannot be escalated'
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

                if (testCase.shouldAllow) {
                    expect(result.success).toBe(true);
                    console.log(`✅ ALLOWED: ${testCase.status} status - ${testCase.reason}`);
                } else {
                    expect(result.success).toBe(false);
                    expect(result.error).toBeDefined();
                    console.log(`🚫 BLOCKED: ${testCase.status} status - ${testCase.reason}`);
                    console.log(`   Error: ${result.error?.message}`);
                }
            }
        });
    });

    describe('REQUIREMENT 13.1, 13.2, 13.7, 13.9: Direct Incident Creation Blocking', () => {
        it('should block all direct incident creation attempts', async () => {
            const blockedRequests = [
                'http://localhost/api/alerts-incidents/incidents',
                'http://localhost/api/alerts-incidents/incidents/create',
                'http://localhost/api/alerts-incidents/incidents/new'
            ];

            for (const url of blockedRequests) {
                const request = new NextRequest(url, { method: 'POST' });
                const result = await validateNoDirectIncidentCreation(request);

                expect(result.success).toBe(false);
                expect(result.error?.code).toBe('DIRECT_INCIDENT_CREATION_BLOCKED');
                console.log(`🚫 BLOCKED: Direct incident creation at ${url}`);
            }
        });

        it('should allow incident management operations', async () => {
            const allowedRequests = [
                'http://localhost/api/alerts-incidents/incidents/123/start-work',
                'http://localhost/api/alerts-incidents/incidents/123/resolve',
                'http://localhost/api/alerts-incidents/incidents/123/dismiss',
                'http://localhost/api/alerts-incidents/incidents?queue=my'
            ];

            for (const url of allowedRequests) {
                const method = url.includes('?') ? 'GET' : 'POST';
                const request = new NextRequest(url, { method });
                const result = await validateNoDirectIncidentCreation(request);

                expect(result.success).toBe(true);
                console.log(`✅ ALLOWED: Incident management at ${url}`);
            }
        });
    });

    describe('REQUIREMENT 13.8: Comprehensive Error Messages', () => {
        it('should provide clear guidance for each blocked scenario', async () => {
            const errorScenarios = [
                {
                    status: 'open',
                    assignedTo: null,
                    expectedGuidance: 'Assign the alert to yourself'
                },
                {
                    status: 'assigned',
                    assignedTo: mockUserId,
                    expectedGuidance: 'Click "Investigate"'
                },
                {
                    status: 'escalated',
                    assignedTo: mockUserId,
                    expectedGuidance: 'check My Security Incidents tab'
                },
                {
                    status: 'closed_benign',
                    assignedTo: mockUserId,
                    expectedGuidance: 'escalation is no longer possible'
                }
            ];

            for (const scenario of errorScenarios) {
                const mockAlert = {
                    id: mockAlertId,
                    tenantId: mockTenantId,
                    status: scenario.status,
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

                const result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);

                expect(result.success).toBe(false);
                expect(result.error?.details?.nextAction).toContain(scenario.expectedGuidance);
                expect(result.error?.details?.currentStatus).toBe(scenario.status);
                expect(result.error?.details?.workflowStep).toBeDefined();

                console.log(`📋 Status ${scenario.status}: "${result.error?.message}"`);
                console.log(`   Next Action: ${result.error?.details?.nextAction}`);
            }
        });
    });

    describe('REQUIREMENT 13.10: System-wide Enforcement', () => {
        it('should demonstrate complete workflow enforcement', async () => {
            console.log('\n🔒 SINGLE SECURITY INCIDENT CREATION PATH ENFORCEMENT');
            console.log('====================================================');
            console.log('Required Path: Alert → Assigned → Investigate → Escalate → Security Incident');
            console.log('');

            // Step 1: Open alert cannot be escalated
            console.log('Step 1: Open Alert (Unassigned)');
            let mockAlert = {
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

            let result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);
            expect(result.success).toBe(false);
            console.log('  🚫 Escalation BLOCKED - Assignment required');

            // Step 2: Assigned alert cannot be escalated (investigation required)
            console.log('\nStep 2: Assigned Alert (Not Yet Investigated)');
            mockAlert = {
                ...mockAlert,
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

            result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);
            expect(result.success).toBe(false);
            console.log('  🚫 Escalation BLOCKED - Investigation required');

            // Step 3: Investigating alert CAN be escalated
            console.log('\nStep 3: Investigating Alert (Investigation Gateway Passed)');
            mockAlert = {
                ...mockAlert,
                status: 'investigating',
            };

            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockAlert])
                    })
                })
            } as any);

            result = await validateEscalationWorkflow(mockAlertId, mockTenantId, mockUserId);
            expect(result.success).toBe(true);
            console.log('  ✅ Escalation ALLOWED - Security Incident can be created');

            console.log('\n🎯 WORKFLOW ENFORCEMENT COMPLETE');
            console.log('   - Direct incident creation: BLOCKED');
            console.log('   - Escalation without investigation: BLOCKED');
            console.log('   - Escalation after investigation: ALLOWED');
            console.log('   - Clear error messages: PROVIDED');
        });
    });
});