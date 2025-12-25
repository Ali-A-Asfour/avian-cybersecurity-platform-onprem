/**
 * Alert Manager Tests
 * 
 * Tests for the Alert Manager service covering:
 * - Alert ingestion and normalization
 * - Deduplication with seenCount intelligence
 * - Assignment and ownership management
 * - Status transitions and workflow enforcement
 */

import { AlertManager } from '../AlertManager';
import { db } from '../../../lib/database';
import { connectRedis } from '../../../lib/redis';
import { logger } from '../../../lib/logger';
import {
    EDRAlertInput,
    FirewallAlertInput,
    EmailAlertInput,
    AssignAlertInput,
    ResolveAlertInput,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        insert: jest.fn(),
        select: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('../../../lib/redis', () => ({
    connectRedis: jest.fn(),
}));

jest.mock('../../../lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe('AlertManager', () => {
    const mockDb = db as any;
    const mockRedis = {
        get: jest.fn(),
        setEx: jest.fn(),
        exists: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (connectRedis as jest.Mock).mockResolvedValue(mockRedis);

        // Mock database responses
        mockDb.insert.mockReturnValue({
            values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{
                    id: 'test-alert-id',
                    tenantId: 'test-tenant',
                    sourceSystem: 'edr',
                    sourceId: 'test-source-id',
                    alertType: 'edr_alert',
                    classification: 'malware',
                    severity: 'high',
                    title: 'Test Alert',
                    status: 'open',
                    seenCount: 1,
                    createdAt: new Date(),
                }]),
            }),
        });

        mockDb.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([]),
                }),
            }),
        });

        mockDb.update.mockReturnValue({
            set: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    returning: jest.fn().mockResolvedValue([{
                        id: 'test-alert-id',
                        status: 'assigned',
                    }]),
                }),
            }),
        });
    });

    describe('Alert Ingestion', () => {
        it('should ingest EDR alert successfully', async () => {
            const tenantId = 'test-tenant';
            const edrAlert: EDRAlertInput = {
                incidentId: 'incident-123',
                alertId: 'alert-456',
                severity: 'High',
                title: 'Malware Detected',
                description: 'Suspicious file detected on endpoint',
                threatName: 'Trojan:Win32/Malware',
                affectedDevice: 'DESKTOP-ABC123',
                affectedUser: 'john.doe@company.com',
                detectedAt: new Date(),
                metadata: { source: 'defender' },
            };

            mockRedis.get.mockResolvedValue(null); // No duplicate

            const alertId = await AlertManager.ingestEDRAlert(tenantId, edrAlert);

            expect(alertId).toBe('test-alert-id');
            expect(mockDb.insert).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Alert created', expect.any(Object));
        });

        it('should ingest Firewall alert successfully', async () => {
            const tenantId = 'test-tenant';
            const firewallAlert: FirewallAlertInput = {
                deviceId: 'firewall-123',
                alertType: 'ips_block',
                severity: 'medium',
                message: 'IPS blocked suspicious traffic',
                metadata: { sourceIp: '192.168.1.100' },
                detectedAt: new Date(),
            };

            mockRedis.get.mockResolvedValue(null); // No duplicate

            const alertId = await AlertManager.ingestFirewallAlert(tenantId, firewallAlert);

            expect(alertId).toBe('test-alert-id');
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should ingest Email alert successfully', async () => {
            const tenantId = 'test-tenant';
            const emailAlert: EmailAlertInput = {
                subject: 'Security Alert: Critical System Event',
                body: 'A critical security event has been detected',
                sender: 'security@company.com',
                receivedAt: new Date(),
                deviceIdentifier: 'server-001',
            };

            mockRedis.get.mockResolvedValue(null); // No duplicate

            const alertId = await AlertManager.ingestEmailAlert(tenantId, emailAlert);

            expect(alertId).toBe('test-alert-id');
            expect(mockDb.insert).toHaveBeenCalled();
        });
    });

    describe('Deduplication', () => {
        it('should handle duplicate alerts with seenCount intelligence', async () => {
            const tenantId = 'test-tenant';
            const edrAlert: EDRAlertInput = {
                incidentId: 'incident-123',
                alertId: 'alert-456',
                severity: 'High',
                title: 'Malware Detected',
                description: 'Suspicious file detected on endpoint',
                threatName: 'Trojan:Win32/Malware',
                affectedDevice: 'DESKTOP-ABC123',
                affectedUser: 'john.doe@company.com',
                detectedAt: new Date(),
                metadata: { source: 'defender' },
            };

            // Mock existing alert found in Redis
            mockRedis.get.mockResolvedValue('existing-alert-id');

            // Mock database returning existing alert
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: 'existing-alert-id',
                            tenantId,
                            seenCount: 2,
                        }]),
                    }),
                }),
            });

            const alertId = await AlertManager.ingestEDRAlert(tenantId, edrAlert);

            expect(alertId).toBe('existing-alert-id');
            expect(mockDb.update).toHaveBeenCalled(); // seenCount update
            expect(logger.debug).toHaveBeenCalledWith(
                'Alert deduplicated - seenCount updated',
                expect.any(Object)
            );
        });

        it('should create new alert when no duplicate found', async () => {
            const tenantId = 'test-tenant';
            const edrAlert: EDRAlertInput = {
                incidentId: 'incident-123',
                alertId: 'alert-456',
                severity: 'High',
                title: 'Malware Detected',
                description: 'Suspicious file detected on endpoint',
                threatName: 'Trojan:Win32/Malware',
                affectedDevice: 'DESKTOP-ABC123',
                affectedUser: 'john.doe@company.com',
                detectedAt: new Date(),
                metadata: { source: 'defender' },
            };

            mockRedis.get.mockResolvedValue(null); // No duplicate in Redis
            // Database query returns empty array (no duplicate)
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });

            const alertId = await AlertManager.ingestEDRAlert(tenantId, edrAlert);

            expect(alertId).toBe('test-alert-id');
            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockRedis.setEx).toHaveBeenCalled(); // Dedup key set
        });
    });

    describe('Assignment and Ownership', () => {
        it('should assign alert to analyst successfully', async () => {
            const assignInput: AssignAlertInput = {
                alertId: 'test-alert-id',
                assignedTo: 'analyst-123',
                tenantId: 'test-tenant',
            };

            // Mock alert exists and is unassigned
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: 'test-alert-id',
                            status: 'open',
                            assignedTo: null,
                        }]),
                    }),
                }),
            });

            await AlertManager.assignAlert(assignInput);

            expect(mockDb.update).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Alert assigned', expect.any(Object));
        });

        it('should start investigation on assigned alert', async () => {
            const alertId = 'test-alert-id';
            const tenantId = 'test-tenant';
            const userId = 'analyst-123';

            await AlertManager.startInvestigation(alertId, tenantId, userId);

            expect(mockDb.update).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Investigation started', expect.any(Object));
        });

        it('should resolve alert with outcome', async () => {
            const resolveInput: ResolveAlertInput = {
                alertId: 'test-alert-id',
                tenantId: 'test-tenant',
                outcome: 'benign',
                notes: 'False positive - legitimate software',
            };

            await AlertManager.resolveAlert(resolveInput);

            expect(mockDb.update).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Alert resolved', expect.any(Object));
        });
    });

    describe('Alert Querying', () => {
        it('should get triage queue (unassigned alerts)', async () => {
            const tenantId = 'test-tenant';

            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockResolvedValue([
                            {
                                id: 'alert-1',
                                status: 'open',
                                severity: 'critical',
                                assignedTo: null,
                            },
                            {
                                id: 'alert-2',
                                status: 'open',
                                severity: 'high',
                                assignedTo: null,
                            },
                        ]),
                    }),
                }),
            });

            const alerts = await AlertManager.getTriageQueue(tenantId);

            expect(alerts).toHaveLength(2);
            expect(alerts[0].status).toBe('open');
            expect(mockDb.select).toHaveBeenCalled();
        });

        it('should get investigation queue (assigned alerts)', async () => {
            const tenantId = 'test-tenant';
            const assignedTo = 'analyst-123';

            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockResolvedValue([
                            {
                                id: 'alert-1',
                                status: 'assigned',
                                assignedTo: 'analyst-123',
                            },
                            {
                                id: 'alert-2',
                                status: 'investigating',
                                assignedTo: 'analyst-123',
                            },
                        ]),
                    }),
                }),
            });

            const alerts = await AlertManager.getInvestigationQueue(tenantId, assignedTo);

            expect(alerts).toHaveLength(2);
            expect(alerts[0].assignedTo).toBe('analyst-123');
            expect(mockDb.select).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle assignment errors gracefully', async () => {
            const assignInput: AssignAlertInput = {
                alertId: 'non-existent-alert',
                assignedTo: 'analyst-123',
                tenantId: 'test-tenant',
            };

            // Mock no alert found
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]), // Empty result
                    }),
                }),
            });

            await expect(AlertManager.assignAlert(assignInput))
                .rejects.toThrow('Alert not found, already assigned, or not in open status');
        });

        it('should handle Redis unavailable gracefully', async () => {
            (connectRedis as jest.Mock).mockResolvedValue(null);

            const tenantId = 'test-tenant';
            const edrAlert: EDRAlertInput = {
                incidentId: 'incident-123',
                alertId: 'alert-456',
                severity: 'High',
                title: 'Malware Detected',
                description: 'Suspicious file detected on endpoint',
                threatName: 'Trojan:Win32/Malware',
                affectedDevice: 'DESKTOP-ABC123',
                affectedUser: 'john.doe@company.com',
                detectedAt: new Date(),
                metadata: { source: 'defender' },
            };

            // Should still create alert even without Redis
            const alertId = await AlertManager.ingestEDRAlert(tenantId, edrAlert);

            expect(alertId).toBe('test-alert-id');
            expect(mockDb.insert).toHaveBeenCalled();
        });
    });
});