/**
 * Tests for Input Validation - Device Management API
 * 
 * Task 8.1: Add input validation
 * - Test comprehensive input validation for POST and GET endpoints
 * - Test edge cases and malformed inputs
 * - Test field length limits
 * - Test type validation
 * - Test pagination parameter validation
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
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn(),
    },
}));

import { POST, GET } from '../route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { FirewallEncryption } from '@/lib/firewall-encryption';

const mockDb = jest.mocked(db);

describe('Device Management API - Input Validation', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-123';

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

    describe('POST /api/firewall/devices - Enhanced Validation', () => {
        describe('JSON Parsing', () => {
            it('should return 400 for invalid JSON', async () => {
                await setupAuthMocks();

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: 'invalid-json{',
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('VALIDATION_ERROR');
                expect(data.error.message).toContain('Invalid JSON');
            });
        });

        describe('Required Field Validation', () => {
            it('should reject empty string for managementIp', async () => {
                await setupAuthMocks();

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '   ',
                        apiUsername: 'admin',
                        apiPassword: 'password',
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Management IP');
            });

            it('should reject non-string managementIp', async () => {
                await setupAuthMocks();

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: 12345,
                        apiUsername: 'admin',
                        apiPassword: 'password',
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Management IP');
            });

            it('should reject empty string for apiUsername', async () => {
                await setupAuthMocks();

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '192.168.1.1',
                        apiUsername: '   ',
                        apiPassword: 'password',
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('API username');
            });

            it('should reject empty string for apiPassword', async () => {
                await setupAuthMocks();

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '192.168.1.1',
                        apiUsername: 'admin',
                        apiPassword: '   ',
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('API password');
            });
        });

        describe('Field Length Validation', () => {
            it('should reject model exceeding 100 characters', async () => {
                await setupAuthMocks();

                const longModel = 'A'.repeat(101);

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '192.168.1.1',
                        apiUsername: 'admin',
                        apiPassword: 'password',
                        model: longModel,
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Model');
                expect(data.error.message).toContain('100');
            });

            it('should reject firmwareVersion exceeding 50 characters', async () => {
                await setupAuthMocks();

                const longVersion = 'V'.repeat(51);

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '192.168.1.1',
                        apiUsername: 'admin',
                        apiPassword: 'password',
                        firmwareVersion: longVersion,
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Firmware version');
                expect(data.error.message).toContain('50');
            });

            it('should reject serialNumber exceeding 100 characters', async () => {
                await setupAuthMocks();

                const longSerial = 'S'.repeat(101);

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '192.168.1.1',
                        apiUsername: 'admin',
                        apiPassword: 'password',
                        serialNumber: longSerial,
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('Serial number');
                expect(data.error.message).toContain('100');
            });
        });

        describe('IP Address Validation', () => {
            it('should reject IPv4 with octets > 255', async () => {
                await setupAuthMocks();

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '192.168.1.256',
                        apiUsername: 'admin',
                        apiPassword: 'password',
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error.message).toContain('IPv4');
                expect(data.error.message).toContain('0 and 255');
            });

            it('should reject IPv4 with negative octets', async () => {
                await setupAuthMocks();

                const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                    method: 'POST',
                    body: JSON.stringify({
                        managementIp: '192.168.-1.1',
                        apiUsername: 'admin',
                        apiPassword: 'password',
                    }),
                });

                const response = await POST(request);
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
                    '999.999.999.999',
                ];

                for (const invalidIP of invalidIPs) {
                    const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                        method: 'POST',
                        body: JSON.stringify({
                            managementIp: invalidIP,
                            apiUsername: 'admin',
                            apiPassword: 'password',
                        }),
                    });

                    const response = await POST(request);
                    const data = await response.json();

                    expect(response.status).toBe(400);
                    expect(data.error.message).toContain('IP');
                }
            });
        });
    });

    describe('GET /api/firewall/devices - Pagination Validation', () => {
        it('should reject limit < 1', async () => {
            await setupAuthMocks();

            const request = new NextRequest('http://localhost:3000/api/firewall/devices?limit=0', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.message).toContain('Limit');
            expect(data.error.message).toContain('1 and 100');
        });

        it('should reject limit > 100', async () => {
            await setupAuthMocks();

            const request = new NextRequest('http://localhost:3000/api/firewall/devices?limit=101', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.message).toContain('Limit');
            expect(data.error.message).toContain('1 and 100');
        });

        it('should reject non-numeric limit', async () => {
            await setupAuthMocks();

            const request = new NextRequest('http://localhost:3000/api/firewall/devices?limit=abc', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.message).toContain('Limit');
        });

        it('should reject negative offset', async () => {
            await setupAuthMocks();

            const request = new NextRequest('http://localhost:3000/api/firewall/devices?offset=-1', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.message).toContain('Offset');
            expect(data.error.message).toContain('non-negative');
        });

        it('should reject non-numeric offset', async () => {
            await setupAuthMocks();

            const request = new NextRequest('http://localhost:3000/api/firewall/devices?offset=xyz', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.message).toContain('Offset');
        });

        it('should reject invalid status value', async () => {
            await setupAuthMocks();

            const request = new NextRequest('http://localhost:3000/api/firewall/devices?status=invalid', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.message).toContain('Status');
            expect(data.error.message).toContain('active, inactive, offline');
        });

        it('should accept valid pagination parameters', async () => {
            await setupAuthMocks();

            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockResolvedValue([]);

            const request = new NextRequest('http://localhost:3000/api/firewall/devices?limit=50&offset=10', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should accept valid status filter', async () => {
            await setupAuthMocks();

            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockResolvedValue([]);

            const validStatuses = ['active', 'inactive', 'offline'];

            for (const status of validStatuses) {
                const request = new NextRequest(`http://localhost:3000/api/firewall/devices?status=${status}`, {
                    method: 'GET',
                });

                const response = await GET(request);
                const data = await response.json();

                expect(response.status).toBe(200);
                expect(data.success).toBe(true);
            }
        });
    });
});
