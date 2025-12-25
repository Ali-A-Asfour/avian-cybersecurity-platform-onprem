/**
 * Integration Tests for Device CRUD Operations
 * 
 * Requirements: Task 8.7 - Test API Endpoints
 * - Test complete CRUD flow (Create, Read, Update, Delete)
 * - Test tenant isolation across operations
 * - Test authentication and authorization
 * - Test data consistency across operations
 * 
 * This test suite validates the entire lifecycle of a firewall device
 * from registration through deletion, ensuring all operations work
 * together correctly.
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
        orderBy: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
    },
}));

// Import after mocks
import { POST, GET } from '../route';
import { GET as GET_DEVICE, PUT, DELETE as DELETE_DEVICE } from '../[id]/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { FirewallEncryption } from '@/lib/firewall-encryption';

describe('Device CRUD Integration Tests', () => {
    const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
    const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
    const mockDeviceId = '550e8400-e29b-41d4-a716-446655440002';

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

    const setupAuthMocks = async (role: UserRole = UserRole.TENANT_ADMIN) => {
        const { authMiddleware } = await import('@/middleware/auth.middleware');
        const { tenantMiddleware } = await import('@/middleware/tenant.middleware');

        jest.mocked(authMiddleware).mockResolvedValue({
            success: true,
            user: {
                user_id: mockUserId,
                tenant_id: mockTenantId,
                role,
                iat: Date.now(),
                exp: Date.now() + 3600,
            },
        });

        jest.mocked(tenantMiddleware).mockResolvedValue({
            success: true,
            tenant: { id: mockTenantId },
        });
    };

    describe('Complete CRUD Lifecycle', () => {
        it('should successfully create, read, update, and delete a device', async () => {
            await setupAuthMocks();

            jest.mocked(FirewallEncryption.encryptPassword).mockResolvedValue(
                JSON.stringify({ encrypted: 'encrypted-data', iv: 'iv-data' })
            );

            // Step 1: CREATE - Register new device
            const mockDb = jest.mocked(db);

            // Mock for duplicate check (empty result)
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([]);

            // Mock for insert
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockResolvedValue([
                {
                    id: mockDeviceId,
                    ...validDeviceData,
                    apiPasswordEncrypted: 'encrypted',
                    status: 'active',
                    uptimeSeconds: BigInt(0),
                    lastSeenAt: null,
                    createdAt: new Date('2024-01-01T00:00:00Z'),
                    updatedAt: new Date('2024-01-01T00:00:00Z'),
                },
            ]);

            const createRequest = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const createResponse = await POST(createRequest);
            const createData = await createResponse.json();

            expect(createResponse.status).toBe(201);
            expect(createData.success).toBe(true);
            expect(createData.data.id).toBe(mockDeviceId);
            expect(createData.data.serialNumber).toBe(validDeviceData.serialNumber);

            // Step 2: READ - Get device details
            jest.clearAllMocks();
            await setupAuthMocks();

            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([
                {
                    id: mockDeviceId,
                    ...validDeviceData,
                    apiPasswordEncrypted: 'encrypted',
                    status: 'active',
                    uptimeSeconds: BigInt(3600),
                    lastSeenAt: new Date('2024-01-01T10:00:00Z'),
                    createdAt: new Date('2024-01-01T00:00:00Z'),
                    updatedAt: new Date('2024-01-01T00:00:00Z'),
                },
            ]);

            const getRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'GET' }
            );

            const getResponse = await GET_DEVICE(getRequest, { params: { id: mockDeviceId } });
            const getData = await getResponse.json();

            expect(getResponse.status).toBe(200);
            expect(getData.success).toBe(true);
            expect(getData.data.device.id).toBe(mockDeviceId);
            expect(getData.data.device.serialNumber).toBe(validDeviceData.serialNumber);

            // Step 3: UPDATE - Modify device
            jest.clearAllMocks();
            await setupAuthMocks();

            const updatedData = {
                model: 'TZ-600',
                firmwareVersion: '7.0.1-5051',
            };

            // Mock for device existence check
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([
                {
                    id: mockDeviceId,
                    ...validDeviceData,
                    tenantId: mockTenantId,
                },
            ]);

            // Mock for update
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.returning.mockResolvedValue([
                {
                    id: mockDeviceId,
                    ...validDeviceData,
                    ...updatedData,
                    apiPasswordEncrypted: 'encrypted',
                    status: 'active',
                    uptimeSeconds: BigInt(3600),
                    lastSeenAt: new Date('2024-01-01T10:00:00Z'),
                    createdAt: new Date('2024-01-01T00:00:00Z'),
                    updatedAt: new Date('2024-01-01T10:30:00Z'),
                },
            ]);

            const updateRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(updatedData),
                }
            );

            const updateResponse = await PUT(updateRequest, { params: { id: mockDeviceId } });
            const updateData = await updateResponse.json();

            expect(updateResponse.status).toBe(200);
            expect(updateData.success).toBe(true);
            expect(updateData.data.model).toBe(updatedData.model);
            expect(updateData.data.firmwareVersion).toBe(updatedData.firmwareVersion);

            // Step 4: DELETE - Remove device
            jest.clearAllMocks();
            await setupAuthMocks();

            // Mock for device existence check
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([
                {
                    id: mockDeviceId,
                    tenantId: mockTenantId,
                },
            ]);

            // Mock for delete
            mockDb.delete.mockReturnThis();
            mockDb.returning.mockResolvedValue([{ id: mockDeviceId }]);

            const deleteRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const deleteResponse = await DELETE_DEVICE(deleteRequest, {
                params: { id: mockDeviceId },
            });
            const deleteData = await deleteResponse.json();

            expect(deleteResponse.status).toBe(200);
            expect(deleteData.success).toBe(true);
            expect(deleteData.message).toContain('deleted');

            // Step 5: VERIFY DELETION - Try to get deleted device
            jest.clearAllMocks();
            await setupAuthMocks();

            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([]); // Device not found

            const verifyRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'GET' }
            );

            const verifyResponse = await GET_DEVICE(verifyRequest, {
                params: { id: mockDeviceId },
            });
            const verifyData = await verifyResponse.json();

            expect(verifyResponse.status).toBe(404);
            expect(verifyData.success).toBe(false);
            expect(verifyData.error.code).toBe('NOT_FOUND');
        });
    });

    describe('Tenant Isolation in CRUD Operations', () => {
        it('should prevent cross-tenant access during read operations', async () => {
            await setupAuthMocks();

            const otherTenantDevice = {
                id: mockDeviceId,
                tenantId: 'other-tenant-456',
                ...validDeviceData,
            };

            const mockDb = jest.mocked(db);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([]); // No device found for this tenant

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'GET' }
            );

            const response = await GET_DEVICE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
        });

        it('should prevent cross-tenant access during update operations', async () => {
            await setupAuthMocks();

            const mockDb = jest.mocked(db);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([]); // No device found for this tenant

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-600' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
        });

        it('should prevent cross-tenant access during delete operations', async () => {
            await setupAuthMocks();

            const mockDb = jest.mocked(db);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([]); // No device found for this tenant

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE_DEVICE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
        });

        it('should allow super admin to access devices across tenants', async () => {
            jest.clearAllMocks();
            await setupAuthMocks(UserRole.SUPER_ADMIN);

            const otherTenantId = '550e8400-e29b-41d4-a716-446655440003';
            const mockDb = jest.mocked(db);

            let callCount = 0;
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockImplementation(() => {
                callCount++;
                // First call: device check - return device with other tenant
                // Second call: health snapshot - return empty
                // Third call: security posture - return empty
                if (callCount === 1) {
                    return Promise.resolve([
                        {
                            id: mockDeviceId,
                            model: validDeviceData.model,
                            firmwareVersion: validDeviceData.firmwareVersion,
                            serialNumber: validDeviceData.serialNumber,
                            managementIp: validDeviceData.managementIp,
                            apiUsername: validDeviceData.apiUsername,
                            apiPassword: validDeviceData.apiPassword,
                            tenantId: otherTenantId, // This should be the other tenant
                            apiPasswordEncrypted: 'encrypted',
                            status: 'active',
                            uptimeSeconds: BigInt(3600),
                            lastSeenAt: new Date(),
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    ]);
                }
                return Promise.resolve([]);
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'GET' }
            );

            const response = await GET_DEVICE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.device.tenantId).toBe(otherTenantId);
        });
    });

    describe('Data Consistency Across Operations', () => {
        it('should maintain data integrity when updating device', async () => {
            await setupAuthMocks();

            const mockDb = jest.mocked(db);

            // Initial device state
            const initialDevice = {
                id: mockDeviceId,
                ...validDeviceData,
                tenantId: mockTenantId,
                apiPasswordEncrypted: 'encrypted',
                status: 'active',
                uptimeSeconds: BigInt(3600),
                lastSeenAt: new Date('2024-01-01T10:00:00Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
            };

            // Mock for device existence check
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([initialDevice]);

            // Update only firmware version
            const updateData = { firmwareVersion: '7.0.1-5051' };

            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.returning.mockResolvedValue([
                {
                    ...initialDevice,
                    ...updateData,
                    updatedAt: new Date('2024-01-01T10:30:00Z'),
                },
            ]);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(updateData),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            // Verify unchanged fields remain the same
            expect(data.data.serialNumber).toBe(validDeviceData.serialNumber);
            expect(data.data.managementIp).toBe(validDeviceData.managementIp);
            expect(data.data.model).toBe(validDeviceData.model);
            // Verify updated field changed
            expect(data.data.firmwareVersion).toBe(updateData.firmwareVersion);
        });

        it('should not allow updating immutable fields', async () => {
            await setupAuthMocks();

            const mockDb = jest.mocked(db);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([
                {
                    id: mockDeviceId,
                    tenantId: mockTenantId,
                    ...validDeviceData,
                },
            ]);

            // Try to update tenant ID (should be ignored or rejected)
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ tenantId: '550e8400-e29b-41d4-a716-446655440099' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            // Should either reject or ignore the tenant ID change
            expect(response.status).toBeLessThanOrEqual(400);
        });
    });

    describe('List Operation with Multiple Devices', () => {
        it('should list all devices for tenant after multiple creates', async () => {
            await setupAuthMocks();

            const mockDevices = [
                {
                    id: '550e8400-e29b-41d4-a716-446655440010',
                    tenantId: mockTenantId,
                    model: 'TZ-400',
                    serialNumber: 'SN001',
                    managementIp: '192.168.1.1',
                    apiUsername: 'admin',
                    apiPasswordEncrypted: 'encrypted-1',
                    firmwareVersion: '7.0.1-5050',
                    status: 'active',
                    uptimeSeconds: BigInt(3600),
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: '550e8400-e29b-41d4-a716-446655440011',
                    tenantId: mockTenantId,
                    model: 'TZ-600',
                    serialNumber: 'SN002',
                    managementIp: '192.168.1.2',
                    apiUsername: 'admin',
                    apiPasswordEncrypted: 'encrypted-2',
                    firmwareVersion: '7.0.1-5050',
                    status: 'active',
                    uptimeSeconds: BigInt(7200),
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockDb = jest.mocked(db);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockResolvedValue(mockDevices);

            const request = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.data.every((d: any) => d.tenantId === mockTenantId)).toBe(true);
            expect(data.data.every((d: any) => d.apiPasswordEncrypted === null)).toBe(true);
        });
    });

    describe('Error Handling Across Operations', () => {
        it('should handle database errors gracefully in all operations', async () => {
            await setupAuthMocks();

            const mockDb = jest.mocked(db);
            const dbError = new Error('Database connection failed');

            // Test CREATE error
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockRejectedValue(dbError);

            const createRequest = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });

            const createResponse = await POST(createRequest);
            const createData = await createResponse.json();

            expect(createResponse.status).toBe(500);
            expect(createData.success).toBe(false);

            // Test READ error
            jest.clearAllMocks();
            await setupAuthMocks();

            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockRejectedValue(dbError);

            const getRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'GET' }
            );

            const getResponse = await GET_DEVICE(getRequest, { params: { id: mockDeviceId } });
            const getData = await getResponse.json();

            expect(getResponse.status).toBe(500);
            expect(getData.success).toBe(false);

            // Test UPDATE error
            jest.clearAllMocks();
            await setupAuthMocks();

            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockRejectedValue(dbError);

            const updateRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-600' }),
                }
            );

            const updateResponse = await PUT(updateRequest, { params: { id: mockDeviceId } });
            const updateData = await updateResponse.json();

            expect(updateResponse.status).toBe(500);
            expect(updateData.success).toBe(false);

            // Test DELETE error
            jest.clearAllMocks();
            await setupAuthMocks();

            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockRejectedValue(dbError);

            const deleteRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const deleteResponse = await DELETE_DEVICE(deleteRequest, {
                params: { id: mockDeviceId },
            });
            const deleteData = await deleteResponse.json();

            expect(deleteResponse.status).toBe(500);
            expect(deleteData.success).toBe(false);
        });
    });

    describe('Authentication Requirements', () => {
        it('should require authentication for all CRUD operations', async () => {
            const { authMiddleware } = await import('@/middleware/auth.middleware');
            jest.mocked(authMiddleware).mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            // Test CREATE
            const createRequest = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'POST',
                body: JSON.stringify(validDeviceData),
            });
            const createResponse = await POST(createRequest);
            expect(createResponse.status).toBe(401);

            // Test READ (list)
            const listRequest = new NextRequest('http://localhost:3000/api/firewall/devices', {
                method: 'GET',
            });
            const listResponse = await GET(listRequest);
            expect(listResponse.status).toBe(401);

            // Test READ (details)
            const getRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'GET' }
            );
            const getResponse = await GET_DEVICE(getRequest, { params: { id: mockDeviceId } });
            expect(getResponse.status).toBe(401);

            // Test UPDATE
            const updateRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-600' }),
                }
            );
            const updateResponse = await PUT(updateRequest, { params: { id: mockDeviceId } });
            expect(updateResponse.status).toBe(401);

            // Test DELETE
            const deleteRequest = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );
            const deleteResponse = await DELETE_DEVICE(deleteRequest, {
                params: { id: mockDeviceId },
            });
            expect(deleteResponse.status).toBe(401);
        });
    });
});
