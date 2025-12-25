/**
 * Report Snapshot Service
 * 
 * Manages immutable report snapshots for audit trails and re-delivery capability.
 * Implements role-based access control (Super Admin, Security Analyst only) and
 * includes template and data schema versioning for reproducibility.
 * 
 * Requirements: 9.2, audit compliance
 */

import { db, withTransaction } from '@/lib/database';
import { logger } from '@/lib/logger';
import {
    reportSnapshots,
    reportAccessLogs,
    reportGenerationQueue
} from '../../../database/schemas/reports';
import { users } from '../../../database/schemas/main';
import { and, eq, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import {
    ReportSnapshot,
    SnapshotFilters,
    SnapshotListResponse,
    EnhancedDateRange,
    SlideData
} from '@/types/reports';

/**
 * User roles that have access to reports functionality
 */
const AUTHORIZED_ROLES = ['super_admin', 'security_analyst'] as const;
type AuthorizedRole = typeof AUTHORIZED_ROLES[number];

/**
 * Access types for audit logging
 */
type AccessType = 'view' | 'download' | 'export' | 'list';

/**
 * Report Snapshot Service
 * 
 * Provides secure access to report snapshots with role-based access control
 * and comprehensive audit logging.
 */
export class ReportSnapshotService {

    /**
     * Validates user authorization for reports access
     */
    private async validateUserAccess(userId: string, tenantId: string): Promise<{
        authorized: boolean;
        userRole: string;
        denialReason?: string
    }> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const user = await db
                .select({
                    id: users.id,
                    role: users.role,
                    tenantId: users.tenant_id,
                    isActive: users.is_active
                })
                .from(users)
                .where(
                    and(
                        eq(users.id, userId),
                        eq(users.tenant_id, tenantId),
                        eq(users.is_active, true)
                    )
                )
                .limit(1);

            if (user.length === 0) {
                return {
                    authorized: false,
                    userRole: 'unknown',
                    denialReason: 'User not found or inactive'
                };
            }

            const userRole = user[0].role;

            if (!AUTHORIZED_ROLES.includes(userRole as AuthorizedRole)) {
                return {
                    authorized: false,
                    userRole,
                    denialReason: 'Insufficient role permissions'
                };
            }

            return {
                authorized: true,
                userRole
            };

        } catch (error) {
            logger.error('Failed to validate user access', error instanceof Error ? error : new Error(String(error)), {
                userId,
                tenantId,
                category: 'reports'
            });

            return {
                authorized: false,
                userRole: 'unknown',
                denialReason: 'Access validation failed'
            };
        }
    }

    /**
     * Logs access attempts for audit compliance
     */
    private async logAccess(
        snapshotId: string | null,
        tenantId: string,
        userId: string,
        accessType: AccessType,
        userRole: string,
        accessGranted: boolean,
        denialReason?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        try {
            if (!db) {
                return;
            }

            // Only log if we have a valid snapshotId (access logs require it)
            if (snapshotId) {
                await db.insert(reportAccessLogs).values({
                    snapshotId,
                    tenantId,
                    userId,
                    accessType,
                    userRole,
                    accessGranted,
                    denialReason: denialReason || null,
                    ipAddress: ipAddress || null,
                    userAgent: userAgent || null
                });
            }

        } catch (error) {
            // Log access logging failures but don't throw - this shouldn't block operations
            logger.error('Failed to log report access', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                tenantId,
                userId,
                accessType,
                category: 'reports'
            });
        }
    }

    /**
     * Creates a new report snapshot
     * 
     * @param reportData - Report data to snapshot
     * @param userId - User creating the snapshot
     * @param ipAddress - Client IP address for audit
     * @param userAgent - Client user agent for audit
     * @returns Promise<ReportSnapshot> - Created snapshot
     */
    async createSnapshot(
        reportData: {
            tenantId: string;
            reportId: string;
            reportType: 'weekly' | 'monthly' | 'quarterly';
            dateRange: EnhancedDateRange;
            slideData: SlideData[];
            templateVersion: string;
            dataSchemaVersion: string;
        },
        userId: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<ReportSnapshot> {
        const { tenantId, reportId, reportType, dateRange, slideData, templateVersion, dataSchemaVersion } = reportData;

        // Validate user access
        const accessCheck = await this.validateUserAccess(userId, tenantId);

        if (!accessCheck.authorized) {
            await this.logAccess(
                null,
                tenantId,
                userId,
                'export',
                accessCheck.userRole,
                false,
                accessCheck.denialReason,
                ipAddress,
                userAgent
            );
            throw new Error(`Access denied: ${accessCheck.denialReason}`);
        }

        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const snapshot = await withTransaction(async (tx) => {
                if (!tx) {
                    throw new Error('Transaction not available');
                }

                // Create the snapshot
                const [newSnapshot] = await tx.insert(reportSnapshots).values({
                    tenantId,
                    reportId,
                    reportType,
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    timezone: dateRange.timezone,
                    generatedAt: new Date(),
                    generatedBy: userId,
                    slideData: slideData as any, // JSON serialization
                    templateVersion,
                    dataSchemaVersion,
                    isArchived: false
                }).returning();

                return newSnapshot;
            });

            // Log successful access
            await this.logAccess(
                snapshot.id,
                tenantId,
                userId,
                'export',
                accessCheck.userRole,
                true,
                undefined,
                ipAddress,
                userAgent
            );

            // Transform to ReportSnapshot type
            const result: ReportSnapshot = {
                id: snapshot.id,
                tenantId: snapshot.tenantId,
                reportId: snapshot.reportId,
                reportType: snapshot.reportType as 'weekly' | 'monthly' | 'quarterly',
                dateRange: {
                    startDate: snapshot.startDate,
                    endDate: snapshot.endDate,
                    timezone: snapshot.timezone,
                    weekStart: 'monday'
                },
                generatedAt: snapshot.generatedAt,
                generatedBy: snapshot.generatedBy,
                slideData: snapshot.slideData as SlideData[],
                templateVersion: snapshot.templateVersion,
                dataSchemaVersion: snapshot.dataSchemaVersion,
                pdfStorageKey: snapshot.pdfStorageKey || undefined,
                pdfSize: snapshot.pdfSize || undefined,
                isArchived: snapshot.isArchived
            };

            logger.info('Report snapshot created', {
                snapshotId: snapshot.id,
                tenantId,
                reportType,
                userId,
                category: 'reports'
            });

            return result;

        } catch (error) {
            await this.logAccess(
                null,
                tenantId,
                userId,
                'export',
                accessCheck.userRole,
                false,
                'Snapshot creation failed',
                ipAddress,
                userAgent
            );

            logger.error('Failed to create report snapshot', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportId,
                reportType,
                userId,
                category: 'reports'
            });

            throw new Error(`Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Retrieves a specific report snapshot by ID
     * 
     * @param snapshotId - Snapshot identifier
     * @param userId - User requesting the snapshot
     * @param tenantId - Tenant identifier for access control
     * @param ipAddress - Client IP address for audit
     * @param userAgent - Client user agent for audit
     * @returns Promise<ReportSnapshot | null> - Snapshot or null if not found/unauthorized
     */
    async getSnapshot(
        snapshotId: string,
        userId: string,
        tenantId: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<ReportSnapshot | null> {
        // Validate user access
        const accessCheck = await this.validateUserAccess(userId, tenantId);

        if (!accessCheck.authorized) {
            await this.logAccess(
                snapshotId,
                tenantId,
                userId,
                'view',
                accessCheck.userRole,
                false,
                accessCheck.denialReason,
                ipAddress,
                userAgent
            );
            throw new Error(`Access denied: ${accessCheck.denialReason}`);
        }

        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const [snapshot] = await db
                .select()
                .from(reportSnapshots)
                .where(
                    and(
                        eq(reportSnapshots.id, snapshotId),
                        eq(reportSnapshots.tenantId, tenantId)
                    )
                )
                .limit(1);

            if (!snapshot) {
                await this.logAccess(
                    snapshotId,
                    tenantId,
                    userId,
                    'view',
                    accessCheck.userRole,
                    false,
                    'Snapshot not found',
                    ipAddress,
                    userAgent
                );
                return null;
            }

            // Log successful access
            await this.logAccess(
                snapshotId,
                tenantId,
                userId,
                'view',
                accessCheck.userRole,
                true,
                undefined,
                ipAddress,
                userAgent
            );

            // Transform to ReportSnapshot type
            const result: ReportSnapshot = {
                id: snapshot.id,
                tenantId: snapshot.tenantId,
                reportId: snapshot.reportId,
                reportType: snapshot.reportType as 'weekly' | 'monthly' | 'quarterly',
                dateRange: {
                    startDate: snapshot.startDate,
                    endDate: snapshot.endDate,
                    timezone: snapshot.timezone,
                    weekStart: 'monday'
                },
                generatedAt: snapshot.generatedAt,
                generatedBy: snapshot.generatedBy,
                slideData: snapshot.slideData as SlideData[],
                templateVersion: snapshot.templateVersion,
                dataSchemaVersion: snapshot.dataSchemaVersion,
                pdfStorageKey: snapshot.pdfStorageKey || undefined,
                pdfSize: snapshot.pdfSize || undefined,
                isArchived: snapshot.isArchived
            };

            return result;

        } catch (error) {
            await this.logAccess(
                snapshotId,
                tenantId,
                userId,
                'view',
                accessCheck.userRole,
                false,
                'Retrieval failed',
                ipAddress,
                userAgent
            );

            logger.error('Failed to retrieve report snapshot', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                tenantId,
                userId,
                category: 'reports'
            });

            throw new Error(`Failed to retrieve snapshot: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Gets a report snapshot by report ID
     * 
     * @param reportId - Report identifier
     * @returns Promise<ReportSnapshot | null> - Snapshot or null if not found
     */
    async getSnapshotByReportId(reportId: string): Promise<ReportSnapshot | null> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const [snapshot] = await db
                .select()
                .from(reportSnapshots)
                .where(eq(reportSnapshots.reportId, reportId))
                .orderBy(desc(reportSnapshots.generatedAt))
                .limit(1);

            if (!snapshot) {
                return null;
            }

            // Transform to ReportSnapshot type
            const result: ReportSnapshot = {
                id: snapshot.id,
                tenantId: snapshot.tenantId,
                reportId: snapshot.reportId,
                reportType: snapshot.reportType as 'weekly' | 'monthly' | 'quarterly',
                dateRange: {
                    startDate: snapshot.startDate,
                    endDate: snapshot.endDate,
                    timezone: snapshot.timezone,
                    weekStart: 'monday'
                },
                generatedAt: snapshot.generatedAt,
                generatedBy: snapshot.generatedBy,
                slideData: snapshot.slideData as SlideData[],
                templateVersion: snapshot.templateVersion,
                dataSchemaVersion: snapshot.dataSchemaVersion,
                pdfStorageKey: snapshot.pdfStorageKey || undefined,
                pdfSize: snapshot.pdfSize || undefined,
                isArchived: snapshot.isArchived
            };

            return result;

        } catch (error) {
            logger.error('Failed to retrieve report snapshot by report ID', error instanceof Error ? error : new Error(String(error)), {
                reportId,
                category: 'reports'
            });

            throw new Error(`Failed to retrieve snapshot: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Updates snapshot with PDF information (for export endpoint compatibility)
     */
    async updateSnapshotPDF(snapshotId: string, storageKey: string, pdfSize: number): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            await db
                .update(reportSnapshots)
                .set({
                    pdfStorageKey: storageKey,
                    pdfSize,
                    updatedAt: new Date()
                })
                .where(eq(reportSnapshots.id, snapshotId));

            logger.info('Snapshot PDF information updated', {
                snapshotId,
                storageKey,
                pdfSize,
                category: 'reports'
            });

        } catch (error) {
            logger.error('Failed to update snapshot PDF information', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                category: 'reports'
            });

            throw new Error(`Failed to update snapshot PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Lists report snapshots with filtering and pagination
     * 
     * @param tenantId - Tenant identifier for access control (optional for super admin)
     * @param filters - Optional filters for the list
     * @param page - Page number (1-based)
     * @param pageSize - Number of items per page
     * @returns Promise<SnapshotListResponse> - Paginated list of snapshots
     */
    async listSnapshots(
        tenantId?: string,
        filters?: SnapshotFilters,
        page: number = 1,
        pageSize: number = 20
    ): Promise<SnapshotListResponse> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Build where conditions
            const whereConditions = [];

            // Add tenant filter if specified (for non-super-admin users)
            if (tenantId) {
                whereConditions.push(eq(reportSnapshots.tenantId, tenantId));
            }

            if (filters?.reportType) {
                whereConditions.push(eq(reportSnapshots.reportType, filters.reportType));
            }

            if (filters?.dateRange) {
                whereConditions.push(
                    gte(reportSnapshots.startDate, filters.dateRange.startDate),
                    lte(reportSnapshots.endDate, filters.dateRange.endDate)
                );
            }

            if (filters?.generatedBy) {
                whereConditions.push(eq(reportSnapshots.generatedBy, filters.generatedBy));
            }

            if (filters?.isArchived !== undefined) {
                whereConditions.push(eq(reportSnapshots.isArchived, filters.isArchived));
            }

            // Get total count
            const countQuery = db
                .select({ count: sql<number>`count(*)` })
                .from(reportSnapshots);

            if (whereConditions.length > 0) {
                countQuery.where(and(...whereConditions));
            }

            const [countResult] = await countQuery;
            const totalCount = countResult.count;

            // Get paginated results
            const offset = (page - 1) * pageSize;
            const snapshotsQuery = db
                .select()
                .from(reportSnapshots)
                .orderBy(desc(reportSnapshots.generatedAt))
                .limit(pageSize)
                .offset(offset);

            if (whereConditions.length > 0) {
                snapshotsQuery.where(and(...whereConditions));
            }

            const snapshots = await snapshotsQuery;



            // Transform to ReportSnapshot types
            const transformedSnapshots: ReportSnapshot[] = snapshots.map(snapshot => ({
                id: snapshot.id,
                tenantId: snapshot.tenantId,
                reportId: snapshot.reportId,
                reportType: snapshot.reportType as 'weekly' | 'monthly' | 'quarterly',
                dateRange: {
                    startDate: snapshot.startDate,
                    endDate: snapshot.endDate,
                    timezone: snapshot.timezone,
                    weekStart: 'monday'
                },
                generatedAt: snapshot.generatedAt,
                generatedBy: snapshot.generatedBy,
                slideData: snapshot.slideData as SlideData[],
                templateVersion: snapshot.templateVersion,
                dataSchemaVersion: snapshot.dataSchemaVersion,
                pdfStorageKey: snapshot.pdfStorageKey || undefined,
                pdfSize: snapshot.pdfSize || undefined,
                isArchived: snapshot.isArchived
            }));

            return {
                snapshots: transformedSnapshots,
                totalCount,
                page,
                pageSize
            };

        } catch (error) {
            logger.error('Failed to list report snapshots', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                filters,
                page,
                pageSize,
                category: 'reports'
            });

            throw new Error(`Failed to list snapshots: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Updates PDF storage information for a snapshot
     * 
     * @param snapshotId - Snapshot identifier
     * @param pdfStorageKey - S3 key or file path
     * @param pdfSize - File size in bytes
     * @param pdfChecksum - SHA-256 checksum for integrity
     * @param userId - User performing the update
     * @param tenantId - Tenant identifier for access control
     * @returns Promise<void>
     */
    async updatePdfStorage(
        snapshotId: string,
        pdfStorageKey: string,
        pdfSize: number,
        pdfChecksum: string,
        userId: string,
        tenantId: string
    ): Promise<void> {
        // Validate user access
        const accessCheck = await this.validateUserAccess(userId, tenantId);

        if (!accessCheck.authorized) {
            throw new Error(`Access denied: ${accessCheck.denialReason}`);
        }

        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            await db
                .update(reportSnapshots)
                .set({
                    pdfStorageKey,
                    pdfSize,
                    pdfChecksum,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(reportSnapshots.id, snapshotId),
                        eq(reportSnapshots.tenantId, tenantId)
                    )
                );

            logger.info('PDF storage updated for snapshot', {
                snapshotId,
                pdfStorageKey,
                pdfSize,
                tenantId,
                userId,
                category: 'reports'
            });

        } catch (error) {
            logger.error('Failed to update PDF storage', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                tenantId,
                userId,
                category: 'reports'
            });

            throw new Error(`Failed to update PDF storage: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Archives a report snapshot
     * 
     * @param snapshotId - Snapshot identifier
     * @param userId - User performing the archive
     * @param tenantId - Tenant identifier for access control
     * @returns Promise<void>
     */
    async archiveSnapshot(
        snapshotId: string,
        userId: string,
        tenantId: string
    ): Promise<void> {
        // Validate user access
        const accessCheck = await this.validateUserAccess(userId, tenantId);

        if (!accessCheck.authorized) {
            throw new Error(`Access denied: ${accessCheck.denialReason}`);
        }

        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            await db
                .update(reportSnapshots)
                .set({
                    isArchived: true,
                    archivedAt: new Date(),
                    archivedBy: userId,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(reportSnapshots.id, snapshotId),
                        eq(reportSnapshots.tenantId, tenantId)
                    )
                );

            logger.info('Report snapshot archived', {
                snapshotId,
                tenantId,
                userId,
                category: 'reports'
            });

        } catch (error) {
            logger.error('Failed to archive snapshot', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                tenantId,
                userId,
                category: 'reports'
            });

            throw new Error(`Failed to archive snapshot: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

/**
 * Default instance for use throughout the application
 */
export const reportSnapshotService = new ReportSnapshotService();