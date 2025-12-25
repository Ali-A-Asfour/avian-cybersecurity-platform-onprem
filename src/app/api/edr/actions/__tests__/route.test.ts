/**
 * Tests for EDR Remote Actions API Endpoints
 * 
 * Requirements tested:
 * - 5.1: User permission validation for target device's tenant
 * - 5.2: Remote action execution via Graph API
 * - 5.3: Action logging with user attribution
 * - 9.4: Tenant isolation
 * - 10.1: Audit logging
 * - 10.3: Audit log filtering
 * - 10.5: Date range filtering
 */

import { POST, GET } from '../route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { edrDevices, edrActions } from '../../../../../../database/schemas/edr';
import { eq, and } from 'drizzle-orm';
import * as authMiddleware from '@/middleware/auth.middleware';
import * as tenantMiddleware from '@/middleware/tenant.middleware';
import * as microsoftGraphClient from '@/lib/microsoft-graph-client';

// Mock modules
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/lib/microsoft-graph-client');

describe('POST /api/edr/actions', () => {
    const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        email: 'test@example.com',
        role: 'security_analyst',
    };

    const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
    };

    const mockDevice = {
        id: 'device-123',
        tenantId: 'tenant-123',
        microsoftDeviceId: 'ms-device-123',
        deviceName: 'TEST-DEVICE-01',
        operatingSystem: 'Windows 11',
        osVersion: '22H2',
        primaryUser: 'test@example.com',
        defenderHealthStatus: 'active',
        riskScore: 25,
        exposureLevel: 'low',
        intuneComplianceState: 'compliant',
        intuneEnrollmentStatus: 'enrolled',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        // Setup mocks
        jest.mocked(authMiddleware.authMiddleware).mockResolvedValue({
            success: true,
            user: mockUser,
        });

        jest.mocked(tenantMiddleware.tenantMiddleware).mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });

        // Insert test device
        await db.insert(edrDevices).values(mockDevice);
    });

    afterEach(async () => {
        // Cleanup
        await db.delete(edrActions).where(eq(edrActions.tenantId, 'tenant-123'));
        await db.delete(edrDevices).where(eq(edrDevices.tenantId, 'tenant-123'));
        jest.clearAllMocks();
    });

    it('should execute isolate action and log it', async () => {
        // Mock Graph API client
        const mockIsolateDevice = jest.fn().mockResolvedValue({
            id: 'action-ms-123',
            status: 'Succeeded',
            message: 'Device isolated successfully',
        });

        jest.mocked(microsoftGraphClient.MicrosoftGraphClient).mockImplementation(() => ({
            isolateDevice: mockIsolateDevice,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-123',
                actionType: 'isolate',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.actionType).toBe('isolate');
        expect(data.data.status).toBe('completed');
        expect(data.data.deviceId).toBe('device-123');
        expect(data.data.userId).toBe('user-123');
        expect(data.data.tenantId).toBe('tenant-123');

        // Verify action was logged in database
        const actions = await db
            .select()
            .from(edrActions)
            .where(eq(edrActions.deviceId, 'device-123'));

        expect(actions).toHaveLength(1);
        expect(actions[0].actionType).toBe('isolate');
        expect(actions[0].status).toBe('completed');
        expect(actions[0].userId).toBe('user-123');
        expect(actions[0].tenantId).toBe('tenant-123');
    });

    it('should execute unisolate action', async () => {
        const mockUnisolateDevice = jest.fn().mockResolvedValue({
            id: 'action-ms-124',
            status: 'Succeeded',
            message: 'Device unisolated successfully',
        });

        jest.mocked(microsoftGraphClient.MicrosoftGraphClient).mockImplementation(() => ({
            unisolateDevice: mockUnisolateDevice,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-123',
                actionType: 'unisolate',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.actionType).toBe('unisolate');
        expect(mockUnisolateDevice).toHaveBeenCalled();
    });

    it('should execute scan action', async () => {
        const mockRunAntivirusScan = jest.fn().mockResolvedValue({
            id: 'action-ms-125',
            status: 'Succeeded',
            message: 'Antivirus scan initiated',
        });

        jest.mocked(microsoftGraphClient.MicrosoftGraphClient).mockImplementation(() => ({
            runAntivirusScan: mockRunAntivirusScan,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-123',
                actionType: 'scan',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.actionType).toBe('scan');
        expect(mockRunAntivirusScan).toHaveBeenCalled();
    });

    it('should reject action for device in different tenant (Requirement 5.1, 9.4)', async () => {
        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-999', // Non-existent device
                actionType: 'isolate',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('FORBIDDEN');
    });

    it('should return 400 for missing deviceId', async () => {
        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                actionType: 'isolate',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('Device ID');
    });

    it('should return 400 for missing actionType', async () => {
        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-123',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('Action type');
    });

    it('should return 400 for invalid actionType', async () => {
        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-123',
                actionType: 'invalid_action',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('Action type must be one of');
    });

    it('should return 400 for invalid deviceId format', async () => {
        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'not-a-uuid',
                actionType: 'isolate',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('valid UUID');
    });

    it('should log failed action when Graph API fails', async () => {
        const mockIsolateDevice = jest.fn().mockRejectedValue(new Error('Graph API error'));

        jest.mocked(microsoftGraphClient.MicrosoftGraphClient).mockImplementation(() => ({
            isolateDevice: mockIsolateDevice,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-123',
                actionType: 'isolate',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);

        // Verify failed action was logged
        const actions = await db
            .select()
            .from(edrActions)
            .where(eq(edrActions.deviceId, 'device-123'));

        expect(actions).toHaveLength(1);
        expect(actions[0].status).toBe('failed');
        expect(actions[0].resultMessage).toContain('Graph API error');
    });

    it('should return 401 when not authenticated', async () => {
        jest.mocked(authMiddleware.authMiddleware).mockResolvedValue({
            success: false,
            error: 'Not authenticated',
        });

        const request = new NextRequest('http://localhost:3000/api/edr/actions', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'device-123',
                actionType: 'isolate',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });
});

describe('GET /api/edr/actions', () => {
    const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        email: 'test@example.com',
        role: 'security_analyst',
    };

    const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
    };

    const mockDevice = {
        id: 'device-123',
        tenantId: 'tenant-123',
        microsoftDeviceId: 'ms-device-123',
        deviceName: 'TEST-DEVICE-01',
        operatingSystem: 'Windows 11',
        osVersion: '22H2',
        primaryUser: 'test@example.com',
        defenderHealthStatus: 'active',
        riskScore: 25,
        exposureLevel: 'low',
        intuneComplianceState: 'compliant',
        intuneEnrollmentStatus: 'enrolled',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        // Setup mocks
        jest.mocked(authMiddleware.authMiddleware).mockResolvedValue({
            success: true,
            user: mockUser,
        });

        jest.mocked(tenantMiddleware.tenantMiddleware).mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });

        // Insert test device
        await db.insert(edrDevices).values(mockDevice);

        // Insert test actions
        await db.insert(edrActions).values([
            {
                id: 'action-1',
                tenantId: 'tenant-123',
                deviceId: 'device-123',
                userId: 'user-123',
                actionType: 'isolate',
                status: 'completed',
                resultMessage: 'Success',
                initiatedAt: new Date('2024-01-01T10:00:00Z'),
                completedAt: new Date('2024-01-01T10:01:00Z'),
            },
            {
                id: 'action-2',
                tenantId: 'tenant-123',
                deviceId: 'device-123',
                userId: 'user-456',
                actionType: 'scan',
                status: 'completed',
                resultMessage: 'Success',
                initiatedAt: new Date('2024-01-02T10:00:00Z'),
                completedAt: new Date('2024-01-02T10:05:00Z'),
            },
            {
                id: 'action-3',
                tenantId: 'tenant-123',
                deviceId: 'device-123',
                userId: 'user-123',
                actionType: 'unisolate',
                status: 'failed',
                resultMessage: 'Error',
                initiatedAt: new Date('2024-01-03T10:00:00Z'),
                completedAt: new Date('2024-01-03T10:01:00Z'),
            },
        ]);
    });

    afterEach(async () => {
        // Cleanup
        await db.delete(edrActions).where(eq(edrActions.tenantId, 'tenant-123'));
        await db.delete(edrDevices).where(eq(edrDevices.tenantId, 'tenant-123'));
        jest.clearAllMocks();
    });

    it('should return all actions for tenant (Requirement 10.3)', async () => {
        const request = new NextRequest('http://localhost:3000/api/edr/actions');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(3);
        expect(data.meta.total).toBe(3);
        expect(data.data.every((a: any) => a.tenantId === 'tenant-123')).toBe(true);
    });

    it('should filter actions by deviceId (Requirement 10.3)', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?deviceId=device-123'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(3);
        expect(data.data.every((a: any) => a.deviceId === 'device-123')).toBe(true);
    });

    it('should filter actions by userId (Requirement 10.3)', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?userId=user-123'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.data.every((a: any) => a.userId === 'user-123')).toBe(true);
    });

    it('should filter actions by date range (Requirement 10.5)', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?startDate=2024-01-02T00:00:00Z&endDate=2024-01-02T23:59:59Z'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].actionType).toBe('scan');
    });

    it('should support pagination', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?page=1&limit=2'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.meta.page).toBe(1);
        expect(data.meta.limit).toBe(2);
        expect(data.meta.total).toBe(3);
        expect(data.meta.totalPages).toBe(2);
    });

    it('should return 400 for invalid deviceId format', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?deviceId=not-a-uuid'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('valid UUID');
    });

    it('should return 400 for invalid userId format', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?userId=not-a-uuid'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('valid UUID');
    });

    it('should return 400 for invalid date format', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?startDate=invalid-date'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('Invalid startDate format');
    });

    it('should return 400 when startDate is after endDate', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?startDate=2024-01-10T00:00:00Z&endDate=2024-01-01T00:00:00Z'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('Start date must be before');
    });

    it('should return 401 when not authenticated', async () => {
        jest.mocked(authMiddleware.authMiddleware).mockResolvedValue({
            success: false,
            error: 'Not authenticated',
        });

        const request = new NextRequest('http://localhost:3000/api/edr/actions');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return empty array when no actions match filters', async () => {
        const request = new NextRequest(
            'http://localhost:3000/api/edr/actions?deviceId=00000000-0000-0000-0000-000000000000'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
        expect(data.meta.total).toBe(0);
    });
});
