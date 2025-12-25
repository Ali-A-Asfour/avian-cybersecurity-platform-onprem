/**
 * Report Snapshot Service Tests
 * 
 * Unit tests for the ReportSnapshotService to verify role-based access control,
 * audit logging, snapshot creation, retrieval, and listing functionality.
 * 
 * Requirements: 9.2, audit compliance
 */

import { ReportSnapshotService } from '../ReportSnapshotService';
import { EnhancedDateRange, SlideData } from '@/types/reports';

// Mock the database module
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        from: jest.fn(),
        where: jest.fn(),
        limit: jest.fn(),
        orderBy: jest.fn(),
        offset: jest.fn(),
        returning: jest.fn()
    },
    withTransaction: jest.fn()
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Mock database schemas
jest.mock('../../../../database/schemas/reports', () => ({
    reportSnapshots: {
        id: 'id',
        tenantId: 'tenant_id',
        reportId: 'report_id',
        reportType: 'report_type',
        startDate: 'start_date',
        endDate: 'end_date',
        timezone: 'timezone',
        generatedAt: 'generated_at',
        generatedBy: 'generated_by',
        slideData: 'slide_data',
        templateVersion: 'template_version',
        dataSchemaVersion: 'data_schema_version',
        pdfStorageKey: 'pdf_storage_key',
        pdfSize: 'pdf_size',
        isArchived: 'is_archived'
    },
    reportAccessLogs: {
        snapshotId: 'snapshot_id',
        tenantId: 'tenant_id',
        userId: 'user_id',
        accessType: 'access_type',
        userRole: 'user_role',
        accessGranted: 'access_granted',
        denialReason: 'denial_reason',
        ipAddress: 'ip_address',
        userAgent: 'user_agent'
    }
}));

jest.mock('../../../../database/schemas/main', () => ({
    users: {
        id: 'id',
        role: 'role',
        tenant_id: 'tenant_id',
        is_active: 'is_active'
    }
}));

