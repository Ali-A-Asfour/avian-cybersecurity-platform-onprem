/**
 * Playbook Manager Service for Alerts & Security Incidents Module
 * 
 * Manages investigation playbooks with classification linking:
 * - Role-based access control (Super Admin CRUD, Analyst read-only)
 * - Multiple classification linking with primary/secondary relationships
 * - Automatic playbook attachment based on alert classification
 * - Version control and status management (Active, Draft, Deprecated)
 * - Exactly one active primary playbook per classification constraint
 * 
 * Requirements: 5.1, 5.2, 5.3, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { db } from '../../lib/database';
import {
    investigationPlaybooks,
    playbookClassificationLinks,
    securityAlerts
} from '../../../database/schemas/alerts-incidents';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import {
    InvestigationPlaybook,
    CreateInvestigationPlaybookInput,
    UpdateInvestigationPlaybookInput,
    PlaybookClassificationLink,
    PlaybookStatus,
    SecurityAlert,
    AlertWithPlaybooks,
} from '../../types/alerts-incidents';

/**
 * User roles for playbook access control
 */
export type UserRole = 'super_admin' | 'security_analyst';

/**
 * Playbook classification link input
 */
export interface PlaybookClassificationLinkInput {
    classification: string;
    isPrimary: boolean;
}

/**
 * Playbook filters for querying
 */
export interface PlaybookFilters {
    status?: PlaybookStatus | PlaybookStatus[];
    classification?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
}

/**
 * Playbook Manager Class
 * 
 * Provides comprehensive playbook management with role-based access control,
 * classification linking, and automatic attachment functionality.
 */
export class PlaybookManager {

    // ========================================================================
    // Playbook CRUD Operations (Super Admin Only)
    // ========================================================================

    /**
     * Create new investigation playbook with classification links
     * Requirements: 9.1, 9.2, 9.3
     */
    static async createPlaybook(
        input: CreateInvestigationPlaybookInput,
        classifications: PlaybookClassificationLinkInput[],
        userRole: UserRole
    ): Promise<string> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate role-based access control
            if (userRole !== 'super_admin') {
                throw new Error('Insufficient permissions. Only Super Admins can create playbooks.');
            }

            // Validate input
            if (!input.name || input.name.trim().length === 0) {
                throw new Error('Playbook name is required');
            }

            if (!input.version || input.version.trim().length === 0) {
                throw new Error('Playbook version is required');
            }

            if (!input.purpose || input.purpose.trim().length === 0) {
                throw new Error('Playbook purpose is required');
            }

            if (!input.decisionGuidance) {
                throw new Error('Decision guidance is required');
            }

            // Validate classifications
            if (classifications.length === 0) {
                throw new Error('At least one classification must be linked to the playbook');
            }

            const primaryClassifications = classifications.filter(c => c.isPrimary);
            if (primaryClassifications.length === 0) {
                throw new Error('At least one classification must be marked as primary');
            }

