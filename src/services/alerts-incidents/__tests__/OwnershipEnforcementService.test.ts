/**
 * Unit tests for OwnershipEnforcementService
 * Tests ownership and accountability enforcement functionality
 * Requirements: 2.4, 2.5, 3.4, 7.2, 8.2, 8.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OwnershipEnforcementService } from '../OwnershipEnforcementService';
import { AuditService } from '../AuditService';
import { db } from '../../../lib/database';
import { securityAlerts, securityIncidents } from '../../../../database/schemas/alerts-incidents';
import { SecurityAlert, SecurityIncident } from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../AuditService', () => ({
    AuditService: {
        createAuditLog: jest.fn(),
    },
}));

jest.mock('../../../lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe('OwnershipEnforcementService', () => {
    const mockDb = db as any;
    const mockSelect = {
        from: jest.fn(),
        where: jest.fn(),
        limit: jest.fn(),
        returning: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockDb.select.mockReturnValue(mockSelect);
        mockSelect.from.mockReturnValue(mockSelect);
        mockSelect.where.mockReturnValue(mockSelect);
        mockSelect.limit.mockReturnValue(mockSelect);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('validateAlertOwnership', () => {
        const mockAlert: SecurityAlert = {
            id: 'alert-123',
            tenantId: 'tenant-123',
            sourceSystem: 'edr',
            sourceId: 'edr-alert-456',
            alertType: 'malware_detection',
            classification: 'malware',
            severity: 'high',
            title: 'Malware Detected',
            description: 'Suspicious file detected',
            metadata: {},
            seenCount: 1,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            defenderIncidentId: null,
            defenderAlertId: null,
            defenderSeverity: null,
            threatName: null,
            affectedDevice: null,
            affectedUser: null,
            status: 'open',
            assignedTo: null,
            assignedAt: null,
            detectedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should allow assignment of unassigned alert', async () => {
            mockSelect.limit.mockResolvedValue([mockAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'assign'
            );

            expect(result.isValid).toBe(true);
            expect(mockDb.select).toHaveBeenCalled();
        });

        it('should deny assignment of already assigned alert', async () => {
            const assignedAlert = {
                ...mockAlert,
                status: 'assigned',
                assignedTo: 'user-456',
                assignedAt: new Date(),
            };
            mockSelect.limit.mockResolvedValue([assignedAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'assign'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('cannot be assigned');
            expect(result.currentOwner).toBe('user-456');
        });

        it('should allow investigation by assigned user', async () => {
            const assignedAlert = {
                ...mockAlert,
                status: 'assigned',
                assignedTo: 'user-123',
                assignedAt: new Date(),
            };
            mockSelect.limit.mockResolvedValue([assignedAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'investigate'
            );

            expect(result.isValid).toBe(true);
        });

        it('should deny investigation by non-assigned user', async () => {
            const assignedAlert = {
                ...mockAlert,
                status: 'assigned',
                assignedTo: 'user-456',
                assignedAt: new Date(),
            };
            mockSelect.limit.mockResolvedValue([assignedAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'investigate'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('assigned to another analyst');
            expect(result.currentOwner).toBe('user-456');
        });

        it('should deny investigation of unassigned alert', async () => {
            mockSelect.limit.mockResolvedValue([mockAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'investigate'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('must be assigned');
        });

        it('should allow resolution by assigned user', async () => {
            const investigatingAlert = {
                ...mockAlert,
                status: 'investigating',
                assignedTo: 'user-123',
                assignedAt: new Date(),
            };
            mockSelect.limit.mockResolvedValue([investigatingAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'resolve'
            );

            expect(result.isValid).toBe(true);
        });

        it('should deny resolution with invalid status', async () => {
            const escalatedAlert = {
                ...mockAlert,
                status: 'escalated',
                assignedTo: 'user-123',
                assignedAt: new Date(),
            };
            mockSelect.limit.mockResolvedValue([escalatedAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'resolve'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('not allowed for alert status');
        });

        it('should handle alert not found', async () => {
            mockSelect.limit.mockResolvedValue([]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'assign'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('not found');
        });

        it('should allow view access for all users', async () => {
            mockSelect.limit.mockResolvedValue([mockAlert]);

            const result = await OwnershipEnforcementService.validateAlertOwnership(
                'alert-123',
                'tenant-123',
                'user-123',
                'view'
            );

            expect(result.isValid).toBe(true);
        });
    });

    describe('validateIncidentOwnership', () => {
        const mockIncident: SecurityIncident = {
            id: 'incident-123',
            tenantId: 'tenant-123',
            ownerId: 'user-123',
            title: 'Security Incident',
            description: 'Escalated from alert',
            severity: 'high',
            status: 'open',
            resolutionSummary: null,
            dismissalJustification: null,
            slaAcknowledgeBy: new Date(Date.now() + 15 * 60 * 1000),
            slaInvestigateBy: new Date(Date.now() + 60 * 60 * 1000),
            slaResolveBy: new Date(Date.now() + 4 * 60 * 60 * 1000),
            acknowledgedAt: null,
            investigationStartedAt: null,
            resolvedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should allow start work by incident owner', async () => {
            mockSelect.limit.mockResolvedValue([mockIncident]);

            const result = await OwnershipEnforcementService.validateIncidentOwnership(
                'incident-123',
                'tenant-123',
                'user-123',
                'start_work'
            );

            expect(result.isValid).toBe(true);
        });

        it('should deny start work by non-owner', async () => {
            mockSelect.limit.mockResolvedValue([mockIncident]);

            const result = await OwnershipEnforcementService.validateIncidentOwnership(
                'incident-123',
                'tenant-123',
                'user-456',
                'start_work'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('owned by another analyst');
            expect(result.currentOwner).toBe('user-123');
        });

        it('should allow resolution by incident owner', async () => {
            const inProgressIncident = {
                ...mockIncident,
                status: 'in_progress',
                acknowledgedAt: new Date(),
                investigationStartedAt: new Date(),
            };
            mockSelect.limit.mockResolvedValue([inProgressIncident]);

            const result = await OwnershipEnforcementService.validateIncidentOwnership(
                'incident-123',
                'tenant-123',
                'user-123',
                'resolve'
            );

            expect(result.isValid).toBe(true);
        });

        it('should deny resolution with invalid status', async () => {
            const resolvedIncident = {
                ...mockIncident,
                status: 'resolved',
                resolvedAt: new Date(),
                resolutionSummary: 'Incident resolved',
            };
            mockSelect.limit.mockResolvedValue([resolvedIncident]);

            const result = await OwnershipEnforcementService.validateIncidentOwnership(
                'incident-123',
                'tenant-123',
                'user-123',
                'resolve'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('not allowed for incident status');
        });

        it('should allow owned view access by owner', async () => {
            mockSelect.limit.mockResolvedValue([mockIncident]);

            const result = await OwnershipEnforcementService.validateIncidentOwnership(
                'incident-123',
                'tenant-123',
                'user-123',
                'view_owned'
            );

            expect(result.isValid).toBe(true);
        });

        it('should deny owned view access by non-owner', async () => {
            mockSelect.limit.mockResolvedValue([mockIncident]);

            const result = await OwnershipEnforcementService.validateIncidentOwnership(
                'incident-123',
                'tenant-123',
                'user-456',
                'view_owned'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('owned by another analyst');
        });

        it('should allow global view access for all users', async () => {
            mockSelect.limit.mockResolvedValue([mockIncident]);

            const result = await OwnershipEnforcementService.validateIncidentOwnership(
                'incident-123',
                'tenant-123',
                'user-456',
                'view_all'
            );

            expect(result.isValid).toBe(true);
            expect(result.reason).toContain('Read-only access');
        });
    });

    describe('preventOwnershipTransfer', () => {
        it('should deny ownership transfer without admin override', async () => {
            const request = {
                entityType: 'alert' as const,
                entityId: 'alert-123',
                tenantId: 'tenant-123',
                currentUserId: 'user-123',
                newOwnerId: 'user-456',
                reason: 'User requested transfer',
            };

            const result = await OwnershipEnforcementService.preventOwnershipTransfer(request);

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not permitted');
        });

        it('should deny ownership transfer even with admin override (not implemented)', async () => {
            const request = {
                entityType: 'incident' as const,
                entityId: 'incident-123',
                tenantId: 'tenant-123',
                currentUserId: 'user-123',
                newOwnerId: 'user-456',
                reason: 'Admin override requested',
                adminOverride: true,
            };

            const result = await OwnershipEnforcementService.preventOwnershipTransfer(request);

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not implemented');
        });
    });

    describe('trackOwnershipChange', () => {
        it('should track ownership change in audit log', async () => {
            const mockCreateAuditLog = jest.mocked(AuditService.createAuditLog);
            mockCreateAuditLog.mockResolvedValue('audit-log-123');

            await OwnershipEnforcementService.trackOwnershipChange(
                'alert',
                'alert-123',
                'tenant-123',
                null,
                'user-123',
                'user-123',
                'Alert assigned to analyst'
            );

            expect(mockCreateAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-123',
                    userId: 'user-123',
                    entityType: 'security_alert',
                    entityId: 'alert-123',
                    description: 'Ownership assigned to user-123: Alert assigned to analyst',
                    previousState: null,
                    newState: { ownerId: 'user-123' },
                    metadata: expect.objectContaining({
                        ownershipChange: true,
                        previousOwner: null,
                        newOwner: 'user-123',
                    }),
                }),
                undefined
            );
        });

        it('should track ownership transfer in audit log', async () => {
            const mockCreateAuditLog = jest.mocked(AuditService.createAuditLog);
            mockCreateAuditLog.mockResolvedValue('audit-log-456');

            await OwnershipEnforcementService.trackOwnershipChange(
                'incident',
                'incident-123',
                'tenant-123',
                'user-123',
                'user-456',
                'admin-789',
                'Administrative transfer'
            );

            expect(mockCreateAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-123',
                    userId: 'admin-789',
                    entityType: 'security_incident',
                    entityId: 'incident-123',
                    description: 'Ownership transferred from user-123 to user-456: Administrative transfer',
                    previousState: { ownerId: 'user-123' },
                    newState: { ownerId: 'user-456' },
                    metadata: expect.objectContaining({
                        ownershipChange: true,
                        previousOwner: 'user-123',
                        newOwner: 'user-456',
                        transferredBy: 'admin-789',
                    }),
                }),
                undefined
            );
        });
    });

    describe('validateRoleBasedAccess', () => {
        it('should allow all incidents view for any user', async () => {
            const result = await OwnershipEnforcementService.validateRoleBasedAccess(
                'user-123',
                'tenant-123',
                'view_all_incidents'
            );

            expect(result.isValid).toBe(true);
            expect(result.reason).toContain('read-only access');
        });

        it('should deny incident modification for non-owners', async () => {
            const result = await OwnershipEnforcementService.validateRoleBasedAccess(
                'user-123',
                'tenant-123',
                'modify_incidents'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('restricted to incident owner');
            expect(result.requiredRole).toBe('incident_owner');
        });

        it('should allow playbook management for super admin', async () => {
            const result = await OwnershipEnforcementService.validateRoleBasedAccess(
                'admin-123',
                'tenant-123',
                'manage_playbooks',
                'super_admin'
            );

            expect(result.isValid).toBe(true);
            expect(result.reason).toContain('Super Admin role verified');
        });

        it('should deny playbook management for non-admin', async () => {
            const result = await OwnershipEnforcementService.validateRoleBasedAccess(
                'user-123',
                'tenant-123',
                'manage_playbooks',
                'security_analyst'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('restricted to Super Admin');
            expect(result.requiredRole).toBe('super_admin');
        });

        it('should allow admin override for super admin', async () => {
            const result = await OwnershipEnforcementService.validateRoleBasedAccess(
                'admin-123',
                'tenant-123',
                'admin_override',
                'super_admin'
            );

            expect(result.isValid).toBe(true);
            expect(result.reason).toContain('Super Admin role verified');
        });

        it('should deny admin override for non-admin', async () => {
            const result = await OwnershipEnforcementService.validateRoleBasedAccess(
                'user-123',
                'tenant-123',
                'admin_override',
                'security_analyst'
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('restricted to Super Admin');
            expect(result.requiredRole).toBe('super_admin');
        });
    });

    describe('performOwnershipIntegrityCheck', () => {
        it('should check alert and incident ownership integrity', async () => {
            const mockAlerts = [
                {
                    id: 'alert-1',
                    status: 'open',
                    assignedTo: null,
                    assignedAt: null,
                },
                {
                    id: 'alert-2',
                    status: 'assigned',
                    assignedTo: 'user-123',
                    assignedAt: new Date(),
                },
                {
                    id: 'alert-3',
                    status: 'open',
                    assignedTo: 'user-456', // Integrity issue
                    assignedAt: new Date(),
                },
            ];

            const mockIncidents = [
                {
                    id: 'incident-1',
                    status: 'resolved',
                    resolutionSummary: 'Resolved successfully',
                    dismissalJustification: null,
                    acknowledgedAt: new Date(),
                    createdAt: new Date(Date.now() - 60000),
                },
                {
                    id: 'incident-2',
                    status: 'resolved',
                    resolutionSummary: null, // Integrity issue
                    dismissalJustification: null,
                    acknowledgedAt: new Date(),
                    createdAt: new Date(Date.now() - 60000),
                },
            ];

            // Mock database calls
            mockSelect.limit.mockResolvedValueOnce(mockAlerts);
            mockSelect.limit.mockResolvedValueOnce(mockIncidents);

            const result = await OwnershipEnforcementService.performOwnershipIntegrityCheck('tenant-123');

            expect(result.alertsChecked).toBe(3);
            expect(result.incidentsChecked).toBe(2);
            expect(result.integrityIssues).toHaveLength(2);

            expect(result.integrityIssues[0]).toEqual({
                entityType: 'alert',
                entityId: 'alert-3',
                issue: 'Open alert has assignment data - should be null',
                severity: 'error',
            });

            expect(result.integrityIssues[1]).toEqual({
                entityType: 'incident',
                entityId: 'incident-2',
                issue: 'Resolved incident missing resolution summary',
                severity: 'error',
            });
        });

        it('should handle database errors gracefully', async () => {
            mockSelect.limit.mockRejectedValue(new Error('Database connection failed'));

            await expect(
                OwnershipEnforcementService.performOwnershipIntegrityCheck('tenant-123')
            ).rejects.toThrow('Database connection failed');
        });
    });
});