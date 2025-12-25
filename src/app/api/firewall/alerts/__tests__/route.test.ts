/**
 * Tests for GET /api/firewall/alerts endpoint
 * 
 * Requirements:
 * - 15.7: Alert Management API
 * - 12.3: Filter alerts by tenant_id, device_id, severity, acknowledged status, date range
 * - 12.4: Sort by timestamp descending
 * - 17.1-17.4: Tenant isolation
 */

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
jest.mock('@/lib/alert-manager');

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager } from '@/lib/alert-manager';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockAlertManager = AlertManager as jest.Mocked<typeof AlertManager>;

describe('GET /api/firewall/alerts', () => {
    const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-456',
        email: 'test@example.com',
        role: 'tenant_admin',
    };

    const mockTenant = {
        id: 'tenant-456',
        name: 'Test Tenant',
    };

    const mockAlerts = [
        {
            id: 'alert-1',
            tenantId: 'tenant-456',
            deviceId: 'device-789',
            alertType: 'wan_down',
            severity: 'critical',
            message: 'WAN interface down',
            source: 'api',
            metadata: {},
            acknowledged: false,
            acknowledgedBy: null,
            acknowledgedAt: null,
            createdAt: new Date('2024-01-15T10:30:00Z'),
        },
        {
            id: 'alert-2',
            tenantId: 'tenant-456',
            deviceId: 'device-789',
            alertType: 'high_cpu',
            severity: 'high',
            message: 'CPU usage above 80%',
            source: 'api',
            metadata: { cpu_percent: 85 },
            acknowledged: true,
            acknowledgedBy: 'user-123',
            acknowledgedAt: new Date('2024-01-15T11:00:00Z'),
            createdAt: new Date('2024-01-15T10:00:00Z'),
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

        // Default alert response
        mockAlertManager.getAlerts.mockResolvedValue(mockAlerts as any);
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');
            const response = await GET(request);
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

            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Basic Alert Retrieval', () => {
        it('should return all alerts for tenant with default pagination', async () => {
            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.data[0].id).toBe('alert-1');
            expect(data.data[1].id).toBe('alert-2');
            expect(data.meta.total).toBe(2);
            expect(data.meta.limit).toBe(50);
            expect(data.meta.offset).toBe(0);

            // Verify AlertManager was called with correct filters
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                limit: 50,
                offset: 0,
            });
        });

        it('should enforce tenant isolation', async () => {
            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');
            await GET(request);

            // Verify tenant_id is always included in filters
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-456',
                })
            );
        });
    });

    describe('Device Filtering', () => {
        it('should filter alerts by device ID', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?deviceId=device-789'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                deviceId: 'device-789',
                limit: 50,
                offset: 0,
            });
        });
    });

    describe('Severity Filtering', () => {
        it('should filter alerts by single severity', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?severity=critical'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                severity: 'critical',
                limit: 50,
                offset: 0,
            });
        });

        it('should filter alerts by multiple severities', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?severity=critical,high'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                severity: ['critical', 'high'],
                limit: 50,
                offset: 0,
            });
        });

        it('should return 400 for invalid severity', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?severity=invalid'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid severity');
        });

        it('should return 400 for invalid severity in comma-separated list', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?severity=critical,invalid,high'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Acknowledged Status Filtering', () => {
        it('should filter unacknowledged alerts', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?acknowledged=false'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                acknowledged: false,
                limit: 50,
                offset: 0,
            });
        });

        it('should filter acknowledged alerts', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?acknowledged=true'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                acknowledged: true,
                limit: 50,
                offset: 0,
            });
        });

        it('should return 400 for invalid acknowledged parameter', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?acknowledged=invalid'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('must be "true" or "false"');
        });
    });

    describe('Date Range Filtering', () => {
        it('should filter alerts by start date', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?startDate=2024-01-01T00:00:00Z'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                startDate: new Date('2024-01-01T00:00:00Z'),
                limit: 50,
                offset: 0,
            });
        });

        it('should filter alerts by end date', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?endDate=2024-01-31T23:59:59Z'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                endDate: new Date('2024-01-31T23:59:59Z'),
                limit: 50,
                offset: 0,
            });
        });

        it('should filter alerts by date range', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                startDate: new Date('2024-01-01T00:00:00Z'),
                endDate: new Date('2024-01-31T23:59:59Z'),
                limit: 50,
                offset: 0,
            });
        });

        it('should return 400 for invalid start date format', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?startDate=invalid-date'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid startDate format');
        });

        it('should return 400 for invalid end date format', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?endDate=invalid-date'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid endDate format');
        });

        it('should return 400 if start date is after end date', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?startDate=2024-01-31T00:00:00Z&endDate=2024-01-01T00:00:00Z'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('startDate must be before or equal to endDate');
        });
    });

    describe('Pagination', () => {
        it('should apply custom limit', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?limit=20'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.limit).toBe(20);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                limit: 20,
                offset: 0,
            });
        });

        it('should apply custom offset', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?offset=10'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.offset).toBe(10);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                limit: 50,
                offset: 10,
            });
        });

        it('should return 400 for invalid limit (too low)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?limit=0'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Limit must be a number between 1 and 100');
        });

        it('should return 400 for invalid limit (too high)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?limit=101'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Limit must be a number between 1 and 100');
        });

        it('should return 400 for invalid limit (not a number)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?limit=abc'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for invalid offset (negative)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?offset=-1'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Offset must be a non-negative number');
        });

        it('should return 400 for invalid offset (not a number)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?offset=abc'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Combined Filters', () => {
        it('should apply multiple filters simultaneously', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?deviceId=device-789&severity=critical,high&acknowledged=false&startDate=2024-01-01T00:00:00Z&limit=10&offset=5'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                deviceId: 'device-789',
                severity: ['critical', 'high'],
                acknowledged: false,
                startDate: new Date('2024-01-01T00:00:00Z'),
                limit: 10,
                offset: 5,
            });
        });

        it('should include filter metadata in response', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/alerts?deviceId=device-789&severity=critical&acknowledged=false'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.meta.filters).toEqual({
                deviceId: 'device-789',
                severity: 'critical',
                acknowledged: false,
                startDate: null,
                endDate: null,
            });
        });
    });

    describe('Error Handling', () => {
        it('should return 500 if AlertManager throws error', async () => {
            mockAlertManager.getAlerts.mockRejectedValue(new Error('Database error'));

            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve alerts');
        });
    });

    describe('Response Format', () => {
        it('should return alerts with correct structure', async () => {
            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('data');
            expect(data).toHaveProperty('meta');
            expect(data.meta).toHaveProperty('total');
            expect(data.meta).toHaveProperty('limit');
            expect(data.meta).toHaveProperty('offset');
            expect(data.meta).toHaveProperty('filters');
        });

        it('should return empty array if no alerts found', async () => {
            mockAlertManager.getAlerts.mockResolvedValue([]);

            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
            expect(data.meta.total).toBe(0);
        });
    });
});