            // Start transaction for atomic operation
            return await db.transaction(async (tx) => {
                // Check for existing playbook with same name and version
                const existingPlaybook = await tx.select().from(investigationPlaybooks).where(
                    and(
                        eq(investigationPlaybooks.name, input.name),
                        eq(investigationPlaybooks.version, input.version)
                    )
                ).limit(1);

                if (existingPlaybook.length > 0) {
                    throw new Error(`Playbook with name "${input.name}" and version "${input.version}" already exists`);
                }

                // For each primary classification, check if there's already an active primary playbook
                if (input.status === 'active') {
                    for (const classification of primaryClassifications) {
                        const existingPrimary = await tx.select().from(playbookClassificationLinks).where(
                            and(
                                eq(playbookClassificationLinks.classification, classification.classification),
                                eq(playbookClassificationLinks.isPrimary, true),
                                eq(playbookClassificationLinks.playbookStatus, 'active')
                            )
                        ).limit(1);

                        if (existingPrimary.length > 0) {
                            throw new Error(`Classification "${classification.classification}" already has an active primary playbook`);
                        }
                    }
                }

                // Create playbook
                const [playbook] = await tx.insert(investigationPlaybooks).values({
                    name: input.name,
                    version: input.version,
                    status: input.status || 'draft',
                    purpose: input.purpose,
                    initialValidationSteps: input.initialValidationSteps || [],
                    sourceInvestigationSteps: input.sourceInvestigationSteps || [],
                    containmentChecks: input.containmentChecks || [],
                    decisionGuidance: input.decisionGuidance,
                    createdBy: input.createdBy,
                }).returning();

                // Create classification links
                const linkValues = classifications.map(classification => ({
                    playbookId: playbook.id,
                    classification: classification.classification,
                    isPrimary: classification.isPrimary,
                    playbookStatus: playbook.status,
                }));

                await tx.insert(playbookClassificationLinks).values(linkValues);

                logger.info('Playbook created', {
                    playbookId: playbook.id,
                    name: input.name,
                    version: input.version,
                    status: playbook.status,
                    createdBy: input.createdBy,
                    classifications: classifications.map(c => c.classification),
                });

                return playbook.id;
            });
        } catch (error) {
            logger.error('Failed to create playbook', error instanceof Error ? error : new Error(String(error)), {
                name: input.name,
                version: input.version,
                createdBy: input.createdBy,
            });
            throw error;
        }
    }

    /**
     * Update existing investigation playbook
     * Requirements: 9.1, 9.2, 9.3
     */
    static async updatePlaybook(
        playbookId: string,
        input: UpdateInvestigationPlaybookInput,
        classifications?: PlaybookClassificationLinkInput[],
        userRole: UserRole
    ): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate role-based access control
            if (userRole !== 'super_admin') {
                throw new Error('Insufficient permissions. Only Super Admins can update playbooks.');
            }

            await db.transaction(async (tx) => {
                // Fetch existing playbook
                const existingPlaybook = await tx.select().from(investigationPlaybooks).where(
                    eq(investigationPlaybooks.id, playbookId)
                ).limit(1);

                if (existingPlaybook.length === 0) {
                    throw new Error('Playbook not found');
                }

                const currentPlaybook = existingPlaybook[0] as InvestigationPlaybook;

                // Check for name/version conflicts if updating those fields
                if (input.name || input.version) {
                    const nameToCheck = input.name || currentPlaybook.name;
                    const versionToCheck = input.version || currentPlaybook.version;

                    const conflictingPlaybook = await tx.select().from(investigationPlaybooks).where(
                        and(
                            eq(investigationPlaybooks.name, nameToCheck),
                            eq(investigationPlaybooks.version, versionToCheck),
                            sql`${investigationPlaybooks.id} != ${playbookId}`
                        )
                    ).limit(1);

                    if (conflictingPlaybook.length > 0) {
                        throw new Error(`Playbook with name "${nameToCheck}" and version "${versionToCheck}" already exists`);
                    }
                }

                // If updating status to active and classifications are provided, validate primary constraints
                if (input.status === 'active' && classifications) {
                    const primaryClassifications = classifications.filter(c => c.isPrimary);

                    for (const classification of primaryClassifications) {
                        const existingPrimary = await tx.select().from(playbookClassificationLinks).where(
                            and(
                                eq(playbookClassificationLinks.classification, classification.classification),
                                eq(playbookClassificationLinks.isPrimary, true),
                                eq(playbookClassificationLinks.playbookStatus, 'active'),
                                sql`${playbookClassificationLinks.playbookId} != ${playbookId}`
                            )
                        ).limit(1);

                        if (existingPrimary.length > 0) {
                            throw new Error(`Classification "${classification.classification}" already has an active primary playbook`);
                        }
                    }
                }

                // Update playbook
                const updateData: any = {
                    updatedAt: new Date(),
                };

                if (input.name !== undefined) updateData.name = input.name;
                if (input.version !== undefined) updateData.version = input.version;
                if (input.status !== undefined) updateData.status = input.status;
                if (input.purpose !== undefined) updateData.purpose = input.purpose;
                if (input.initialValidationSteps !== undefined) updateData.initialValidationSteps = input.initialValidationSteps;
                if (input.sourceInvestigationSteps !== undefined) updateData.sourceInvestigationSteps = input.sourceInvestigationSteps;
                if (input.containmentChecks !== undefined) updateData.containmentChecks = input.containmentChecks;
                if (input.decisionGuidance !== undefined) updateData.decisionGuidance = input.decisionGuidance;

                const [updatedPlaybook] = await tx.update(investigationPlaybooks)
                    .set(updateData)
                    .where(eq(investigationPlaybooks.id, playbookId))
                    .returning();

                // Update classification links if provided
                if (classifications) {
                    // Delete existing links
                    await tx.delete(playbookClassificationLinks).where(
                        eq(playbookClassificationLinks.playbookId, playbookId)
                    );

                    // Create new links
                    if (classifications.length > 0) {
                        const linkValues = classifications.map(classification => ({
                            playbookId: playbookId,
                            classification: classification.classification,
                            isPrimary: classification.isPrimary,
                            playbookStatus: updatedPlaybook.status,
                        }));

                        await tx.insert(playbookClassificationLinks).values(linkValues);
                    }
                } else if (input.status !== undefined) {
                    // Update denormalized status in existing links
                    await tx.update(playbookClassificationLinks)
                        .set({ playbookStatus: input.status })
                        .where(eq(playbookClassificationLinks.playbookId, playbookId));
                }

                logger.info('Playbook updated', {
                    playbookId,
                    name: updatedPlaybook.name,
                    version: updatedPlaybook.version,
                    status: updatedPlaybook.status,
                    classificationsUpdated: classifications ? classifications.map(c => c.classification) : null,
                });
            });
        } catch (error) {
            logger.error('Failed to update playbook', error instanceof Error ? error : new Error(String(error)), {
                playbookId,
            });
            throw error;
        }
    }

    /**
     * Delete investigation playbook
     * Requirements: 9.1
     */
    static async deletePlaybook(playbookId: string, userRole: UserRole): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate role-based access control
            if (userRole !== 'super_admin') {
                throw new Error('Insufficient permissions. Only Super Admins can delete playbooks.');
            }

            const result = await db.delete(investigationPlaybooks)
                .where(eq(investigationPlaybooks.id, playbookId))
                .returning();

            if (result.length === 0) {
                throw new Error('Playbook not found');
            }

            logger.info('Playbook deleted', {
                playbookId,
                name: result[0].name,
                version: result[0].version,
            });
        } catch (error) {
            logger.error('Failed to delete playbook', error instanceof Error ? error : new Error(String(error)), {
                playbookId,
            });
            throw error;
        }
    }

    // ========================================================================
    // Playbook Querying (All Users)
    // ========================================================================

    /**
     * Get playbooks with filtering
     * Requirements: 5.3, 9.4
     */
    static async getPlaybooks(filters: PlaybookFilters = {}): Promise<InvestigationPlaybook[]> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const conditions = [];

            // Filter by status
            if (filters.status) {
                if (Array.isArray(filters.status)) {
                    conditions.push(inArray(investigationPlaybooks.status, filters.status));
                } else {
                    conditions.push(eq(investigationPlaybooks.status, filters.status));
                }
            }

            // Filter by creator
            if (filters.createdBy) {
                conditions.push(eq(investigationPlaybooks.createdBy, filters.createdBy));
            }

            // Build base query
            let query = db
                .select()
                .from(investigationPlaybooks)
                .orderBy(desc(investigationPlaybooks.createdAt));

            if (conditions.length > 0) {
                query = query.where(and(...conditions));
            }

            // Apply pagination
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            if (filters.offset) {
                query = query.offset(filters.offset);
            }

            let playbooks = await query;

            // Filter by classification if specified
            if (filters.classification) {
                const playbookIds = await db
                    .select({ playbookId: playbookClassificationLinks.playbookId })
                    .from(playbookClassificationLinks)
                    .where(eq(playbookClassificationLinks.classification, filters.classification));

                const filteredIds = playbookIds.map(p => p.playbookId);
                playbooks = playbooks.filter(p => filteredIds.includes(p.id));
            }

            return playbooks as InvestigationPlaybook[];
        } catch (error) {
            logger.error('Failed to get playbooks', error instanceof Error ? error : new Error(String(error)), {
                filters,
            });
            throw error;
        }
    }

    /**
     * Get playbook by ID with classification links
     * Requirements: 5.3, 9.4
     */
    static async getPlaybookById(playbookId: string): Promise<{
        playbook: InvestigationPlaybook;
        classifications: PlaybookClassificationLink[];
    } | null> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Fetch playbook
            const playbook = await db.select().from(investigationPlaybooks).where(
                eq(investigationPlaybooks.id, playbookId)
            ).limit(1);

            if (playbook.length === 0) {
                return null;
            }

            // Fetch classification links
            const classifications = await db.select().from(playbookClassificationLinks).where(
                eq(playbookClassificationLinks.playbookId, playbookId)
            );

            return {
                playbook: playbook[0] as InvestigationPlaybook,
                classifications: classifications as PlaybookClassificationLink[],
            };
        } catch (error) {
            logger.error('Failed to get playbook by ID', error instanceof Error ? error : new Error(String(error)), {
                playbookId,
            });
            throw error;
        }
    }

    /**
     * Get active playbooks for classification
     * Requirements: 5.1, 5.2
     */
    static async getPlaybooksForClassification(classification: string): Promise<{
        primary: InvestigationPlaybook | null;
        secondary: InvestigationPlaybook[];
    }> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Get all active playbooks for this classification
            const playbookLinks = await db
                .select({
                    playbook: investigationPlaybooks,
                    isPrimary: playbookClassificationLinks.isPrimary,
                })
                .from(playbookClassificationLinks)
                .innerJoin(
                    investigationPlaybooks,
                    eq(playbookClassificationLinks.playbookId, investigationPlaybooks.id)
                )
                .where(and(
                    eq(playbookClassificationLinks.classification, classification),
                    eq(playbookClassificationLinks.playbookStatus, 'active')
                ))
                .orderBy(desc(playbookClassificationLinks.isPrimary));

            const primary = playbookLinks.find(link => link.isPrimary)?.playbook as InvestigationPlaybook || null;
            const secondary = playbookLinks
                .filter(link => !link.isPrimary)
                .map(link => link.playbook as InvestigationPlaybook);

            return { primary, secondary };
        } catch (error) {
            logger.error('Failed to get playbooks for classification', error instanceof Error ? error : new Error(String(error)), {
                classification,
            });
            throw error;
        }
    }

    // ========================================================================
    // Automatic Playbook Attachment
    // ========================================================================

    /**
     * Attach playbooks to alert based on classification
     * Requirements: 5.1, 5.2
     */
    static async attachPlaybooksToAlert(alert: SecurityAlert): Promise<AlertWithPlaybooks> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Get playbooks for alert classification
            const { primary, secondary } = await this.getPlaybooksForClassification(alert.classification);

            // Combine primary and secondary playbooks
            const playbooks: InvestigationPlaybook[] = [];
            if (primary) {
                playbooks.push(primary);
            }
            playbooks.push(...secondary);

            logger.debug('Playbooks attached to alert', {
                alertId: alert.id,
                classification: alert.classification,
                primaryPlaybook: primary?.id || null,
                secondaryPlaybooks: secondary.map(p => p.id),
            });

            return {
                alert,
                playbooks,
            };
        } catch (error) {
            logger.error('Failed to attach playbooks to alert', error instanceof Error ? error : new Error(String(error)), {
                alertId: alert.id,
                classification: alert.classification,
            });

            // Return alert without playbooks on error (graceful degradation)
            return {
                alert,
                playbooks: [],
            };
        }
    }

    /**
     * Get alert with attached playbooks
     * Requirements: 5.1, 5.2
     */
    static async getAlertWithPlaybooks(
        alertId: string,
        tenantId: string
    ): Promise<AlertWithPlaybooks | null> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Fetch alert with tenant isolation
            const alert = await db.select().from(securityAlerts).where(
                and(
                    eq(securityAlerts.id, alertId),
                    eq(securityAlerts.tenantId, tenantId)
                )
            ).limit(1);

            if (alert.length === 0) {
                return null;
            }

            // Attach playbooks
            return this.attachPlaybooksToAlert(alert[0] as SecurityAlert);
        } catch (error) {
            logger.error('Failed to get alert with playbooks', error instanceof Error ? error : new Error(String(error)), {
                alertId,
                tenantId,
            });
            throw error;
        }
    }

    // ========================================================================
    // Classification Management
    // ========================================================================

    /**
     * Get all classifications with their primary playbooks
     * Requirements: 9.2, 9.3
     */
    static async getClassificationSummary(): Promise<{
        classification: string;
        primaryPlaybook: InvestigationPlaybook | null;
        secondaryCount: number;
    }[]> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Get all unique classifications
            const classifications = await db
                .selectDistinct({ classification: playbookClassificationLinks.classification })
                .from(playbookClassificationLinks);

            const summary = [];

            for (const { classification } of classifications) {
                const { primary, secondary } = await this.getPlaybooksForClassification(classification);

                summary.push({
                    classification,
                    primaryPlaybook: primary,
                    secondaryCount: secondary.length,
                });
            }

            return summary.sort((a, b) => a.classification.localeCompare(b.classification));
        } catch (error) {
            logger.error('Failed to get classification summary', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Update classification links for playbook
     * Requirements: 9.2, 9.3
     */
    static async updatePlaybookClassifications(
        playbookId: string,
        classifications: PlaybookClassificationLinkInput[],
        userRole: UserRole
    ): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate role-based access control
            if (userRole !== 'super_admin') {
                throw new Error('Insufficient permissions. Only Super Admins can update playbook classifications.');
            }

            await db.transaction(async (tx) => {
                // Fetch playbook to get current status
                const playbook = await tx.select().from(investigationPlaybooks).where(
                    eq(investigationPlaybooks.id, playbookId)
                ).limit(1);

                if (playbook.length === 0) {
                    throw new Error('Playbook not found');
                }

                const currentPlaybook = playbook[0] as InvestigationPlaybook;

                // If playbook is active, validate primary constraints
                if (currentPlaybook.status === 'active') {
                    const primaryClassifications = classifications.filter(c => c.isPrimary);

                    for (const classification of primaryClassifications) {
                        const existingPrimary = await tx.select().from(playbookClassificationLinks).where(
                            and(
                                eq(playbookClassificationLinks.classification, classification.classification),
                                eq(playbookClassificationLinks.isPrimary, true),
                                eq(playbookClassificationLinks.playbookStatus, 'active'),
                                sql`${playbookClassificationLinks.playbookId} != ${playbookId}`
                            )
                        ).limit(1);

                        if (existingPrimary.length > 0) {
                            throw new Error(`Classification "${classification.classification}" already has an active primary playbook`);
                        }
                    }
                }

                // Delete existing links
                await tx.delete(playbookClassificationLinks).where(
                    eq(playbookClassificationLinks.playbookId, playbookId)
                );

                // Create new links
                if (classifications.length > 0) {
                    const linkValues = classifications.map(classification => ({
                        playbookId: playbookId,
                        classification: classification.classification,
                        isPrimary: classification.isPrimary,
                        playbookStatus: currentPlaybook.status,
                    }));

                    await tx.insert(playbookClassificationLinks).values(linkValues);
                }

                logger.info('Playbook classifications updated', {
                    playbookId,
                    classifications: classifications.map(c => c.classification),
                });
            });
        } catch (error) {
            logger.error('Failed to update playbook classifications', error instanceof Error ? error : new Error(String(error)), {
                playbookId,
            });
            throw error;
        }
    }

    // ========================================================================
    // Version Control and Status Management
    // ========================================================================

    /**
     * Activate playbook (change status to active)
     * Requirements: 9.3, 9.5
     */
    static async activatePlaybook(playbookId: string, userRole: UserRole): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate role-based access control
            if (userRole !== 'super_admin') {
                throw new Error('Insufficient permissions. Only Super Admins can activate playbooks.');
            }

            await db.transaction(async (tx) => {
                // Fetch playbook and its classifications
                const playbook = await tx.select().from(investigationPlaybooks).where(
                    eq(investigationPlaybooks.id, playbookId)
                ).limit(1);

                if (playbook.length === 0) {
                    throw new Error('Playbook not found');
                }

                if (playbook[0].status === 'active') {
                    throw new Error('Playbook is already active');
                }

                // Get primary classifications for this playbook
                const primaryClassifications = await tx.select().from(playbookClassificationLinks).where(
                    and(
                        eq(playbookClassificationLinks.playbookId, playbookId),
                        eq(playbookClassificationLinks.isPrimary, true)
                    )
                );

                // Check for conflicts with existing active primary playbooks
                for (const link of primaryClassifications) {
                    const existingPrimary = await tx.select().from(playbookClassificationLinks).where(
                        and(
                            eq(playbookClassificationLinks.classification, link.classification),
                            eq(playbookClassificationLinks.isPrimary, true),
                            eq(playbookClassificationLinks.playbookStatus, 'active'),
                            sql`${playbookClassificationLinks.playbookId} != ${playbookId}`
                        )
                    ).limit(1);

                    if (existingPrimary.length > 0) {
                        throw new Error(`Classification "${link.classification}" already has an active primary playbook`);
                    }
                }

                // Update playbook status
                await tx.update(investigationPlaybooks)
                    .set({
                        status: 'active',
                        updatedAt: new Date(),
                    })
                    .where(eq(investigationPlaybooks.id, playbookId));

                // Update denormalized status in classification links
                await tx.update(playbookClassificationLinks)
                    .set({ playbookStatus: 'active' })
                    .where(eq(playbookClassificationLinks.playbookId, playbookId));

                logger.info('Playbook activated', {
                    playbookId,
                    name: playbook[0].name,
                    version: playbook[0].version,
                });
            });
        } catch (error) {
            logger.error('Failed to activate playbook', error instanceof Error ? error : new Error(String(error)), {
                playbookId,
            });
            throw error;
        }
    }

    /**
     * Deprecate playbook (change status to deprecated)
     * Requirements: 9.3, 9.5
     */
    static async deprecatePlaybook(playbookId: string, userRole: UserRole): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate role-based access control
            if (userRole !== 'super_admin') {
                throw new Error('Insufficient permissions. Only Super Admins can deprecate playbooks.');
            }

            await db.transaction(async (tx) => {
                // Fetch playbook
                const playbook = await tx.select().from(investigationPlaybooks).where(
                    eq(investigationPlaybooks.id, playbookId)
                ).limit(1);

                if (playbook.length === 0) {
                    throw new Error('Playbook not found');
                }

                if (playbook[0].status === 'deprecated') {
                    throw new Error('Playbook is already deprecated');
                }

                // Update playbook status
                await tx.update(investigationPlaybooks)
                    .set({
                        status: 'deprecated',
                        updatedAt: new Date(),
                    })
                    .where(eq(investigationPlaybooks.id, playbookId));

                // Update denormalized status in classification links
                await tx.update(playbookClassificationLinks)
                    .set({ playbookStatus: 'deprecated' })
                    .where(eq(playbookClassificationLinks.playbookId, playbookId));

                logger.info('Playbook deprecated', {
                    playbookId,
                    name: playbook[0].name,
                    version: playbook[0].version,
                });
            });
        } catch (error) {
            logger.error('Failed to deprecate playbook', error instanceof Error ? error : new Error(String(error)), {
                playbookId,
            });
            throw error;
        }
    }

    /**
     * Get playbook versions for a given name
     * Requirements: 9.5
     */
    static async getPlaybookVersions(name: string): Promise<InvestigationPlaybook[]> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const playbooks = await db.select().from(investigationPlaybooks).where(
                eq(investigationPlaybooks.name, name)
            ).orderBy(desc(investigationPlaybooks.createdAt));

            return playbooks as InvestigationPlaybook[];
        } catch (error) {
            logger.error('Failed to get playbook versions', error instanceof Error ? error : new Error(String(error)), {
                name,
            });
            throw error;
        }
    }
}