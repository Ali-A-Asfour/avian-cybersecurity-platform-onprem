/**
 * Tests for EDR Polling Worker Service
 * 
 * Tests the main polling execution flow, tenant isolation, error handling,
 * and retry logic.
 */

import { EDRPollingWorker } from '../edr-polling-worker';
import { db } from '../../lib/database';
import { createMicrosoftGraphClient } from '../../lib/microsoft-graph-client';
import {
    upsertDevices,
    upsertAlerts,
    upsertVulnerabilities,
    upsertComplianceRecords,
} from '../../lib/edr-database-operations';
import { calculateAndStorePostureScore } from '../../lib/edr-posture-calculator';

// Mock dependencies
jest.mock('../../lib/database');
jest.mock('../../lib/microsoft-graph-client');
jest.mock('../../lib/edr-database-operations');
jest.mock('../../lib/edr-posture-calculator');

// TODO: Update mocks when implementing new authentication (Task 4)

describe('EDRPollingWorker', () => {
    let worker: EDRPollingWorker;

    beforeEach(() => {
        jest.clearAllMocks();

        worker = new EDRPollingWorker({
            maxRetries: 2,
            initialDelay: 100,
            maxDelay: 1000,
            backoffMultiplier: 2,
        });
    });

    describe('execute', () => {
        it('should poll all active tenants successfully', async () => {
            // Mock active tenants
            const mockTenants = [
                { id: 'tenant-1', name: 'Tenant 1' },
                { id: 'tenant-2', name: 'Tenant 2' },
            ];

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockTenants),
                }),
            });

            // Mock credentials
            mockSend.mockResolvedValue({
                SecretString: JSON.stringify({
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret',
                    tenantId: 'test-tenant-id',
                }),
            });

            // Mock Graph API client
            const mockGraphClient = {
                getDefenderDevices: jest.fn().mockResolvedValue([]),
                getIntuneDevices: jest.fn().mockResolvedValue([]),
                getDefenderAlerts: jest.fn().mockResolvedValue([]),
                getVulnerabilities: jest.fn().mockResolvedValue([]),
                getDeviceCompliance: jest.fn().mockResolvedValue([]),
            };

            (createMicrosoftGraphClient as jest.Mock).mockReturnValue(mockGraphClient);

            // Mock database operations
            (upsertDevices as jest.Mock).mockResolvedValue([]);
            (upsertAlerts as jest.Mock).mockResolvedValue([]);
            (upsertVulnerabilities as jest.Mock).mockResolvedValue([]);
            (upsertComplianceRecords as jest.Mock).mockResolvedValue([]);

            // Mock posture calculation
            (calculateAndStorePostureScore as jest.Mock).mockResolvedValue({
                id: 'score-1',
                tenantId: 'tenant-1',
                score: 85,
                deviceCount: 0,
                highRiskDeviceCount: 0,
                activeAlertCount: 0,
                criticalVulnerabilityCount: 0,
                nonCompliantDeviceCount: 0,
                calculatedAt: new Date(),
                createdAt: new Date(),
            });

            // Execute
            const result = await worker.execute();

            // Verify
            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
            expect(result.tenantResults).toHaveLength(2);
            expect(result.tenantResults[0].success).toBe(true);
            expect(result.tenantResults[1].success).toBe(true);
        });

        it('should isolate tenant failures', async () => {
            // Mock active tenants
            const mockTenants = [
                { id: 'tenant-1', name: 'Tenant 1' },
                { id: 'tenant-2', name: 'Tenant 2' },
            ];

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockTenants),
                }),
            });

            // Mock credentials - first tenant fails, second succeeds
            let callCount = 0;
            mockSend.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Credentials not found'));
                }
                return Promise.resolve({
                    SecretString: JSON.stringify({
                        clientId: 'test-client-id',
                        clientSecret: 'test-client-secret',
                        tenantId: 'test-tenant-id',
                    }),
                });
            });

            // Mock Graph API client for successful tenant
            const mockGraphClient = {
                getDefenderDevices: jest.fn().mockResolvedValue([]),
                getIntuneDevices: jest.fn().mockResolvedValue([]),
                getDefenderAlerts: jest.fn().mockResolvedValue([]),
                getVulnerabilities: jest.fn().mockResolvedValue([]),
                getDeviceCompliance: jest.fn().mockResolvedValue([]),
            };

            (createMicrosoftGraphClient as jest.Mock).mockReturnValue(mockGraphClient);

            // Mock database operations
            (upsertDevices as jest.Mock).mockResolvedValue([]);
            (upsertAlerts as jest.Mock).mockResolvedValue([]);
            (upsertVulnerabilities as jest.Mock).mockResolvedValue([]);
            (upsertComplianceRecords as jest.Mock).mockResolvedValue([]);

            // Mock posture calculation
            (calculateAndStorePostureScore as jest.Mock).mockResolvedValue({
                id: 'score-1',
                tenantId: 'tenant-2',
                score: 85,
                deviceCount: 0,
                highRiskDeviceCount: 0,
                activeAlertCount: 0,
                criticalVulnerabilityCount: 0,
                nonCompliantDeviceCount: 0,
                calculatedAt: new Date(),
                createdAt: new Date(),
            });

            // Execute
            const result = await worker.execute();

            // Verify - one success, one failure
            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(1);
            expect(result.tenantResults).toHaveLength(2);
            expect(result.tenantResults[0].success).toBe(false);
            expect(result.tenantResults[0].error).toContain('Credentials not found');
            expect(result.tenantResults[1].success).toBe(true);
        });

        it('should handle empty tenant list', async () => {
            // Mock no active tenants
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([]),
                }),
            });

            // Execute
            const result = await worker.execute();

            // Verify
            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(result.tenantResults).toHaveLength(0);
            expect(result.totalDevices).toBe(0);
            expect(result.totalAlerts).toBe(0);
        });
    });

    describe('pollTenant', () => {
        it('should successfully poll a tenant', async () => {
            // Mock credentials
            mockSend.mockResolvedValue({
                SecretString: JSON.stringify({
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret',
                    tenantId: 'test-tenant-id',
                }),
            });

            // Mock Graph API client
            const mockGraphClient = {
                getDefenderDevices: jest.fn().mockResolvedValue([
                    {
                        id: 'device-1',
                        computerDnsName: 'test-device',
                        osPlatform: 'Windows',
                        osVersion: '10.0',
                        lastSeen: new Date().toISOString(),
                        healthStatus: 'Active',
                        riskScore: 30,
                        exposureLevel: 'Low',
                    },
                ]),
                getIntuneDevices: jest.fn().mockResolvedValue([]),
                getDefenderAlerts: jest.fn().mockResolvedValue([]),
                getVulnerabilities: jest.fn().mockResolvedValue([]),
                getDeviceCompliance: jest.fn().mockResolvedValue([]),
            };

            (createMicrosoftGraphClient as jest.Mock).mockReturnValue(mockGraphClient);

            // Mock database operations
            (upsertDevices as jest.Mock).mockResolvedValue([{ id: 'stored-device-1' }]);
            (upsertAlerts as jest.Mock).mockResolvedValue([]);
            (upsertVulnerabilities as jest.Mock).mockResolvedValue([]);
            (upsertComplianceRecords as jest.Mock).mockResolvedValue([]);

            // Mock posture calculation
            (calculateAndStorePostureScore as jest.Mock).mockResolvedValue({
                id: 'score-1',
                tenantId: 'tenant-1',
                score: 85,
                deviceCount: 1,
                highRiskDeviceCount: 0,
                activeAlertCount: 0,
                criticalVulnerabilityCount: 0,
                nonCompliantDeviceCount: 0,
                calculatedAt: new Date(),
                createdAt: new Date(),
            });

            // Execute
            const result = await worker.pollTenant('tenant-1', 'Test Tenant');

            // Verify
            expect(result.success).toBe(true);
            expect(result.deviceCount).toBe(1);
            expect(result.postureScore).toBe(85);
            expect(mockGraphClient.getDefenderDevices).toHaveBeenCalledWith('tenant-1');
            expect(mockGraphClient.getIntuneDevices).toHaveBeenCalledWith('tenant-1');
            expect(upsertDevices).toHaveBeenCalled();
            expect(calculateAndStorePostureScore).toHaveBeenCalledWith('tenant-1');
        });

        it('should handle credential retrieval failure', async () => {
            // Mock credentials failure
            mockSend.mockRejectedValue(new Error('Secret not found'));

            // Execute
            const result = await worker.pollTenant('tenant-1', 'Test Tenant');

            // Verify
            expect(result.success).toBe(false);
            expect(result.error).toContain('Secret not found');
            expect(result.deviceCount).toBe(0);
        });

        it('should handle API failure with retry', async () => {
            // Mock credentials
            mockSend.mockResolvedValue({
                SecretString: JSON.stringify({
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret',
                    tenantId: 'test-tenant-id',
                }),
            });

            // Mock Graph API client - fail twice, then succeed
            let callCount = 0;
            const mockGraphClient = {
                getDefenderDevices: jest.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount <= 2) {
                        return Promise.reject(new Error('Network error'));
                    }
                    return Promise.resolve([]);
                }),
                getIntuneDevices: jest.fn().mockResolvedValue([]),
                getDefenderAlerts: jest.fn().mockResolvedValue([]),
                getVulnerabilities: jest.fn().mockResolvedValue([]),
                getDeviceCompliance: jest.fn().mockResolvedValue([]),
            };

            (createMicrosoftGraphClient as jest.Mock).mockReturnValue(mockGraphClient);

            // Mock database operations
            (upsertDevices as jest.Mock).mockResolvedValue([]);
            (upsertAlerts as jest.Mock).mockResolvedValue([]);
            (upsertVulnerabilities as jest.Mock).mockResolvedValue([]);
            (upsertComplianceRecords as jest.Mock).mockResolvedValue([]);

            // Mock posture calculation
            (calculateAndStorePostureScore as jest.Mock).mockResolvedValue({
                id: 'score-1',
                tenantId: 'tenant-1',
                score: 85,
                deviceCount: 0,
                highRiskDeviceCount: 0,
                activeAlertCount: 0,
                criticalVulnerabilityCount: 0,
                nonCompliantDeviceCount: 0,
                calculatedAt: new Date(),
                createdAt: new Date(),
            });

            // Execute
            const result = await worker.pollTenant('tenant-1', 'Test Tenant');

            // Verify - should succeed after retries
            expect(result.success).toBe(true);
            expect(mockGraphClient.getDefenderDevices).toHaveBeenCalledTimes(3);
        });
    });

    describe('retry logic', () => {
        it('should retry with exponential backoff', async () => {
            // Mock credentials
            mockSend.mockResolvedValue({
                SecretString: JSON.stringify({
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret',
                    tenantId: 'test-tenant-id',
                }),
            });

            // Mock Graph API client - always fail
            const mockGraphClient = {
                getDefenderDevices: jest.fn().mockRejectedValue(new Error('Persistent error')),
                getIntuneDevices: jest.fn().mockResolvedValue([]),
                getDefenderAlerts: jest.fn().mockResolvedValue([]),
                getVulnerabilities: jest.fn().mockResolvedValue([]),
                getDeviceCompliance: jest.fn().mockResolvedValue([]),
            };

            (createMicrosoftGraphClient as jest.Mock).mockReturnValue(mockGraphClient);

            // Execute
            const result = await worker.pollTenant('tenant-1', 'Test Tenant');

            // Verify - should fail after max retries
            expect(result.success).toBe(false);
            expect(result.error).toContain('Persistent error');
            // Should be called: initial + 2 retries = 3 times
            expect(mockGraphClient.getDefenderDevices).toHaveBeenCalledTimes(3);
        });
    });
});