describe('ReportSnapshotService', () => {
    let service: ReportSnapshotService;
    let mockDb: any;

    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';
    const mockSnapshotId = 'snapshot-789';

    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday'
    };

    const mockSlideData: SlideData[] = [
        {
            slideId: 'slide-1',
            slideType: 'executive-overview',
            computedMetrics: { totalAlerts: 42 },
            chartData: [],
            templateData: {}
        }
    ];

    beforeEach(() => {
        service = new ReportSnapshotService();
        mockDb = require('@/lib/database').db;
        jest.clearAllMocks();
    });

    describe('Role-Based Access Control', () => {
        it('should allow access for super_admin role', async () => {
            // Mock user query to return super_admin
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'super_admin',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock snapshot query
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockSnapshotId,
                            tenantId: mockTenantId,
                            reportId: 'report-123',
                            reportType: 'weekly',
                            startDate: mockDateRange.startDate,
                            endDate: mockDateRange.endDate,
                            timezone: mockDateRange.timezone,
                            generatedAt: new Date(),
                            generatedBy: mockUserId,
                            slideData: mockSlideData,
                            templateVersion: 'v1.0.0',
                            dataSchemaVersion: 'v1.0.0',
                            pdfStorageKey: null,
                            pdfSize: null,
                            isArchived: false
                        }])
                    })
                })
            });

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            const result = await service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            );

            expect(result).toBeTruthy();
            expect(result?.id).toBe(mockSnapshotId);
        });

        it('should allow access for security_analyst role', async () => {
            // Mock user query to return security_analyst
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock snapshot query
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockSnapshotId,
                            tenantId: mockTenantId,
                            reportId: 'report-123',
                            reportType: 'weekly',
                            startDate: mockDateRange.startDate,
                            endDate: mockDateRange.endDate,
                            timezone: mockDateRange.timezone,
                            generatedAt: new Date(),
                            generatedBy: mockUserId,
                            slideData: mockSlideData,
                            templateVersion: 'v1.0.0',
                            dataSchemaVersion: 'v1.0.0',
                            pdfStorageKey: null,
                            pdfSize: null,
                            isArchived: false
                        }])
                    })
                })
            });

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            const result = await service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            );

            expect(result).toBeTruthy();
        });

        it('should deny access for regular_user role', async () => {
            // Mock user query to return regular_user
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'regular_user',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            await expect(service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            )).rejects.toThrow('Access denied: Insufficient role permissions');
        });

        it('should deny access for inactive user', async () => {
            // Mock user query to return inactive user
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: false
                        }])
                    })
                })
            });

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            await expect(service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            )).rejects.toThrow('Access denied: User not found or inactive');
        });

        it('should deny access for non-existent user', async () => {
            // Mock user query to return empty result
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([])
                    })
                })
            });

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            await expect(service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            )).rejects.toThrow('Access denied: User not found or inactive');
        });
    });

    describe('Snapshot Creation', () => {
        it('should create snapshot successfully with valid data', async () => {
            // Mock user validation
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock transaction
            const mockTransaction = jest.fn().mockResolvedValue({
                id: mockSnapshotId,
                tenantId: mockTenantId,
                reportId: 'report-123',
                reportType: 'weekly',
                startDate: mockDateRange.startDate,
                endDate: mockDateRange.endDate,
                timezone: mockDateRange.timezone,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: mockSlideData,
                templateVersion: 'v1.0.0',
                dataSchemaVersion: 'v1.0.0',
                pdfStorageKey: null,
                pdfSize: null,
                isArchived: false
            });

            require('@/lib/database').withTransaction.mockImplementation(
                (callback: any) => callback({ insert: () => ({ values: () => ({ returning: () => [mockTransaction()] }) }) })
            );

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            const reportData = {
                tenantId: mockTenantId,
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                slideData: mockSlideData,
                templateVersion: 'v1.0.0',
                dataSchemaVersion: 'v1.0.0'
            };

            const result = await service.createSnapshot(reportData, mockUserId);

            expect(result.id).toBe(mockSnapshotId);
            expect(result.tenantId).toBe(mockTenantId);
            expect(result.reportType).toBe('weekly');
        });

        it('should validate template and data schema versions', async () => {
            // Mock user validation
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            const reportData = {
                tenantId: mockTenantId,
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                slideData: mockSlideData,
                templateVersion: 'v2.1.0',
                dataSchemaVersion: 'v1.5.0'
            };

            // Mock transaction
            const mockSnapshot = {
                id: mockSnapshotId,
                ...reportData,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                pdfStorageKey: null,
                pdfSize: null,
                isArchived: false
            };

            require('@/lib/database').withTransaction.mockImplementation(
                (callback: any) => callback({ insert: () => ({ values: () => ({ returning: () => [mockSnapshot] }) }) })
            );

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            const result = await service.createSnapshot(reportData, mockUserId);

            expect(result.templateVersion).toBe('v2.1.0');
            expect(result.dataSchemaVersion).toBe('v1.5.0');
        });
    });

    describe('Snapshot Listing', () => {
        it('should list snapshots with pagination', async () => {
            // Mock user validation
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock count query
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([{ count: 5 }])
                })
            });

            // Mock snapshots query
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                offset: jest.fn().mockResolvedValue([
                                    {
                                        id: 'snapshot-1',
                                        tenantId: mockTenantId,
                                        reportId: 'report-1',
                                        reportType: 'weekly',
                                        startDate: mockDateRange.startDate,
                                        endDate: mockDateRange.endDate,
                                        timezone: mockDateRange.timezone,
                                        generatedAt: new Date(),
                                        generatedBy: mockUserId,
                                        slideData: mockSlideData,
                                        templateVersion: 'v1.0.0',
                                        dataSchemaVersion: 'v1.0.0',
                                        pdfStorageKey: null,
                                        pdfSize: null,
                                        isArchived: false
                                    },
                                    {
                                        id: 'snapshot-2',
                                        tenantId: mockTenantId,
                                        reportId: 'report-2',
                                        reportType: 'monthly',
                                        startDate: mockDateRange.startDate,
                                        endDate: mockDateRange.endDate,
                                        timezone: mockDateRange.timezone,
                                        generatedAt: new Date(),
                                        generatedBy: mockUserId,
                                        slideData: mockSlideData,
                                        templateVersion: 'v1.0.0',
                                        dataSchemaVersion: 'v1.0.0',
                                        pdfStorageKey: null,
                                        pdfSize: null,
                                        isArchived: false
                                    }
                                ])
                            })
                        })
                    })
                })
            });

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            const result = await service.listSnapshots(
                mockTenantId,
                mockUserId,
                undefined,
                1,
                2
            );

            expect(result.snapshots).toHaveLength(2);
            expect(result.totalCount).toBe(5);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(2);
        });

        it('should filter snapshots by report type', async () => {
            // Mock user validation
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock count query
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([{ count: 2 }])
                })
            });

            // Mock snapshots query
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                offset: jest.fn().mockResolvedValue([
                                    {
                                        id: 'snapshot-1',
                                        tenantId: mockTenantId,
                                        reportId: 'report-1',
                                        reportType: 'weekly',
                                        startDate: mockDateRange.startDate,
                                        endDate: mockDateRange.endDate,
                                        timezone: mockDateRange.timezone,
                                        generatedAt: new Date(),
                                        generatedBy: mockUserId,
                                        slideData: mockSlideData,
                                        templateVersion: 'v1.0.0',
                                        dataSchemaVersion: 'v1.0.0',
                                        pdfStorageKey: null,
                                        pdfSize: null,
                                        isArchived: false
                                    }
                                ])
                            })
                        })
                    })
                })
            });

            // Mock access log insertion
            mockDb.insert.mockReturnValue({
                values: jest.fn().mockResolvedValue(undefined)
            });

            const filters = { reportType: 'weekly' as const };
            const result = await service.listSnapshots(
                mockTenantId,
                mockUserId,
                filters
            );

            expect(result.snapshots).toHaveLength(1);
            expect(result.snapshots[0].reportType).toBe('weekly');
        });
    });

    describe('PDF Storage Management', () => {
        it('should update PDF storage information', async () => {
            // Mock user validation
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock update query
            mockDb.update.mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(undefined)
                })
            });

            await service.updatePdfStorage(
                mockSnapshotId,
                's3://bucket/path/report.pdf',
                1024000,
                'sha256checksum',
                mockUserId,
                mockTenantId
            );

            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    describe('Archive Management', () => {
        it('should archive snapshot successfully', async () => {
            // Mock user validation
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock update query
            mockDb.update.mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(undefined)
                })
            });

            await service.archiveSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            );

            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors', async () => {
            // Mock database as null
            require('@/lib/database').db = null;

            await expect(service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            )).rejects.toThrow('Database connection not available');
        });

        it('should handle database query errors', async () => {
            // Mock user validation to throw error
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockRejectedValue(new Error('Database error'))
                    })
                })
            });

            await expect(service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId
            )).rejects.toThrow('Failed to retrieve snapshot');
        });
    });

    describe('Audit Logging', () => {
        it('should log successful access attempts', async () => {
            // Mock user validation
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'security_analyst',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock snapshot query
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockSnapshotId,
                            tenantId: mockTenantId,
                            reportId: 'report-123',
                            reportType: 'weekly',
                            startDate: mockDateRange.startDate,
                            endDate: mockDateRange.endDate,
                            timezone: mockDateRange.timezone,
                            generatedAt: new Date(),
                            generatedBy: mockUserId,
                            slideData: mockSlideData,
                            templateVersion: 'v1.0.0',
                            dataSchemaVersion: 'v1.0.0',
                            pdfStorageKey: null,
                            pdfSize: null,
                            isArchived: false
                        }])
                    })
                })
            });

            // Mock access log insertion
            const mockInsert = jest.fn().mockResolvedValue(undefined);
            mockDb.insert.mockReturnValue({
                values: mockInsert
            });

            await service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId,
                '192.168.1.1',
                'Mozilla/5.0'
            );

            expect(mockInsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    snapshotId: mockSnapshotId,
                    tenantId: mockTenantId,
                    userId: mockUserId,
                    accessType: 'view',
                    userRole: 'security_analyst',
                    accessGranted: true,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0'
                })
            );
        });

        it('should log failed access attempts', async () => {
            // Mock user validation to return unauthorized user
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([{
                            id: mockUserId,
                            role: 'regular_user',
                            tenantId: mockTenantId,
                            isActive: true
                        }])
                    })
                })
            });

            // Mock access log insertion
            const mockInsert = jest.fn().mockResolvedValue(undefined);
            mockDb.insert.mockReturnValue({
                values: mockInsert
            });

            await expect(service.getSnapshot(
                mockSnapshotId,
                mockUserId,
                mockTenantId,
                '192.168.1.1',
                'Mozilla/5.0'
            )).rejects.toThrow('Access denied');

            expect(mockInsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    snapshotId: mockSnapshotId,
                    tenantId: mockTenantId,
                    userId: mockUserId,
                    accessType: 'view',
                    userRole: 'regular_user',
                    accessGranted: false,
                    denialReason: 'Insufficient role permissions'
                })
            );
        });
    });
});