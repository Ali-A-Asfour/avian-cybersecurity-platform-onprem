/**
 * Unit tests for IncidentManager service
 * 
 * Tests the complete security incident lifecycle with:
 * - Incident creation from alert escalation
 * - SLA timer calculation and tracking
 * - "Start Work" functionality
 * - Resolution outcome validation
 * - Tenant-scoped querying
 * 
 * Requirements: 6.2, 6.3, 7.1, 7.2, 7.4, 7.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { IncidentManager } from '../IncidentManager';
import { db } from '../../../lib/database';
import {
    AlertSeverity,
    EscalateAlertInput,
    StartWorkInput,
    ResolveIncidentInput,
    SLA_TIMERS,
} from '../../../types/alerts-incidents';

// Mock database
jest.mock('../../../lib/database', () => ({
    db: {
        transaction: jest.fn(),
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
}));

// Mock logger
jest.mock('../../../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
    },
}));

describe('IncidentManager', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';
    const mockAlertId = 'alert-789';
    const mockIncidentId = 'incident-abc';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('escalateAlert', () => {
        it('should escalate alert to security incident with ownership preservation', async () => {
            // Mock alert data
            const mockAlert = {
                id: mockAlertId,
                tenantId: mockTenantId,
                assignedTo: mockUserId,
                severity: 'high' as AlertSeverity,
                title: 'Test Security Alert',
                description: 'Test alert description',
                status: 'assigned',
            };

            // Mock incident data
            const mockIncident = {
                id: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
                title: 'Security Incident: Test Security Alert',
                severity: 'high' as AlertSeverity,
                status: 'open',
            };

            // Mock database transaction
            const mockTransaction = jest.fn().mockImplementation(async (callback) => {
                return await callback({
                    select: jest.fn().mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockAlert]),
                            }),
                        }),
                    }),
                    insert: jest.fn().mockReturnValue({
                        values: jest.fn().mockReturnValue({
                            returning: jest.fn().mockResolvedValue([mockIncident]),
                        }),
                    }),
                    update: jest.fn().mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(undefined),
                        }),
                    }),
                });
            });

            (db.transaction as jest.Mock) = mockTransaction;

            const input: EscalateAlertInput = {
                alertId: mockAlertId,
                tenantId: mockTenantId,
                incidentTitle: 'Custom Incident Title',
            };

            const result = await IncidentManager.escalateAlert(input);

            expect(result).toBe(mockIncidentId);
            expect(mockTransaction).toHaveBeenCalledTimes(1);
        });

        it('should throw error if alert is not found or not assigned', async () => {
            // Mock empty alert result
            const mockTransaction = jest.fn().mockImplementation(async (callback) => {
                return await callback({
                    select: jest.fn().mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // Empty result
                            }),
                        }),
                    }),
                });
            });

            (db.transaction as jest.Mock) = mockTransaction;

            const input: EscalateAlertInput = {
                alertId: mockAlertId,
                tenantId: mockTenantId,
            };

            await expect(IncidentManager.escalateAlert(input)).rejects.toThrow(
                'Alert not found or not in investigating status. Investigation must be completed before escalation.'
            );
        });
    });

    describe('startWork', () => {
        it('should start work on incident and set SLA tracking timestamps', async () => {
            const mockIncident = {
                id: mockIncidentId,
                acknowledgedAt: null,
                investigationStartedAt: null,
            };

            const mockUpdate = jest.fn().mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([mockIncident]),
                    }),
                }),
            });

            (db.update as jest.Mock) = mockUpdate;

            const input: StartWorkInput = {
                incidentId: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
            };

            await IncidentManager.startWork(input);

            expect(mockUpdate).toHaveBeenCalled();
        });

        it('should throw error if incident is not found or not owned by user', async () => {
            const mockUpdate = jest.fn().mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([]), // Empty result
                    }),
                }),
            });

            (db.update as jest.Mock) = mockUpdate;

            const input: StartWorkInput = {
                incidentId: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
            };

            await expect(IncidentManager.startWork(input)).rejects.toThrow(
                'Incident not found, not owned by user, or not in startable status'
            );
        });
    });

    describe('resolveIncident', () => {
        it('should resolve incident with summary when outcome is resolved', async () => {
            const mockIncident = {
                id: mockIncidentId,
                status: 'resolved',
                resolutionSummary: 'Incident resolved successfully',
                resolvedAt: new Date(),
            };

            const mockUpdate = jest.fn().mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([mockIncident]),
                    }),
                }),
            });

            (db.update as jest.Mock) = mockUpdate;

            const input: ResolveIncidentInput = {
                incidentId: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
                outcome: 'resolved',
                summary: 'Incident resolved successfully',
            };

            await IncidentManager.resolveIncident(input);

            expect(mockUpdate).toHaveBeenCalled();
        });

        it('should dismiss incident with justification when outcome is dismissed', async () => {
            const mockIncident = {
                id: mockIncidentId,
                status: 'dismissed',
                dismissalJustification: 'False positive - no actual threat',
                resolvedAt: new Date(),
            };

            const mockUpdate = jest.fn().mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([mockIncident]),
                    }),
                }),
            });

            (db.update as jest.Mock) = mockUpdate;

            const input: ResolveIncidentInput = {
                incidentId: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
                outcome: 'dismissed',
                justification: 'False positive - no actual threat',
            };

            await IncidentManager.resolveIncident(input);

            expect(mockUpdate).toHaveBeenCalled();
        });

        it('should throw error if summary is missing for resolved outcome', async () => {
            const input: ResolveIncidentInput = {
                incidentId: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
                outcome: 'resolved',
                // Missing summary
            };

            await expect(IncidentManager.resolveIncident(input)).rejects.toThrow(
                'Summary is required when resolving an incident'
            );
        });

        it('should throw error if justification is missing for dismissed outcome', async () => {
            const input: ResolveIncidentInput = {
                incidentId: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
                outcome: 'dismissed',
                // Missing justification
            };

            await expect(IncidentManager.resolveIncident(input)).rejects.toThrow(
                'Justification is required when dismissing an incident'
            );
        });

        it('should throw error if both summary and justification are provided', async () => {
            const input: ResolveIncidentInput = {
                incidentId: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
                outcome: 'resolved',
                summary: 'Resolved',
                justification: 'Dismissed', // Should not be provided for resolved
            };

            await expect(IncidentManager.resolveIncident(input)).rejects.toThrow(
                'Justification should not be provided when resolving an incident'
            );
        });
    });

    describe('getMyIncidents', () => {
        it('should return incidents owned by user with tenant isolation', async () => {
            const mockIncidents = [
                {
                    id: mockIncidentId,
                    tenantId: mockTenantId,
                    ownerId: mockUserId,
                    title: 'Test Incident',
                    status: 'open',
                },
            ];

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockResolvedValue(mockIncidents),
                    }),
                }),
            });

            (db.select as jest.Mock) = mockSelect;

            const result = await IncidentManager.getMyIncidents(mockTenantId, mockUserId);

            expect(result).toEqual(mockIncidents);
            expect(mockSelect).toHaveBeenCalled();
        });
    });

    describe('getAllIncidents', () => {
        it('should return all incidents for tenant with read-only access', async () => {
            const mockIncidents = [
                {
                    id: mockIncidentId,
                    tenantId: mockTenantId,
                    ownerId: mockUserId,
                    title: 'Test Incident',
                    status: 'open',
                },
                {
                    id: 'incident-def',
                    tenantId: mockTenantId,
                    ownerId: 'other-user',
                    title: 'Other Incident',
                    status: 'resolved',
                },
            ];

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockResolvedValue(mockIncidents),
                    }),
                }),
            });

            (db.select as jest.Mock) = mockSelect;

            const result = await IncidentManager.getAllIncidents(mockTenantId);

            expect(result).toEqual(mockIncidents);
            expect(result).toHaveLength(2);
        });
    });

    describe('SLA timer calculation', () => {
        it('should calculate correct SLA timers for all severity levels', () => {
            const testCases: Array<{ severity: AlertSeverity; expectedMinutes: { acknowledge: number; investigate: number; resolve: number } }> = [
                {
                    severity: 'critical',
                    expectedMinutes: { acknowledge: 15, investigate: 60, resolve: 240 },
                },
                {
                    severity: 'high',
                    expectedMinutes: { acknowledge: 30, investigate: 120, resolve: 480 },
                },
                {
                    severity: 'medium',
                    expectedMinutes: { acknowledge: 60, investigate: 240, resolve: 1440 },
                },
                {
                    severity: 'low',
                    expectedMinutes: { acknowledge: 240, investigate: 480, resolve: 4320 },
                },
            ];

            testCases.forEach(({ severity, expectedMinutes }) => {
                const slaConfig = SLA_TIMERS[severity];

                expect(slaConfig.acknowledgeMinutes).toBe(expectedMinutes.acknowledge);
                expect(slaConfig.investigateMinutes).toBe(expectedMinutes.investigate);
                expect(slaConfig.resolveMinutes).toBe(expectedMinutes.resolve);
            });
        });
    });
});