/**
 * Tests for Input Validation - Device Update API
 * 
 * Task 8.1: Add input validation
 * - Test comprehensive input validation for PUT endpoint
 * - Test edge cases and malformed inputs
 * - Test field length limits
 * - Test type validation
 */

import { UserRole } from '@/types';

// Mock NextResponse before other imports
jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    return {
        ...actual,
        NextResponse: {
            json: (body: any, init?: ResponseInit) => {
                return new Response(JSON.stringify(body), {
                    ...init,
                    headers: {
                        'content-type': 'application/json',
                        ...init?.headers,
                    },
                });
            },
        },
    };
});

// Mock dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/lib/firewall-encryption');
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        returning: jest.fn(),
    },
}));

import { PUT } from '../route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { FirewallEncryption } from '@/lib/firewall-encryption';

const mockDb = jest.mocked(db);

describe('Device Update API - Input Validation', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-123';
    const mockDeviceId = '550e8400-e29b-41d4-a716-446655440000';

    const mockExistingDevice = {
        id: mockDeviceId,
        tenantId: mockTenantId,
        model: 'TZ-400',
        firmwareVersion: '7.0.1-5050',
        serialNumber: 'SN123456789',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted',
        status: 'active',
        uptimeSeconds: 0,
        lastSeenAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const setupAuthMocks = async () => {
        const { authMiddleware } = await import('@/middleware/auth.middleware');
        const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

        jest.mocked(authMiddleware).mockResolvedValue({
            success: true,
            user: {
                user_id: mockUserId,
                tenant_id: mockTenantId,
                role: UserRole.TENANT_ADMIN,
                iat: Date.now(),
                exp: Date.now() + 3600,
            },
        });

        jest.mocked(tenantMiddleware).mockResolvedValue({
            success: true,
            tenant: { id: mockTenantId },
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('PUT /api/firewall/devices/:id - Enhanced Validation', () => {
        describe('JSON Parsing', () => {
            it('should return 400 for invalid JSON', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: 'invalid-json{',
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('VALIDATION_ERROR');
                expect(data.error.message).toContain('Invalid JSON');
            });
        });

        describe('Field Length Validation', () => {
            beforeEach(() => {
                mockDb.select.mockReturnThis();
                mockDb.from.mockReturnThis();
                mockDb.where.mockReturnThis();
                mockDb.limit.mockResolvedValue([mockExistingDevice]);
            });

            it('should reject model exceeding 100 characters', async () => {
                await setupAuthMocks();

                const longModel = 'A'.repeat(101);

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ model: longModel }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Model');
                expect(data.error.message).toContain('100');
            });

            it('should reject firmwareVersion exceeding 50 characters', async () => {
                await setupAuthMocks();

                const longVersion = 'V'.repeat(51);

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ firmwareVersion: longVersion }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Firmware version');
                expect(data.error.message).toContain('50');
            });

            it('should reject serialNumber exceeding 100 characters', async () => {
                await setupAuthMocks();

                const longSerial = 'S'.repeat(101);

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ serialNumber: longSerial }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Serial number');
                expect(data.error.message).toContain('100');
            });

            it('should reject apiUsername exceeding 255 characters', async () => {
                await setupAuthMocks();

                const longUsername = 'U'.repeat(256);

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ apiUsername: longUsername }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('API username');
                expect(data.error.message).toContain('255');
            });
        });

        describe('Empty String Validation', () => {
            beforeEach(() => {
                mockDb.select.mockReturnThis();
                mockDb.from.mockReturnThis();
                mockDb.where.mockReturnThis();
                mockDb.limit.mockResolvedValue([mockExistingDevice]);
            });

            it('should reject empty string for managementIp', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: '   ' }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Management IP');
            });

            it('should reject empty string for apiUsername', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ apiUsername: '   ' }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('API username');
            });

            it('should reject empty string for apiPassword', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ apiPassword: '   ' }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('API password');
            });
        });

        describe('IP Address Validation', () => {
            beforeEach(() => {
                mockDb.select.mockReturnThis();
                mockDb.from.mockReturnThis();
                mockDb.where.mockReturnThis();
                mockDb.limit.mockResolvedValue([mockExistingDevice]);
            });

            it('should reject IPv4 with octets > 255', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: '192.168.1.256' }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('IPv4');
                expect(data.error.message).toContain('0 and 255');
            });

            it('should reject IPv4 with negative octets', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: '192.168.-1.1' }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('IPv4');
            });

            it('should reject malformed IP addresses', async () => {
                await setupAuthMocks();

                const invalidIPs = [
                    'not-an-ip',
                    '192.168.1',
                    '192.168.1.1.1',
                    '192.168.1.a',
                    'localhost',
                ];

                for (const invalidIP of invalidIPs) {
                    mockDb.select.mockReturnThis();
                    mockDb.from.mockReturnThis();
                    mockDb.where.mockReturnThis();
                    mockDb.limit.mockResolvedValue([mockExistingDevice]);

                    const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ managementIp: invalidIP }),
                    });

                    const response = await PUT(request, { params: { id: mockDeviceId } });
                    const data = await response.json();

                    expect(response.status).toBe(400);
                    expect(data.error.message).toContain('IP');
                }
            });
        });

        describe('Type Validation', () => {
            beforeEach(() => {
                mockDb.select.mockReturnThis();
                mockDb.from.mockReturnThis();
                mockDb.where.mockReturnThis();
                mockDb.limit.mockResolvedValue([mockExistingDevice]);
            });

            it('should reject non-string model', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ model: 12345 }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Model');
            });

            it('should reject non-string firmwareVersion', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ firmwareVersion: 7.0 }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Firmware version');
            });

            it('should reject non-string serialNumber', async () => {
                await setupAuthMocks();

                const request = new NextRequest(`http://localhost:3000/api/firewall/devices/${mockDeviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ serialNumber: 123456 }),
                });

                const response = await PUT(request, { params: { id: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Serial number');
            });
        });
    });
});
