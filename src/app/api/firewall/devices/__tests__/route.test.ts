/**
 * Tests for POST /api/firewall/devices - Register Device
 * 
 * Requirements: Task 8.1 - Device Management API
 * - Test device registration with valid data
 * - Test authentication and authorization
 * - Test tenant isolation
 * - Test input validation
 * - Test duplicate detection
 * - Test credential encryption
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

// Mock dependencies BEFORE imports
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
        delete: jest.fn().mockReturnThis(),
    },
}));

// Import after mocks
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { firewallDevices } from '../../../../../../database/schemas/firewall';
import { eq } from 'drizzle-orm';
import { FirewallEncryption } from '@/lib/firewall-encryption';

// Get reference to mocked db
const mockDb = jest.mocked(db);

// Helper function to configure mockDb for queries
function configureMockDbQuery(result: any[]) {
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.offset.mockResolvedValue(result);
}

// Helper function to configure mockDb for inserts
function configureMockDbInsert(result: any[]) {
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]); // For duplicate checks
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue(result);
}

describe('POST /api/firewall/devices', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-123';
    const mockDeviceId = 'device-123';

    const validDeviceData = {
        tenantId: mockTenantId,
        model: 'TZ-400',
        firmwareVersion: '7.0.1-5050',
        serialNumber: 'SN123456789',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPassword: 'securePassword123',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if not authenticated', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            jest.mocked(authMiddleware).mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if user is not admin', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER, // Regular user, not admin
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
        });

        it('should allow tenant admin to register device', async () => {
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

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(
                JSON.stringify({ encrypted: 'encrypted-data', iv: 'iv-data' })
            );

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]), // No existing devices
                insert: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([
                    {
                        id: mockDeviceId,
                        ...validDeviceData,
                        apiPasswordEncrypted: 'encrypted',
                        status: 'active',
                        uptimeSeconds: 0,
                        lastSeenAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.id).toBe(mockDeviceId);
        });

        it('should allow super admin to register device for any tenant', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            const otherTenantId = 'other-tenant-456';

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.SUPER_ADMIN,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(
                JSON.stringify({ encrypted: 'encrypted-data', iv: 'iv-data' })
            );

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
                insert: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([
                    {
                        id: mockDeviceId,
                        ...validDeviceData,
                        tenantId: otherTenantId,
                        apiPasswordEncrypted: 'encrypted',
                        status: 'active',
                        uptimeSeconds: 0,
                        lastSeenAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify({ ...validDeviceData, tenantId: otherTenantId }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
        });

        it('should prevent tenant admin from registering device for another tenant', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            const otherTenantId = 'other-tenant-456';

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

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify({ ...validDeviceData, tenantId: otherTenantId }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });
    });

    describe('Input Validation', () => {
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

        it('should return 400 if management IP is missing', async () => {
            await setupAuthMocks();

            const invalidData = { ...validDeviceData };
            delete invalidData.managementIp;

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(invalidData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Management IP');
        });

        it('should return 400 if API username is missing', async () => {
            await setupAuthMocks();

            const invalidData = { ...validDeviceData };
            delete invalidData.apiUsername;

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(invalidData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('username and password');
        });

        it('should return 400 if API password is missing', async () => {
            await setupAuthMocks();

            const invalidData = { ...validDeviceData };
            delete invalidData.apiPassword;

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(invalidData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 400 if management IP format is invalid', async () => {
            await setupAuthMocks();

            const invalidData = { ...validDeviceData, managementIp: 'invalid-ip' };

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(invalidData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid management IP');
        });

        it('should accept valid IPv4 address', async () => {
            await setupAuthMocks();

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(
                JSON.stringify({ encrypted: 'encrypted-data', iv: 'iv-data' })
            );

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
                insert: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([
                    {
                        id: mockDeviceId,
                        ...validDeviceData,
                        managementIp: '10.0.0.1',
                        apiPasswordEncrypted: 'encrypted',
                        status: 'active',
                        uptimeSeconds: 0,
                        lastSeenAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify({ ...validDeviceData, managementIp: '10.0.0.1' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
        });
    });

    describe('Duplicate Detection', () => {
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

        it('should return 409 if device with same serial number exists', async () => {
            await setupAuthMocks();

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([
                    {
                        id: 'existing-device-id',
                        serialNumber: validDeviceData.serialNumber,
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DUPLICATE_DEVICE');
            expect(data.error.message).toContain('serial number');
        });

        it('should return 409 if device with same management IP exists for tenant', async () => {
            await setupAuthMocks();

            let callCount = 0;
            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockImplementation(() => {
                    callCount++;
                    // First call (serial number check) returns empty
                    // Second call (IP check) returns existing device
                    if (callCount === 1) {
                        return Promise.resolve([]);
                    }
                    return Promise.resolve([
                        {
                            id: 'existing-device-id',
                            managementIp: validDeviceData.managementIp,
                            tenantId: mockTenantId,
                        },
                    ]);
                }),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DUPLICATE_DEVICE');
            expect(data.error.message).toContain('management IP');
        });
    });

    describe('Credential Encryption', () => {
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

        it('should encrypt API password before storage', async () => {
            await setupAuthMocks();

            const encryptedData = JSON.stringify({
                encrypted: 'encrypted-password-data',
                iv: 'initialization-vector',
            });

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(encryptedData);

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
                insert: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([
                    {
                        id: mockDeviceId,
                        ...validDeviceData,
                        apiPasswordEncrypted: encryptedData,
                        status: 'active',
                        uptimeSeconds: 0,
                        lastSeenAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(FirewallEncryption.encryptPassword).toHaveBeenCalledWith(
                validDeviceData.apiPassword
            );
            expect(data.data.apiPasswordEncrypted).toBeNull(); // Should not return encrypted password
        });

        it('should return 500 if encryption fails', async () => {
            await setupAuthMocks();

            jest.mocked(FirewallEncryption.encryptPassword).mockRejectedValue(
                new Error('Encryption failed')
            );

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ENCRYPTION_ERROR');
        });

        it('should never return encrypted password in response', async () => {
            await setupAuthMocks();

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(
                JSON.stringify({ encrypted: 'encrypted-data', iv: 'iv-data' })
            );

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
                insert: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([
                    {
                        id: mockDeviceId,
                        ...validDeviceData,
                        apiPasswordEncrypted: 'should-not-be-returned',
                        status: 'active',
                        uptimeSeconds: 0,
                        lastSeenAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.data.apiPasswordEncrypted).toBeNull();
            expect(JSON.stringify(data)).not.toContain('should-not-be-returned');
        });
    });

    describe('Successful Registration', () => {
        it('should successfully register device with all fields', async () => {
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

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(
                JSON.stringify({ encrypted: 'encrypted-data', iv: 'iv-data' })
            );

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
                insert: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([
                    {
                        id: mockDeviceId,
                        ...validDeviceData,
                        apiPasswordEncrypted: 'encrypted',
                        status: 'active',
                        uptimeSeconds: 0,
                        lastSeenAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data).toMatchObject({
                id: mockDeviceId,
                tenantId: mockTenantId,
                model: validDeviceData.model,
                firmwareVersion: validDeviceData.firmwareVersion,
                serialNumber: validDeviceData.serialNumber,
                managementIp: validDeviceData.managementIp,
                apiUsername: validDeviceData.apiUsername,
                status: 'active',
            });
            expect(data.message).toContain('successfully');
        });

        it('should successfully register device with minimal required fields', async () => {
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

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(
                JSON.stringify({ encrypted: 'encrypted-data', iv: 'iv-data' })
            );

            const minimalData = {
                managementIp: '192.168.1.1',
                apiUsername: 'admin',
                apiPassword: 'password',
            };

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
                insert: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([
                    {
                        id: mockDeviceId,
                        tenantId: mockTenantId,
                        model: null,
                        firmwareVersion: null,
                        serialNumber: null,
                        ...minimalData,
                        apiPasswordEncrypted: 'encrypted',
                        status: 'active',
                        uptimeSeconds: 0,
                        lastSeenAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(minimalData),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.managementIp).toBe(minimalData.managementIp);
        });
    });
});

describe('GET /api/firewall/devices', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-123';
    const mockDeviceId1 = 'device-001';
    const mockDeviceId2 = 'device-002';
    const mockDeviceId3 = 'device-003';

    const mockDevices = [
        {
            id: mockDeviceId1,
            tenantId: mockTenantId,
            model: 'TZ-400',
            firmwareVersion: '7.0.1-5050',
            serialNumber: 'SN001',
            managementIp: '192.168.1.1',
            apiUsername: 'admin',
            apiPasswordEncrypted: 'encrypted-password-1',
            uptimeSeconds: BigInt(3600),
            lastSeenAt: new Date('2024-01-01T10:00:00Z'),
            status: 'active',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
            id: mockDeviceId2,
            tenantId: mockTenantId,
            model: 'TZ-600',
            firmwareVersion: '7.0.1-5050',
            serialNumber: 'SN002',
            managementIp: '192.168.1.2',
            apiUsername: 'admin',
            apiPasswordEncrypted: 'encrypted-password-2',
            uptimeSeconds: BigInt(7200),
            lastSeenAt: new Date('2024-01-01T11:00:00Z'),
            status: 'active',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
            id: mockDeviceId3,
            tenantId: mockTenantId,
            model: 'NSA-2700',
            firmwareVersion: '7.0.1-5050',
            serialNumber: 'SN003',
            managementIp: '192.168.1.3',
            apiUsername: 'admin',
            apiPasswordEncrypted: 'encrypted-password-3',
            uptimeSeconds: BigInt(1800),
            lastSeenAt: new Date('2024-01-01T09:00:00Z'),
            status: 'offline',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if not authenticated', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            jest.mocked(authMiddleware).mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if tenant validation fails', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: false,
                error: { message: 'Tenant validation failed' },
            });

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Tenant Isolation', () => {
        it('should only return devices for authenticated user tenant', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            // Configure mockDb to return devices
            configureMockDbQuery(mockDevices);

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(3);
            expect(data.data.every((device: any) => device.tenantId === mockTenantId)).toBe(true);
        });

        it('should not return encrypted passwords in response', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue(mockDevices),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.every((device: any) => device.apiPasswordEncrypted === null)).toBe(
                true
            );
            expect(JSON.stringify(data)).not.toContain('encrypted-password');
        });
    });

    describe('Status Filtering', () => {
        it('should filter devices by status when status parameter provided', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const activeDevices = mockDevices.filter((d) => d.status === 'active');

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue(activeDevices),
            };


            const request = new NextRequest(
                'http://localhost:3000/api/firewall/devices?status=active',
                {
                    method: 'GET',
                }
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.data.every((device: any) => device.status === 'active')).toBe(true);
        });

        it('should return all devices when no status filter provided', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue(mockDevices),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(3);
        });

        it('should ignore invalid status values', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue(mockDevices),
            };


            const request = new NextRequest(
                'http://localhost:3000/api/firewall/devices?status=invalid',
                {
                    method: 'GET',
                }
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(3); // Returns all devices when status is invalid
        });
    });

    describe('Pagination', () => {
        it('should apply default pagination (limit=50, offset=0)', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue(mockDevices),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta).toEqual({
                total: 3,
                limit: 50,
                offset: 0,
            });
        });

        it('should apply custom limit and offset', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const paginatedDevices = [mockDevices[1]]; // Second device

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue(paginatedDevices),
            };


            const request = new NextRequest(
                'http://localhost:3000/api/firewall/devices?limit=1&offset=1',
                {
                    method: 'GET',
                }
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);
            expect(data.meta).toEqual({
                total: 1,
                limit: 1,
                offset: 1,
            });
        });

        it('should handle limit=0 gracefully', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue([]),
            };


            const request = new NextRequest(
                'http://localhost:3000/api/firewall/devices?limit=0',
                {
                    method: 'GET',
                }
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(0);
        });
    });

    describe('Response Format', () => {
        it('should return devices with correct structure', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue([mockDevices[0]]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data[0]).toMatchObject({
                id: mockDeviceId1,
                tenantId: mockTenantId,
                model: 'TZ-400',
                firmwareVersion: '7.0.1-5050',
                serialNumber: 'SN001',
                managementIp: '192.168.1.1',
                apiUsername: 'admin',
                apiPasswordEncrypted: null,
                uptimeSeconds: 3600,
                status: 'active',
            });
            expect(data.data[0]).toHaveProperty('lastSeenAt');
            expect(data.data[0]).toHaveProperty('createdAt');
            expect(data.data[0]).toHaveProperty('updatedAt');
        });

        it('should return empty array when no devices exist', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue([]),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
            expect(data.meta.total).toBe(0);
        });
    });

    describe('Error Handling', () => {
        it('should return 500 on database error', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

            jest.mocked(authMiddleware).mockResolvedValue({
                success: true,
                user: {
                    user_id: mockUserId,
                    tenant_id: mockTenantId,
                    role: UserRole.USER,
                    iat: Date.now(),
                    exp: Date.now() + 3600,
                },
            });

            jest.mocked(tenantMiddleware).mockResolvedValue({
                success: true,
                tenant: { id: mockTenantId },
            });

            const mockDb = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockRejectedValue(new Error('Database connection failed')),
            };


            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toContain('Failed to retrieve');
        });
    });
});
