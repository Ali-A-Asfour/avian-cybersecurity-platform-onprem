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
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
    },
}));

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallHealthSnapshots,
} from '../../../../../../../database/schemas/firewall';
import { eq, and, desc, gte, lte, between } from 'drizzle-orm';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<
    typeof authMiddleware
>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<
    typeof tenantMiddleware
>;

describe('GET /api/firewall/health/:deviceId', () => {
    const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'tenant_admin',
        email: 'admin@test.com',
    };

    const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
    };

    const mockDevice = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: 'tenant-123',
        model: 'TZ-400',
        firmwareVersion: '7.0.1',
        serialNumber: 'SN123456',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted',
        uptimeSeconds: 86400,
        lastSeenAt: new Date('2024-01-15T12:00:00Z'),
        status: 'active',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T12:00:00Z'),
    };

    const mockHealthSnapshots = [
        {
            id: 'snapshot-1',
            deviceId: '550e8400-e29b-41d4-a716-446655440000',
            cpuPercent: 45.5,
            ramPercent: 60.2,
            uptimeSeconds: BigInt(86400),
            wanStatus: 'up',
            vpnStatus: 'up',
            interfaceStatus: { X0: 'up', X1: 'up' },
            wifiStatus: 'on',
            haStatus: 'active',
            timestamp: new Date('2024-01-15T12:00:00Z'),
        },
        {
            id: 'snapshot-2',
            deviceId: '550e8400-e29b-41d4-a716-446655440000',
            cpuPercent: 42.1,
            ramPercent: 58.7,
            uptimeSeconds: BigInt(82800),
            wanStatus: 'up',
            vpnStatus: 'up',
            interfaceStatus: { X0: 'up', X1: 'up' },
            wifiStatus: 'on',
            haStatus: 'active',
            timestamp: new Date('2024-01-15T08:00:00Z'),
        },
        {
            id: 'snapshot-3',
            deviceId: '550e8400-e29b-41d4-a716-446655440000',
            cpuPercent: 38.9,
            ramPercent: 55.3,
            uptimeSeconds: BigInt(79200),
            wanStatus: 'up',
            vpnStatus: 'down',
            interfaceStatus: { X0: 'up', X1: 'down' },
            wifiStatus: 'on',
            haStatus: 'active',
            timestamp: new Date('2024-01-15T04:00:00Z'),
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // Default successful auth
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: mockUser,
        });

        // Default successful tenant validation
        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if tenant validation fails', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Invalid tenant' },
            });

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Input Validation', () => {
        it('should return 400 for invalid device ID format', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/invalid-id'
            );
            const response = await GET(request, { params: { deviceId: 'invalid-id' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ID');
            expect(data.error.message).toContain('Invalid device ID format');
        });

        it('should return 400 for invalid startDate format', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?startDate=invalid-date'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid startDate format');
        });

        it('should return 400 for invalid endDate format', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?endDate=not-a-date'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid endDate format');
        });

        it('should return 400 if startDate is after endDate', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?startDate=2024-01-31T00:00:00Z&endDate=2024-01-01T00:00:00Z'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('startDate must be before or equal to endDate');
        });

        it('should return 400 for invalid limit (non-numeric)', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?limit=abc'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid limit');
        });

        it('should return 400 for invalid limit (negative)', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?limit=-10'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid limit');
        });

        it('should return 400 for limit exceeding maximum (1000)', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?limit=1001'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Limit exceeds maximum allowed value of 1000');
        });
    });

    describe('Device Validation', () => {
        it('should return 404 if device not found', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });

        it('should return 403 if device belongs to different tenant', async () => {
            const otherTenantDevice = { ...mockDevice, tenantId: 'other-tenant-id' };
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([otherTenantDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toBe('Access denied. Device belongs to another tenant');
        });
    });

    describe('Health Snapshots Retrieval', () => {
        it('should retrieve health snapshots without date filters', async () => {
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    // First call: device query
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    // Second call: health snapshots query
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue(mockHealthSnapshots),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.deviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(data.data.snapshots).toHaveLength(3);
            expect(data.data.count).toBe(3);
            expect(data.data.filters.limit).toBe(100);
            expect(data.data.filters.startDate).toBeNull();
            expect(data.data.filters.endDate).toBeNull();
        });

        it('should retrieve health snapshots with startDate filter', async () => {
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([mockHealthSnapshots[0], mockHealthSnapshots[1]]),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?startDate=2024-01-15T06:00:00Z'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots).toHaveLength(2);
            expect(data.data.filters.startDate).toBe('2024-01-15T06:00:00.000Z');
            expect(data.data.filters.endDate).toBeNull();
        });

        it('should retrieve health snapshots with endDate filter', async () => {
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([mockHealthSnapshots[1], mockHealthSnapshots[2]]),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?endDate=2024-01-15T10:00:00Z'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots).toHaveLength(2);
            expect(data.data.filters.startDate).toBeNull();
            expect(data.data.filters.endDate).toBe('2024-01-15T10:00:00.000Z');
        });

        it('should retrieve health snapshots with both startDate and endDate filters', async () => {
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([mockHealthSnapshots[1]]),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?startDate=2024-01-15T06:00:00Z&endDate=2024-01-15T10:00:00Z'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots).toHaveLength(1);
            expect(data.data.filters.startDate).toBe('2024-01-15T06:00:00.000Z');
            expect(data.data.filters.endDate).toBe('2024-01-15T10:00:00.000Z');
        });

        it('should respect custom limit parameter', async () => {
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([mockHealthSnapshots[0]]),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000?limit=1'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots).toHaveLength(1);
            expect(data.data.filters.limit).toBe(1);
        });

        it('should return empty array if no snapshots found', async () => {
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([]),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots).toHaveLength(0);
            expect(data.data.count).toBe(0);
        });

        it('should format health snapshot data correctly', async () => {
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([mockHealthSnapshots[0]]),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots[0]).toEqual({
                id: 'snapshot-1',
                deviceId: '550e8400-e29b-41d4-a716-446655440000',
                cpuPercent: 45.5,
                ramPercent: 60.2,
                uptimeSeconds: 86400,
                wanStatus: 'up',
                vpnStatus: 'up',
                interfaceStatus: { X0: 'up', X1: 'up' },
                wifiStatus: 'on',
                haStatus: 'active',
                timestamp: '2024-01-15T12:00:00.000Z',
            });
        });
    });

    describe('Super Admin Access', () => {
        it('should allow super admin to access devices from any tenant', async () => {
            const superAdminUser = {
                ...mockUser,
                role: 'super_admin',
                tenant_id: 'different-tenant',
            };

            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([mockDevice]),
                            }),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue(mockHealthSnapshots),
                                }),
                            }),
                        }),
                    };
                }
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots).toHaveLength(3);
        });
    });

    describe('Error Handling', () => {
        it('should return 500 on database error', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockRejectedValue(new Error('Database error')),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                'http://localhost:3000/api/firewall/health/550e8400-e29b-41d4-a716-446655440000'
            );
            const response = await GET(request, { params: { deviceId: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
