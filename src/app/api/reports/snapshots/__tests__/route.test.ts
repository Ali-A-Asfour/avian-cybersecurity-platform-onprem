/**
 * Tests for GET /api/reports/snapshots endpoint
 * 
 * Requirements: audit compliance, access control
 * 
 * Tests role-based access control (Super Admin, Security Analyst only),
 * snapshot listing with filtering and pagination, and audit trail capabilities.
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { ReportSnapshotService } from '@/services/reports/ReportSnapshotService';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { UserRole } from '@/types';
import { EnhancedDateRange } from '@/types/reports';

// Mock dependencies
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));
jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));
jest.mock('@/services/reports/ReportSnapshotService');

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockReportSnapshotService = ReportSnapshotService as jest.MockedClass<typeof ReportSnapshotService>;

// Mock environment to disable development bypass
const originalEnv = process.env;
beforeAll(() => {
    process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        BYPASS_AUTH: 'false'
    };
});

afterAll(() => {
    process.env = originalEnv;
});

describe('GET /api/reports/snapshots', () => {
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock service
        mockSnapshotService = {
            listSnapshots: jest.fn(),
        } as any;

        mockReportSnapshotService.mockImplementation(() => mockSnapshotService);

        // Reset middleware mocks to default successful state
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: {
                user_id: 'user-123',
                role: UserRole.SECURITY_ANALYST,
                tenant_id: 'tenant-123'
            }
        });

        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: {
                id: 'tenant-123',
                name: 'Test Tenant'
            }
        });

        // Mock successful snapshot listing by default
        mockSnapshotService.listSnapshots.mockResolvedValue(mockSnapshotList);
    });

    const createMockRequest = (searchParams: Record<string, string> = {}) => {
        const url = new URL('http://localhost/api/reports/snapshots');
        Object.entries(searchParams).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        return {
            url: url.toString(),
        } as NextRequest;
    };

    const mockSnapshotList = {
        snapshots: [
            {
                id: 'snapshot-1',
                tenantId: 'tenant-123',
                reportId: 'report-1',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-01T10:00:00Z'),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'pdf-key-1',
                pdfSize: 12345
            },
            {
                id: 'snapshot-2',
                tenantId: 'tenant-123',
                reportId: 'report-2',
                reportType: 'monthly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-02T10:00:00Z'),
                generatedBy: 'user-456',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            }
        ],
        totalCount: 2,
        page: 1,
        pageSize: 20
    };

    describe('Authentication and Authorization', () => {
        it('should return 401 when authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValueOnce({
                success: false,
                error: 'Invalid token'
            });

            const request = createMockRequest();

            // Debug: Check what the middleware mock returns
            const authResult = await mockAuthMiddleware(request);
            console.log('Direct auth result:', authResult);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 when user role is not authorized', async () => {
            mockAuthMiddleware.mockResolvedValueOnce({
                success: true,
                user: {
                    user_id: 'user-123',
                    role: 'regular_user' as UserRole,
                    tenant_id: 'tenant-123'
                }
            });

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toBe('Access denied. Snapshot access is available to Super Admin and Security Analyst roles only.');
        });

        it('should allow Super Admin access', async () => {
            mockAuthMiddleware.mockResolvedValueOnce({
                success: true,
                user: {
                    user_id: 'admin-123',
                    role: UserRole.SUPER_ADMIN,
                    tenant_id: 'tenant-123'
                }
            });

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.accessLevel).toBe(UserRole.SUPER_ADMIN);
            expect(data.meta.tenantScope).toBe('all');
        });

        it('should allow Security Analyst access', async () => {
            mockAuthMiddleware.mockResolvedValueOnce({
                success: true,
                user: {
                    user_id: 'analyst-123',
                    role: UserRole.SECURITY_ANALYST,
                    tenant_id: 'tenant-123'
                }
            });

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.accessLevel).toBe(UserRole.SECURITY_ANALYST);
            expect(data.meta.tenantScope).toBe('tenant-123');
        });

        it('should return 403 when tenant validation fails', async () => {
            mockTenantMiddleware.mockResolvedValueOnce({
                success: false,
                error: { message: 'Tenant not found' }
            });

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Query Parameter Validation', () => {
        it('should return 400 for invalid reportType', async () => {
            const request = createMockRequest({ reportType: 'invalid' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('reportType must be one of: weekly, monthly, quarterly');
        });

        it('should return 400 for invalid page number', async () => {
            const request = createMockRequest({ page: '0' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Page must be a positive number');
        });

        it('should return 400 for invalid page size', async () => {
            const request = createMockRequest({ pageSize: '101' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Page size must be between 1 and 100');
        });

        it('should return 400 when only startDate is provided', async () => {
            const request = createMockRequest({ startDate: '2024-01-01T00:00:00Z' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Both startDate and endDate must be provided when filtering by date range');
        });

        it('should return 400 for invalid date format', async () => {
            const request = createMockRequest({
                startDate: 'invalid-date',
                endDate: '2024-01-07T00:00:00Z'
            });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Invalid date format. Must be ISO 8601 format (e.g., 2024-01-01T00:00:00Z)');
        });

        it('should return 400 when startDate is after endDate', async () => {
            const request = createMockRequest({
                startDate: '2024-01-07T00:00:00Z',
                endDate: '2024-01-01T00:00:00Z'
            });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('startDate must be before endDate');
        });

        it('should return 400 for invalid isArchived parameter', async () => {
            const request = createMockRequest({ isArchived: 'maybe' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('isArchived parameter must be "true" or "false"');
        });
    });

    describe('Snapshot Listing', () => {
        it('should list snapshots with default pagination', async () => {
            mockSnapshotService.listSnapshots.mockResolvedValue(mockSnapshotList);

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.meta.totalCount).toBe(2);
            expect(data.meta.page).toBe(1);
            expect(data.meta.pageSize).toBe(20);
            expect(data.meta.totalPages).toBe(1);

            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'tenant-123', // tenantId for Security Analyst
                {},          // empty filters
                1,           // page
                20           // pageSize
            );
        });

        it('should list snapshots with custom pagination', async () => {
            const customList = {
                ...mockSnapshotList,
                snapshots: [mockSnapshotList.snapshots[0]],
                totalCount: 10,
                page: 2,
                pageSize: 5
            };

            mockSnapshotService.listSnapshots.mockResolvedValue(customList);

            const request = createMockRequest({ page: '2', pageSize: '5' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.page).toBe(2);
            expect(data.meta.pageSize).toBe(5);
            expect(data.meta.totalPages).toBe(2);

            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'tenant-123',
                {},
                2,
                5
            );
        });

        it('should filter snapshots by reportType', async () => {
            const filteredList = {
                ...mockSnapshotList,
                snapshots: [mockSnapshotList.snapshots[0]], // Only weekly
                totalCount: 1
            };

            mockSnapshotService.listSnapshots.mockResolvedValue(filteredList);

            const request = createMockRequest({ reportType: 'weekly' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].reportType).toBe('weekly');
            expect(data.meta.filters.reportType).toBe('weekly');

            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'tenant-123',
                { reportType: 'weekly' },
                1,
                20
            );
        });

        it('should filter snapshots by date range', async () => {
            mockSnapshotService.listSnapshots.mockResolvedValue(mockSnapshotList);

            const request = createMockRequest({
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-01-31T23:59:59Z'
            });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.filters.dateRange).toEqual({
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-01-31T23:59:59Z'
            });

            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'tenant-123',
                expect.objectContaining({
                    dateRange: expect.objectContaining({
                        startDate: new Date('2024-01-01T00:00:00Z'),
                        endDate: new Date('2024-01-31T23:59:59Z'),
                        timezone: 'UTC',
                        weekStart: 'monday'
                    })
                }),
                1,
                20
            );
        });

        it('should filter snapshots by generatedBy', async () => {
            mockSnapshotService.listSnapshots.mockResolvedValue(mockSnapshotList);

            const request = createMockRequest({ generatedBy: 'user-456' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.filters.generatedBy).toBe('user-456');

            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'tenant-123',
                { generatedBy: 'user-456' },
                1,
                20
            );
        });

        it('should filter snapshots by archived status', async () => {
            mockSnapshotService.listSnapshots.mockResolvedValue(mockSnapshotList);

            const request = createMockRequest({ isArchived: 'true' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.filters.isArchived).toBe(true);

            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'tenant-123',
                { isArchived: true },
                1,
                20
            );
        });

        it('should combine multiple filters', async () => {
            mockSnapshotService.listSnapshots.mockResolvedValue(mockSnapshotList);

            const request = createMockRequest({
                reportType: 'monthly',
                generatedBy: 'user-456',
                isArchived: 'false'
            });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'tenant-123',
                {
                    reportType: 'monthly',
                    generatedBy: 'user-456',
                    isArchived: false
                },
                1,
                20
            );
        });
    });

    describe('Super Admin Access', () => {
        it('should allow Super Admin to access all tenants', async () => {
            mockAuthMiddleware.mockResolvedValueOnce({
                success: true,
                user: {
                    user_id: 'admin-123',
                    role: UserRole.SUPER_ADMIN,
                    tenant_id: 'tenant-123'
                }
            });

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.accessLevel).toBe(UserRole.SUPER_ADMIN);
            expect(data.meta.tenantScope).toBe('all');

            // Super Admin should call listSnapshots with undefined tenantId
            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                undefined, // No tenant restriction for Super Admin
                {},
                1,
                20
            );
        });
    });

    describe('Response Format', () => {
        it('should return correct response format', async () => {
            const request = createMockRequest({ reportType: 'weekly', page: '2' });
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.meta.totalCount).toBe(2);
            expect(data.meta.page).toBe(2);
            expect(data.meta.pageSize).toBe(20);
            expect(data.meta.totalPages).toBe(1);
            expect(data.meta.filters.reportType).toBe('weekly');
            expect(data.meta.accessLevel).toBe(UserRole.SECURITY_ANALYST);
            expect(data.meta.tenantScope).toBe('tenant-123');
        });

        it('should include audit trail information in snapshots', async () => {
            mockSnapshotService.listSnapshots.mockResolvedValue(mockSnapshotList);

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            // Verify audit trail fields are present
            data.data.forEach((snapshot: any) => {
                expect(snapshot).toHaveProperty('id');
                expect(snapshot).toHaveProperty('tenantId');
                expect(snapshot).toHaveProperty('generatedAt');
                expect(snapshot).toHaveProperty('generatedBy');
                expect(snapshot).toHaveProperty('templateVersion');
                expect(snapshot).toHaveProperty('dataSchemaVersion');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle service errors', async () => {
            mockSnapshotService.listSnapshots.mockRejectedValueOnce(new Error('Database error'));

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve report snapshots');
        });

        it('should handle tenant not found errors', async () => {
            mockSnapshotService.listSnapshots.mockRejectedValueOnce(new Error('tenant not found'));

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_NOT_FOUND');
            expect(data.error.message).toBe('Tenant data not found');
        });

        it('should handle database errors', async () => {
            mockSnapshotService.listSnapshots.mockRejectedValueOnce(new Error('database connection failed'));

            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');
            expect(data.error.message).toBe('Failed to retrieve snapshots from database');
        });
    });
});