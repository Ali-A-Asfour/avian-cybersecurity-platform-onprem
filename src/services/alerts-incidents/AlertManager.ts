/**
 * Alert Manager Service for Alerts & Security Incidents Module
 * 
 * Manages the complete alert lifecycle from ingestion to resolution with:
 * - Tenant-scoped operations
 * - Redis-based deduplication with seenCount intelligence preservation
 * - Alert ingestion and normalization from multiple sources (EDR, Firewall, Email)
 * - Assignment and ownership management with locking
 * - Status transition validation and workflow enforcement
 * 
 * Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 12.1, 12.2
 */

import { db } from '../../lib/database';
import { securityAlerts } from '../../../database/schemas/alerts-incidents';
import { eq, and, desc, gte, lte, inArray, isNull, sql } from 'drizzle-orm';
import { connectRedis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import crypto from 'crypto';
import {
    SecurityAlert,
    CreateSecurityAlertInput,
    UpdateSecurityAlertInput,
    AlertFilters,
    AssignAlertInput,
    ResolveAlertInput,
    AlertStatus,
    AlertSeverity,
    AlertSourceSystem,
    NormalizedAlert,
    EDRAlertInput,
    FirewallAlertInput,
    EmailAlertInput,
    AlertDeduplicationKey,
} from '../../types/alerts-incidents';
import { AuditService } from './AuditService';
import { OwnershipEnforcementService } from './OwnershipEnforcementService';
import { AlertAuditState, AuditContext } from '../../types/audit-logs';

/**
 * Alert Manager Class
 * 
 * Provides comprehensive alert management with tenant isolation,
 * deduplication intelligence, and workflow enforcement.
 */
export class AlertManager {
    private static readonly DEDUP_WINDOW_SECONDS = 300; // 5 minutes for alert deduplication
    private static readonly DEDUP_KEY_PREFIX = 'alert:dedup:';

    // ========================================================================
    // Alert Ingestion and Normalization
    // ========================================================================

    /**
     * Ingest alert from EDR source (Microsoft Defender)
     * Requirements: 12.1, 12.2
     */
    static async ingestEDRAlert(
        tenantId: string,
        edrAlert: EDRAlertInput
    ): Promise<string | null> {
        const normalized = this.normalizeEDRAlert(edrAlert);
        return this.createAlert(tenantId, normalized);
    }

    /**
     * Ingest alert from Firewall source
     * Requirements: 12.1, 12.2
     */
    static async ingestFirewallAlert(
        tenantId: string,
        firewallAlert: FirewallAlertInput
    ): Promise<string | null> {
        const normalized = this.normalizeFirewallAlert(firewallAlert);
        return this.createAlert(tenantId, normalized);
    }

    /**
     * Ingest alert from Email source
     * Requirements: 12.1, 12.2
     */
    static async ingestEmailAlert(
        tenantId: string,
        emailAlert: EmailAlertInput
    ): Promise<string | null> {
        const normalized = this.normalizeEmailAlert(emailAlert);
        return this.createAlert(tenantId, normalized);
    }

    /**
     * Normalize EDR alert to common format
     */
    private static normalizeEDRAlert(edrAlert: EDRAlertInput): NormalizedAlert {
        return {
            sourceSystem: 'edr',
            sourceId: edrAlert.alertId,
            alertType: 'edr_alert',
            classification: this.classifyEDRAlert(edrAlert),
            severity: this.mapEDRSeverity(edrAlert.severity),
            title: edrAlert.title,
            description: edrAlert.description,
            metadata: {
                ...edrAlert.metadata,
                defenderIncidentId: edrAlert.incidentId,
                defenderAlertId: edrAlert.alertId,
                defenderSeverity: edrAlert.severity,
                threatName: edrAlert.threatName,
                affectedDevice: edrAlert.affectedDevice,
                affectedUser: edrAlert.affectedUser,
            },
            detectedAt: edrAlert.detectedAt,
            defenderContext: {
                incidentId: edrAlert.incidentId,
                alertId: edrAlert.alertId,
                severity: edrAlert.severity,
                threatName: edrAlert.threatName,
                affectedDevice: edrAlert.affectedDevice,
                affectedUser: edrAlert.affectedUser,
                deepLink: `https://security.microsoft.com/incidents/${edrAlert.incidentId}`,
            },
        };
    }

    /**
     * Normalize Firewall alert to common format
     */
    private static normalizeFirewallAlert(firewallAlert: FirewallAlertInput): NormalizedAlert {
        return {
            sourceSystem: 'firewall',
            sourceId: `${firewallAlert.deviceId}-${Date.now()}`,
            alertType: firewallAlert.alertType,
            classification: this.classifyFirewallAlert(firewallAlert),
            severity: firewallAlert.severity,
            title: firewallAlert.message,
            description: firewallAlert.message,
            metadata: {
                ...firewallAlert.metadata,
                deviceId: firewallAlert.deviceId,
            },
            detectedAt: firewallAlert.detectedAt,
        };
    }

    /**
     * Normalize Email alert to common format
     */
    private static normalizeEmailAlert(emailAlert: EmailAlertInput): NormalizedAlert {
        return {
            sourceSystem: 'email',
            sourceId: crypto.createHash('sha256').update(`${emailAlert.sender}-${emailAlert.subject}-${emailAlert.receivedAt.getTime()}`).digest('hex'),
            alertType: 'email_alert',
            classification: this.classifyEmailAlert(emailAlert),
            severity: this.extractEmailSeverity(emailAlert),
            title: emailAlert.subject,
            description: emailAlert.body,
            metadata: {
                sender: emailAlert.sender,
                deviceIdentifier: emailAlert.deviceIdentifier,
            },
            detectedAt: emailAlert.receivedAt,
        };
    }

    // ========================================================================
    // Alert Creation and Deduplication
    // ========================================================================

    /**
     * Create alert with deduplication intelligence
     * Requirements: 1.1, 2.1, 12.1, 12.2
     */
    static async createAlert(
        tenantId: string,
        normalizedAlert: NormalizedAlert
    ): Promise<string | null> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Check for duplicate and handle deduplication
            const existingAlert = await this.checkDeduplication(tenantId, normalizedAlert);

            if (existingAlert) {
                // Update existing alert with seenCount intelligence
                await this.updateSeenCount(existingAlert.id);
                logger.debug('Alert deduplicated - seenCount updated', {
                    alertId: existingAlert.id,
                    tenantId,
                    sourceSystem: normalizedAlert.sourceSystem,
                    sourceId: normalizedAlert.sourceId,
                    newSeenCount: existingAlert.seenCount + 1,
                });
                return existingAlert.id;
            }

            // Create new alert
            const input: CreateSecurityAlertInput = {
                tenantId,
                sourceSystem: normalizedAlert.sourceSystem,
                sourceId: normalizedAlert.sourceId,
                alertType: normalizedAlert.alertType,
                classification: normalizedAlert.classification,
                severity: normalizedAlert.severity,
                title: normalizedAlert.title,
                description: normalizedAlert.description,
                metadata: normalizedAlert.metadata,
                detectedAt: normalizedAlert.detectedAt,
                ...(normalizedAlert.defenderContext && {
                    defenderIncidentId: normalizedAlert.defenderContext.incidentId,
                    defenderAlertId: normalizedAlert.defenderContext.alertId,
                    defenderSeverity: normalizedAlert.defenderContext.severity,
                    threatName: normalizedAlert.defenderContext.threatName,
                    affectedDevice: normalizedAlert.defenderContext.affectedDevice,
                    affectedUser: normalizedAlert.defenderContext.affectedUser,
                }),
            };

            const [alert] = await db.insert(securityAlerts).values({
                tenantId: input.tenantId,
                sourceSystem: input.sourceSystem,
                sourceId: input.sourceId,
                alertType: input.alertType,
                classification: input.classification,
                severity: input.severity,
                title: input.title,
                description: input.description || null,
                metadata: input.metadata || {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: input.defenderIncidentId || null,
                defenderAlertId: input.defenderAlertId || null,
                defenderSeverity: input.defenderSeverity || null,
                threatName: input.threatName || null,
                affectedDevice: input.affectedDevice || null,
                affectedUser: input.affectedUser || null,
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: input.detectedAt,
            }).returning();

            // Set deduplication key in Redis
            await this.setDeduplicationKey(tenantId, normalizedAlert, alert.id);

            // Log alert creation for audit trail
            const alertState: AlertAuditState = {
                id: alert.id,
                status: alert.status,
                assignedTo: alert.assignedTo || undefined,
                assignedAt: alert.assignedAt || undefined,
                severity: alert.severity,
                classification: alert.classification,
                title: alert.title,
                sourceSystem: alert.sourceSystem,
                sourceId: alert.sourceId,
                seenCount: alert.seenCount,
                metadata: alert.metadata,
            };

            // Use system user ID for automated alert creation
            await AuditService.logAlertCreated(
                tenantId,
                'system', // System-generated alert
                alert.id,
                alertState
            );

            logger.info('Alert created', {
                alertId: alert.id,
                tenantId,
                sourceSystem: normalizedAlert.sourceSystem,
                sourceId: normalizedAlert.sourceId,
                severity: normalizedAlert.severity,
                classification: normalizedAlert.classification,
            });

            return alert.id;
        } catch (error) {
            logger.error('Failed to create alert', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                sourceSystem: normalizedAlert.sourceSystem,
                sourceId: normalizedAlert.sourceId,
            });
            throw error;
        }
    }

    /**
     * Check for duplicate alerts within deduplication window
     * Requirements: 12.2
     */
    private static async checkDeduplication(
        tenantId: string,
        normalizedAlert: NormalizedAlert
    ): Promise<SecurityAlert | null> {
        try {
            if (!db) {
                return null;
            }

            // Create deduplication key
            const dedupKey: AlertDeduplicationKey = {
                tenantId,
                sourceSystem: normalizedAlert.sourceSystem,
                sourceId: normalizedAlert.sourceId,
                alertType: normalizedAlert.alertType,
                classification: normalizedAlert.classification,
            };

            // Check Redis for recent duplicate
            const redis = await connectRedis();
            if (redis) {
                const redisKey = this.createRedisDeduplicationKey(dedupKey);
                const existingAlertId = await redis.get(redisKey);

                if (existingAlertId) {
                    // Fetch the existing alert from database
                    const existingAlert = await db.select().from(securityAlerts).where(
                        and(
                            eq(securityAlerts.id, existingAlertId),
                            eq(securityAlerts.tenantId, tenantId)
                        )
                    ).limit(1);

                    if (existingAlert.length > 0) {
                        return existingAlert[0] as SecurityAlert;
                    }
                }
            }

            // Fallback: Check database for recent duplicates (last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - this.DEDUP_WINDOW_SECONDS * 1000);
            const existingAlert = await db.select().from(securityAlerts).where(
                and(
                    eq(securityAlerts.tenantId, tenantId),
                    eq(securityAlerts.sourceSystem, normalizedAlert.sourceSystem),
                    eq(securityAlerts.sourceId, normalizedAlert.sourceId),
                    eq(securityAlerts.alertType, normalizedAlert.alertType),
                    eq(securityAlerts.classification, normalizedAlert.classification),
                    gte(securityAlerts.lastSeenAt, fiveMinutesAgo)
                )
            ).limit(1);

            return existingAlert.length > 0 ? existingAlert[0] as SecurityAlert : null;
        } catch (error) {
            logger.error('Deduplication check failed', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                sourceSystem: normalizedAlert.sourceSystem,
                sourceId: normalizedAlert.sourceId,
            });
            // On error, allow alert creation (fail open)
            return null;
        }
    }

    /**
     * Update seenCount for deduplicated alert
     */
    private static async updateSeenCount(alertId: string): Promise<void> {
        if (!db) {
            throw new Error('Database connection not available');
        }

        await db
            .update(securityAlerts)
            .set({
                seenCount: sql`${securityAlerts.seenCount} + 1`,
                lastSeenAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(securityAlerts.id, alertId));
    }

    /**
     * Set deduplication key in Redis
     */
    private static async setDeduplicationKey(
        tenantId: string,
        normalizedAlert: NormalizedAlert,
        alertId: string
    ): Promise<void> {
        try {
            const redis = await connectRedis();
            if (!redis) return;

            const dedupKey: AlertDeduplicationKey = {
                tenantId,
                sourceSystem: normalizedAlert.sourceSystem,
                sourceId: normalizedAlert.sourceId,
                alertType: normalizedAlert.alertType,
                classification: normalizedAlert.classification,
            };

            const redisKey = this.createRedisDeduplicationKey(dedupKey);
            await redis.setEx(redisKey, this.DEDUP_WINDOW_SECONDS, alertId);
        } catch (error) {
            logger.error('Failed to set deduplication key', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                alertId,
            });
            // Non-critical error, continue
        }
    }

    // ========================================================================
    // Assignment and Ownership Management
    // ========================================================================

    /**
     * Assign alert to analyst
     * Requirements: 1.4, 2.1, 2.2, 2.3
     */
    static async assignAlert(input: AssignAlertInput, context?: AuditContext): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate ownership and assignment permissions
            const ownershipValidation = await OwnershipEnforcementService.validateAlertOwnership(
                input.alertId,
                input.tenantId,
                input.assignedTo,
                'assign'
            );

            if (!ownershipValidation.isValid) {
                throw new Error(`Assignment denied: ${ownershipValidation.reason}`);
            }

            // Validate alert exists and is unassigned
            const alert = await db.select().from(securityAlerts).where(
                and(
                    eq(securityAlerts.id, input.alertId),
                    eq(securityAlerts.tenantId, input.tenantId),
                    eq(securityAlerts.status, 'open'),
                    isNull(securityAlerts.assignedTo)
                )
            ).limit(1);

            if (alert.length === 0) {
                throw new Error('Alert not found, already assigned, or not in open status');
            }

            // Update alert with assignment
            const result = await db
                .update(securityAlerts)
                .set({
                    status: 'assigned',
                    assignedTo: input.assignedTo,
                    assignedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(securityAlerts.id, input.alertId),
                    eq(securityAlerts.tenantId, input.tenantId),
                    eq(securityAlerts.status, 'open'), // Ensure still unassigned
                    isNull(securityAlerts.assignedTo)
                ))
                .returning();

            if (result.length === 0) {
                throw new Error('Alert assignment failed - alert may have been assigned by another user');
            }

            // Log alert assignment for audit trail
            const previousState: AlertAuditState = {
                id: alert[0].id,
                status: alert[0].status,
                assignedTo: alert[0].assignedTo || undefined,
                assignedAt: alert[0].assignedAt || undefined,
                severity: alert[0].severity,
                classification: alert[0].classification,
                title: alert[0].title,
                sourceSystem: alert[0].sourceSystem,
                sourceId: alert[0].sourceId,
                seenCount: alert[0].seenCount,
                metadata: alert[0].metadata,
            };

            const newState: AlertAuditState = {
                ...previousState,
                status: 'assigned',
                assignedTo: input.assignedTo,
                assignedAt: new Date(),
            };

            await AuditService.logAlertAssigned(
                input.tenantId,
                input.assignedTo,
                input.alertId,
                previousState,
                newState,
                context
            );

            // Track ownership change for accountability
            await OwnershipEnforcementService.trackOwnershipChange(
                'alert',
                input.alertId,
                input.tenantId,
                null, // No previous owner for assignment
                input.assignedTo,
                input.assignedTo, // Self-assignment
                'Alert assigned to analyst for investigation',
                context
            );

            logger.info('Alert assigned', {
                alertId: input.alertId,
                assignedTo: input.assignedTo,
                tenantId: input.tenantId,
            });
        } catch (error) {
            logger.error('Failed to assign alert', error instanceof Error ? error : new Error(String(error)), {
                alertId: input.alertId,
                assignedTo: input.assignedTo,
                tenantId: input.tenantId,
            });
            throw error;
        }
    }

    /**
     * Start investigation on assigned alert
     * Requirements: 2.3
     */
    static async startInvestigation(alertId: string, tenantId: string, userId: string, context?: AuditContext): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate ownership and investigation permissions
            const ownershipValidation = await OwnershipEnforcementService.validateAlertOwnership(
                alertId,
                tenantId,
                userId,
                'investigate'
            );

            if (!ownershipValidation.isValid) {
                throw new Error(`Investigation denied: ${ownershipValidation.reason}`);
            }

            // Get current alert state before update
            const alert = await db.select().from(securityAlerts).where(
                and(
                    eq(securityAlerts.id, alertId),
                    eq(securityAlerts.tenantId, tenantId),
                    eq(securityAlerts.status, 'assigned'),
                    eq(securityAlerts.assignedTo, userId)
                )
            ).limit(1);

            if (alert.length === 0) {
                throw new Error('Alert not found, not assigned to user, or not in assigned status');
            }

            // Update alert status
            const result = await db
                .update(securityAlerts)
                .set({
                    status: 'investigating',
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(securityAlerts.id, alertId),
                    eq(securityAlerts.tenantId, tenantId),
                    eq(securityAlerts.status, 'assigned'),
                    eq(securityAlerts.assignedTo, userId)
                ))
                .returning();

            if (result.length === 0) {
                throw new Error('Alert update failed - alert may have been modified by another user');
            }

            // Log investigation started for audit trail
            const previousState: AlertAuditState = {
                id: alert[0].id,
                status: alert[0].status,
                assignedTo: alert[0].assignedTo || undefined,
                assignedAt: alert[0].assignedAt || undefined,
                severity: alert[0].severity,
                classification: alert[0].classification,
                title: alert[0].title,
                sourceSystem: alert[0].sourceSystem,
                sourceId: alert[0].sourceId,
                seenCount: alert[0].seenCount,
                metadata: alert[0].metadata,
            };

            const newState: AlertAuditState = {
                ...previousState,
                status: 'investigating',
            };

            await AuditService.logAlertInvestigationStarted(
                tenantId,
                userId,
                alertId,
                previousState,
                newState,
                context
            );

            logger.info('Investigation started', {
                alertId,
                userId,
                tenantId,
            });
        } catch (error) {
            logger.error('Failed to start investigation', error instanceof Error ? error : new Error(String(error)), {
                alertId,
                userId,
                tenantId,
            });
            throw error;
        }
    }

    /**
     * Resolve alert with outcome
     * Requirements: 2.3
     */
    static async resolveAlert(input: ResolveAlertInput, context?: AuditContext): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Add userId to input for ownership validation
            const userId = (input as any).userId || 'unknown';

            // Validate ownership and resolution permissions
            const ownershipValidation = await OwnershipEnforcementService.validateAlertOwnership(
                input.alertId,
                input.tenantId,
                userId,
                'resolve'
            );

            if (!ownershipValidation.isValid) {
                throw new Error(`Resolution denied: ${ownershipValidation.reason}`);
            }

            // Validate input parameters (Requirements 6.1, 6.4, 6.5)
            if (input.outcome !== 'benign' && input.outcome !== 'false_positive') {
                throw new Error('Invalid outcome. Must be "benign" or "false_positive"');
            }

            if (!input.notes || input.notes.trim().length === 0) {
                throw new Error('Analyst notes are required when resolving an alert');
            }

            // Get current alert state before update
            const alert = await db.select().from(securityAlerts).where(
                and(
                    eq(securityAlerts.id, input.alertId),
                    eq(securityAlerts.tenantId, input.tenantId),
                    inArray(securityAlerts.status, ['assigned', 'investigating'])
                )
            ).limit(1);

            if (alert.length === 0) {
                throw new Error('Alert not found or not in resolvable status');
            }

            // Determine status based on validated outcome
            const status: AlertStatus = input.outcome === 'benign' ? 'closed_benign' : 'closed_false_positive';

            // Update alert with resolution
            const result = await db
                .update(securityAlerts)
                .set({
                    status,
                    metadata: sql`${securityAlerts.metadata} || ${JSON.stringify({
                        resolutionNotes: input.notes,
                        resolvedAt: new Date().toISOString(),
                    })}`,
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(securityAlerts.id, input.alertId),
                    eq(securityAlerts.tenantId, input.tenantId),
                    inArray(securityAlerts.status, ['assigned', 'investigating'])
                ))
                .returning();

            if (result.length === 0) {
                throw new Error('Alert resolution failed - alert may have been modified by another user');
            }

            // Log alert resolution for audit trail
            const previousState: AlertAuditState = {
                id: alert[0].id,
                status: alert[0].status,
                assignedTo: alert[0].assignedTo || undefined,
                assignedAt: alert[0].assignedAt || undefined,
                severity: alert[0].severity,
                classification: alert[0].classification,
                title: alert[0].title,
                sourceSystem: alert[0].sourceSystem,
                sourceId: alert[0].sourceId,
                seenCount: alert[0].seenCount,
                metadata: alert[0].metadata,
            };

            const newState: AlertAuditState = {
                ...previousState,
                status,
                metadata: {
                    ...alert[0].metadata,
                    resolutionNotes: input.notes,
                    resolvedAt: new Date().toISOString(),
                },
            };

            await AuditService.logAlertResolved(
                input.tenantId,
                input.userId || 'unknown', // Add userId to ResolveAlertInput type
                input.alertId,
                previousState,
                newState,
                input.outcome,
                input.notes,
                context
            );

            logger.info('Alert resolved', {
                alertId: input.alertId,
                outcome: input.outcome,
                tenantId: input.tenantId,
            });
        } catch (error) {
            logger.error('Failed to resolve alert', error instanceof Error ? error : new Error(String(error)), {
                alertId: input.alertId,
                outcome: input.outcome,
                tenantId: input.tenantId,
            });
            throw error;
        }
    }

    // ========================================================================
    // Alert Querying
    // ========================================================================

    /**
     * Get alerts with tenant-scoped filtering
     * Requirements: 1.1
     */
    static async getAlerts(filters: AlertFilters): Promise<SecurityAlert[]> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const conditions = [eq(securityAlerts.tenantId, filters.tenantId)];

            // Filter by status
            if (filters.status) {
                if (Array.isArray(filters.status)) {
                    conditions.push(inArray(securityAlerts.status, filters.status));
                } else {
                    conditions.push(eq(securityAlerts.status, filters.status));
                }
            }

            // Filter by severity
            if (filters.severity) {
                if (Array.isArray(filters.severity)) {
                    conditions.push(inArray(securityAlerts.severity, filters.severity));
                } else {
                    conditions.push(eq(securityAlerts.severity, filters.severity));
                }
            }

            // Filter by assigned user
            if (filters.assignedTo) {
                conditions.push(eq(securityAlerts.assignedTo, filters.assignedTo));
            }

            // Filter by classification
            if (filters.classification) {
                conditions.push(eq(securityAlerts.classification, filters.classification));
            }

            // Filter by source system
            if (filters.sourceSystem) {
                conditions.push(eq(securityAlerts.sourceSystem, filters.sourceSystem));
            }

            // Filter by date range
            if (filters.startDate) {
                conditions.push(gte(securityAlerts.createdAt, filters.startDate));
            }
            if (filters.endDate) {
                conditions.push(lte(securityAlerts.createdAt, filters.endDate));
            }

            // Build query with ordering
            let query = db
                .select()
                .from(securityAlerts)
                .where(and(...conditions));

            // Apply pagination
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            if (filters.offset) {
                query = query.offset(filters.offset);
            }

            const alerts = await query;
            return alerts as SecurityAlert[];
        } catch (error) {
            logger.error('Failed to get alerts', error instanceof Error ? error : new Error(String(error)), {
                tenantId: filters.tenantId,
            });
            throw error;
        }
    }

    /**
     * Get unassigned alerts for triage queue (All Alerts tab)
     * Requirements: 1.1, 1.2
     * Ordering: severity (Critical→Low) then created time (oldest first)
     */
    static async getTriageQueue(tenantId: string, limit?: number, offset?: number): Promise<SecurityAlert[]> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const conditions = [
                eq(securityAlerts.tenantId, tenantId),
                eq(securityAlerts.status, 'open'),
                isNull(securityAlerts.assignedTo)
            ];

            // Build query with triage queue ordering
            let query = db
                .select()
                .from(securityAlerts)
                .where(and(...conditions))
                .orderBy(
                    // Severity ordering: Critical=0, High=1, Medium=2, Low=3
                    sql`CASE 
                        WHEN ${securityAlerts.severity} = 'critical' THEN 0
                        WHEN ${securityAlerts.severity} = 'high' THEN 1
                        WHEN ${securityAlerts.severity} = 'medium' THEN 2
                        WHEN ${securityAlerts.severity} = 'low' THEN 3
                        ELSE 4
                    END`,
                    // Then by created time (oldest first)
                    securityAlerts.createdAt
                );

            // Apply pagination
            if (limit) {
                query = query.limit(limit);
            }
            if (offset) {
                query = query.offset(offset);
            }

            const alerts = await query;
            return alerts as SecurityAlert[];
        } catch (error) {
            logger.error('Failed to get triage queue', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
            });
            throw error;
        }
    }

    /**
     * Get assigned alerts for investigation queue (My Alerts tab)
     * Requirements: 1.1, 3.2
     * Ordering: assignment time with newest at bottom (ascending order)
     */
    static async getInvestigationQueue(
        tenantId: string,
        assignedTo: string,
        limit?: number,
        offset?: number
    ): Promise<SecurityAlert[]> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const conditions = [
                eq(securityAlerts.tenantId, tenantId),
                eq(securityAlerts.assignedTo, assignedTo),
                inArray(securityAlerts.status, ['assigned', 'investigating'])
            ];

            // Build query with investigation queue ordering
            let query = db
                .select()
                .from(securityAlerts)
                .where(and(...conditions))
                .orderBy(
                    // Order by assignment time (newest at bottom = ascending order)
                    securityAlerts.assignedAt
                );

            // Apply pagination
            if (limit) {
                query = query.limit(limit);
            }
            if (offset) {
                query = query.offset(offset);
            }

            const alerts = await query;
            return alerts as SecurityAlert[];
        } catch (error) {
            logger.error('Failed to get investigation queue', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                assignedTo,
            });
            throw error;
        }
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    /**
     * Create Redis deduplication key
     */
    private static createRedisDeduplicationKey(dedupKey: AlertDeduplicationKey): string {
        const components = [
            dedupKey.tenantId,
            dedupKey.sourceSystem,
            dedupKey.sourceId,
            dedupKey.alertType,
            dedupKey.classification,
        ];

        const hash = crypto
            .createHash('sha256')
            .update(components.join(':'))
            .digest('hex')
            .substring(0, 16);

        return `${this.DEDUP_KEY_PREFIX}${hash}`;
    }

    /**
     * Classify EDR alert based on threat characteristics
     */
    private static classifyEDRAlert(edrAlert: EDRAlertInput): string {
        // Simple classification based on threat name
        const threatName = edrAlert.threatName.toLowerCase();

        if (threatName.includes('malware') || threatName.includes('virus')) {
            return 'malware';
        } else if (threatName.includes('phishing') || threatName.includes('email')) {
            return 'phishing';
        } else if (threatName.includes('suspicious') || threatName.includes('behavior')) {
            return 'suspicious_activity';
        } else if (threatName.includes('network') || threatName.includes('connection')) {
            return 'network_anomaly';
        }

        return 'security_alert';
    }

    /**
     * Classify Firewall alert based on alert type
     */
    private static classifyFirewallAlert(firewallAlert: FirewallAlertInput): string {
        const alertType = firewallAlert.alertType.toLowerCase();

        if (alertType.includes('ips') || alertType.includes('intrusion')) {
            return 'intrusion_attempt';
        } else if (alertType.includes('malware') || alertType.includes('gav')) {
            return 'malware';
        } else if (alertType.includes('botnet')) {
            return 'botnet_activity';
        } else if (alertType.includes('content') || alertType.includes('web')) {
            return 'web_filtering';
        } else if (alertType.includes('vpn') || alertType.includes('wan')) {
            return 'connectivity';
        }

        return 'firewall_alert';
    }

    /**
     * Classify Email alert based on subject and content
     */
    private static classifyEmailAlert(emailAlert: EmailAlertInput): string {
        const subject = emailAlert.subject.toLowerCase();
        const body = emailAlert.body.toLowerCase();

        if (subject.includes('critical') || body.includes('critical')) {
            return 'critical_system_alert';
        } else if (subject.includes('security') || body.includes('security')) {
            return 'security_notification';
        } else if (subject.includes('firewall') || body.includes('firewall')) {
            return 'firewall_notification';
        }

        return 'email_alert';
    }

    /**
     * Map EDR severity to standard severity levels
     */
    private static mapEDRSeverity(edrSeverity: string): AlertSeverity {
        const severity = edrSeverity.toLowerCase();

        switch (severity) {
            case 'critical':
            case 'high':
                return severity as AlertSeverity;
            case 'medium':
            case 'moderate':
                return 'medium';
            case 'low':
            case 'informational':
            case 'info':
                return 'low';
            default:
                return 'medium';
        }
    }

    /**
     * Extract severity from email content
     */
    private static extractEmailSeverity(emailAlert: EmailAlertInput): AlertSeverity {
        const content = `${emailAlert.subject} ${emailAlert.body}`.toLowerCase();

        if (content.includes('critical') || content.includes('urgent')) {
            return 'critical';
        } else if (content.includes('high') || content.includes('important')) {
            return 'high';
        } else if (content.includes('medium') || content.includes('moderate')) {
            return 'medium';
        } else if (content.includes('low') || content.includes('info')) {
            return 'low';
        }

        return 'medium'; // Default
    }
}