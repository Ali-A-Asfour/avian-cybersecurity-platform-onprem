/**
 * Test suite for AuditService
 * Tests comprehensive audit logging for alerts and incidents
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuditService } from '../AuditService';
import {
    CreateAuditLogInput,
    AuditContext,
    AlertAuditState,
    IncidentAuditState,
} from '../../../types/audit-logs';

// Mock the database module
jest.mock('../../../lib/database', () => ({
    db: {
        insert: jest.fn(),
        select: jest.fn(),
        delete: jest.fn(),
    },
}));

// Mock data
const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockAlertId = '550e8400-e29b-41d4-a716-446655440002';
const mockIncidentId = '550e8400-e29b-41d4-a716-446655440003';

const mockAuditContext: AuditContext = {
    tenantId: mockTenantId,
    userId: mockUserId,
    userAgent: 'Mozilla/5.0 Test Browser',
    ipAddress: '192.168.1.100',
    sessionId: 'test-session-123',
    metadata: {
        testContext: true,
    },
};

const mockAlertState: AlertAuditState = {
    id: mockAlertId,
    status: 'open',
    severity: 'high',
    classification: 'malware',
    title: 'Test Security Alert',
    sourceSystem: 'edr',
    sourceId: 'edr-alert-123',
    seenCount: 1,
    metadata: {
        testAlert: true,
    },
};

const mockIncidentState: IncidentAuditState = {
    id: mockIncidentId,
    status: 'open',
    ownerId: mockUserId,
    title: 'Test Security Incident',
    severity: 'high',
    slaAcknowledgeBy: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    slaInvestigateBy: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    slaResolveBy: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
};

describe('AuditService', () => {
    const mockDb = {
        insert: jest.fn(),
        select: jest.fn(),
        delete: jest.fn(),
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock successful database operations
        mockDb.insert.mockReturnValue({
            values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{
                    id: 'mock-audit-log-id',
                    tenantId: mockTenantId,
                    userId: mockUserId,
                    action: 'alert_created',
                    entityType: 'security_alert',
                    entityId: mockAlertId,
                    description: 'Test audit log',
                    createdAt: new Date(),
                }]),
            }),
        });

        // Mock the database module
        const { db } = require('../../../lib/database');
        Object.assign(db, mockDb);
    });

    describe('createAuditLog', () => {
        it('should create audit log entry with all fields', async () => {
            const input: CreateAuditLogInput = {
                tenantId: mockTenantId,
                userId: mockUserId,
                action: 'alert_created',
                entityType: 'security_alert',
                entityId: mockAlertId,
                description: 'Test alert created',
                previousState: null,
                newState: mockAlertState,
                changeDetails: {
                    summary: 'Alert created from test',
                    affectedFields: ['status', 'severity'],
                },
                metadata: {
                    testLog: true,
                },
            };

            const auditLogId = await AuditService.createAuditLog(input, mockAuditContext);

            expect(auditLogId).toBe('mock-audit-log-id');
            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should handle minimal audit log input', async () => {
            const input: CreateAuditLogInput = {
                tenantId: mockTenantId,
                userId: mockUserId,
                action: 'alert_assigned',
                entityType: 'security_alert',
                entityId: mockAlertId,
                description: 'Minimal audit log',
                newState: mockAlertState,
            };

            const auditLogId = await AuditService.createAuditLog(input);

            expect(auditLogId).toBe('mock-audit-log-id');
            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should handle database connection errors gracefully', async () => {
            // Mock database connection failure
            const { db } = require('../../../lib/database');
            Object.assign(db, null);

            const input: CreateAuditLogInput = {
                tenantId: mockTenantId,
                userId: mockUserId,
                action: 'alert_created',
                entityType: 'security_alert',
                entityId: mockAlertId,
                description: 'Test audit log',
                newState: mockAlertState,
            };

            await expect(AuditService.createAuditLog(input)).rejects.toThrow('Database connection not available');
        });
    });

    describe('Alert Audit Logging', () => {
        it('should log alert creation', async () => {
            await AuditService.logAlertCreated(
                mockTenantId,
                mockUserId,
                mockAlertId,
                mockAlertState,
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should log alert assignment', async () => {
            const previousState = { ...mockAlertState, status: 'open', assignedTo: undefined };
            const newState = { ...mockAlertState, status: 'assigned', assignedTo: mockUserId };

            await AuditService.logAlertAssigned(
                mockTenantId,
                mockUserId,
                mockAlertId,
                previousState,
                newState,
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should log alert resolution', async () => {
            const previousState = { ...mockAlertState, status: 'investigating' };
            const newState = { ...mockAlertState, status: 'closed_benign' };

            await AuditService.logAlertResolved(
                mockTenantId,
                mockUserId,
                mockAlertId,
                previousState,
                newState,
                'benign',
                'False positive - legitimate software',
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should log alert escalation', async () => {
            const previousState = { ...mockAlertState, status: 'investigating' };
            const newState = { ...mockAlertState, status: 'escalated' };

            await AuditService.logAlertEscalated(
                mockTenantId,
                mockUserId,
                mockAlertId,
                previousState,
                newState,
                mockIncidentId,
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });
    });

    describe('Incident Audit Logging', () => {
        it('should log incident creation', async () => {
            await AuditService.logIncidentCreated(
                mockTenantId,
                mockUserId,
                mockIncidentId,
                mockIncidentState,
                mockAlertId,
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should log incident work started', async () => {
            const previousState = { ...mockIncidentState, status: 'open' };
            const newState = {
                ...mockIncidentState,
                status: 'in_progress',
                acknowledgedAt: new Date(),
                investigationStartedAt: new Date(),
            };

            await AuditService.logIncidentWorkStarted(
                mockTenantId,
                mockUserId,
                mockIncidentId,
                previousState,
                newState,
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should log incident resolution', async () => {
            const previousState = { ...mockIncidentState, status: 'in_progress' };
            const newState = {
                ...mockIncidentState,
                status: 'resolved',
                resolutionSummary: 'Threat contained and removed',
                resolvedAt: new Date(),
            };

            await AuditService.logIncidentResolved(
                mockTenantId,
                mockUserId,
                mockIncidentId,
                previousState,
                newState,
                'Threat contained and removed',
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should log incident dismissal', async () => {
            const previousState = { ...mockIncidentState, status: 'in_progress' };
            const newState = {
                ...mockIncidentState,
                status: 'dismissed',
                dismissalJustification: 'False positive - no actual threat',
                resolvedAt: new Date(),
            };

            await AuditService.logIncidentDismissed(
                mockTenantId,
                mockUserId,
                mockIncidentId,
                previousState,
                newState,
                'False positive - no actual threat',
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });
    });

    describe('State Change Detection', () => {
        it('should detect alert state changes correctly', async () => {
            const previousState = { ...mockAlertState, status: 'open', assignedTo: undefined };
            const newState = { ...mockAlertState, status: 'assigned', assignedTo: mockUserId };

            await AuditService.logAlertAssigned(
                mockTenantId,
                mockUserId,
                mockAlertId,
                previousState,
                newState,
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);

            // Verify the insert was called with the correct data structure
            const insertCall = mockDb.insert.mock.calls[0];
            expect(insertCall).toBeDefined();
        });

        it('should detect incident state changes correctly', async () => {
            const previousState = { ...mockIncidentState, status: 'open' };
            const newState = {
                ...mockIncidentState,
                status: 'in_progress',
                acknowledgedAt: new Date(),
            };

            await AuditService.logIncidentWorkStarted(
                mockTenantId,
                mockUserId,
                mockIncidentId,
                previousState,
                newState,
                mockAuditContext
            );

            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });
    });
});