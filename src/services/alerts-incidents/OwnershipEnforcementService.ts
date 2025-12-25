/**
 * Ownership Enforcement Service for Alerts & Security Incidents Module
 * 
 * Provides comprehensive ownership and accountability enforcement with:
 * - Single ownership throughout alert and incident lifecycle
 * - Prevention of unauthorized ownership changes or reassignments
 * - Ownership history maintenance for audit purposes
 * - Role-based action restrictions
 * 
 * Requirements: 2.4, 2.5, 3.4, 7.2, 8.2, 8.4
 */

import { db } from '../../lib/database';
import { securityAlerts, securityIncidents } from '../../../database/schemas/alerts-incidents';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import {
    SecurityAlert,
    SecurityIncident,
    AlertStatus,
    IncidentStatus,
} from '../../types/alerts-incidents';
import { AuditService } from './AuditService';
import { AlertAuditState, IncidentAuditState, AuditContext } from '../../types/audit-logs';

/**
 * Ownership validation result
 */
export interface OwnershipValidationResult {
    isValid: boolean;
    reason?: string;
    currentOwner?: string;
    requiredRole?: string;
}

/**
 * Ownership transfer request
 */
export interface OwnershipTransferRequest {
    entityType: 'alert' | 'incident';
    entityId: string;
    tenantId: string;
    currentUserId: string;
    newOwnerId: string;
    reason: string;
    adminOverride?: boolean;
}

/**
 * Ownership history entry
 */
export interface OwnershipHistoryEntry {
    entityType: 'alert' | 'incident';
    entityId: string;
    previousOwner: string | null;
    newOwner: string;
    transferredBy: string;
    reason: string;
    timestamp: Date;
    adminOverride: boolean;
}

/**
 * Ownership Enforcement Service Class
 * 
 * Provides comprehensive ownership validation and enforcement
 * with audit trail maintenance and role-based restrictions.
 */
export class OwnershipEnforcementService {

    // ========================================================================
    // Alert Ownership Enforcement
    // ========================================================================

    /**
     * Validate alert ownership for operations
     * Requirements: 2.4, 2.5, 3.4
     */
    static async validateAlertOwnership(
        alertId: string,
        tenantId: string,
        userId: string,
        operation: 'assign' | 'investigate' | 'resolve' | 'escalate' | 'view'
    ): Promise<OwnershipValidationResult> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Fetch alert with ownership information
            const alert = await db.select().from(securityAlerts).where(
                and(
                    eq(securityAlerts.id, alertId),
                    eq(securityAlerts.tenantId, tenantId)
                )
            ).limit(1);

            if (alert.length === 0) {
                return {
                    isValid: false,
                    reason: 'Alert not found or access denied due to tenant isolation',
                };
            }

            const alertData = alert[0] as SecurityAlert;

            // Validate operation-specific ownership rules
            switch (operation) {
                case 'assign':
                    return this.validateAlertAssignment(alertData, userId);

                case 'investigate':
                case 'resolve':
                case 'escalate':
                    return this.validateAlertOwnershipAction(alertData, userId, operation);

                case 'view':
                    return this.validateAlertViewAccess(alertData, userId);

                default:
                    return {
                        isValid: false,
                        reason: `Unknown operation: ${operation}`,
                    };
            }
        } catch (error) {
            logger.error('Failed to validate alert ownership', error instanceof Error ? error : new Error(String(error)), {
                alertId,
                tenantId,
                userId,
                operation,
            });
            return {
                isValid: false,
                reason: 'Ownership validation failed due to system error',
            };
        }
    }

    /**
     * Validate alert assignment (only unassigned alerts can be assigned)
     * Requirements: 2.4, 2.5
     */
    private static validateAlertAssignment(
        alert: SecurityAlert,
        userId: string
    ): OwnershipValidationResult {
        // Only open (unassigned) alerts can be assigned
        if (alert.status !== 'open') {
            return {
                isValid: false,
                reason: `Alert cannot be assigned - current status: ${alert.status}`,
                currentOwner: alert.assignedTo || undefined,
            };
        }

        // Alert must not already be assigned
        if (alert.assignedTo !== null) {
            return {
                isValid: false,
                reason: 'Alert is already assigned to another analyst',
                currentOwner: alert.assignedTo,
            };
        }

        return { isValid: true };
    }

    /**
     * Validate alert ownership for actions (investigate, resolve, escalate)
     * Requirements: 2.4, 2.5, 3.4
     */
    private static validateAlertOwnershipAction(
        alert: SecurityAlert,
        userId: string,
        operation: string
    ): OwnershipValidationResult {
        // Alert must be assigned
        if (!alert.assignedTo) {
            return {
                isValid: false,
                reason: 'Alert must be assigned before performing this operation',
            };
        }

        // User must be the assigned owner
        if (alert.assignedTo !== userId) {
            return {
                isValid: false,
                reason: `Operation denied - alert is assigned to another analyst`,
                currentOwner: alert.assignedTo,
            };
        }

        // Validate status for operation
        const validStatuses = this.getValidAlertStatusesForOperation(operation);
        if (!validStatuses.includes(alert.status)) {
            return {
                isValid: false,
                reason: `Operation ${operation} not allowed for alert status: ${alert.status}`,
                currentOwner: alert.assignedTo,
            };
        }

        return { isValid: true };
    }

    /**
     * Validate alert view access (tenant-scoped)
     * Requirements: 3.4
     */
    private static validateAlertViewAccess(
        alert: SecurityAlert,
        userId: string
    ): OwnershipValidationResult {
        // All users in tenant can view alerts (tenant isolation enforced at query level)
        return { isValid: true };
    }

    /**
     * Get valid alert statuses for operation
     */
    private static getValidAlertStatusesForOperation(operation: string): AlertStatus[] {
        switch (operation) {
            case 'investigate':
                return ['assigned'];
            case 'resolve':
            case 'escalate':
                return ['assigned', 'investigating'];
            default:
                return [];
        }
    }

    // ========================================================================
    // Incident Ownership Enforcement
    // ========================================================================

    /**
     * Validate incident ownership for operations
     * Requirements: 7.2, 8.2, 8.4
     */
    static async validateIncidentOwnership(
        incidentId: string,
        tenantId: string,
        userId: string,
        operation: 'start_work' | 'resolve' | 'dismiss' | 'view_owned' | 'view_all'
    ): Promise<OwnershipValidationResult> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Fetch incident with ownership information
            const incident = await db.select().from(securityIncidents).where(
                and(
                    eq(securityIncidents.id, incidentId),
                    eq(securityIncidents.tenantId, tenantId)
                )
            ).limit(1);

            if (incident.length === 0) {
                return {
                    isValid: false,
                    reason: 'Incident not found or access denied due to tenant isolation',
                };
            }

            const incidentData = incident[0] as SecurityIncident;

            // Validate operation-specific ownership rules
            switch (operation) {
                case 'start_work':
                case 'resolve':
                case 'dismiss':
                    return this.validateIncidentOwnershipAction(incidentData, userId, operation);

                case 'view_owned':
                    return this.validateIncidentOwnedAccess(incidentData, userId);

                case 'view_all':
                    return this.validateIncidentGlobalAccess(incidentData, userId);

                default:
                    return {
                        isValid: false,
                        reason: `Unknown operation: ${operation}`,
                    };
            }
        } catch (error) {
            logger.error('Failed to validate incident ownership', error instanceof Error ? error : new Error(String(error)), {
                incidentId,
                tenantId,
                userId,
                operation,
            });
            return {
                isValid: false,
                reason: 'Ownership validation failed due to system error',
            };
        }
    }

    /**
     * Validate incident ownership for actions (start_work, resolve, dismiss)
     * Requirements: 7.2
     */
    private static validateIncidentOwnershipAction(
        incident: SecurityIncident,
        userId: string,
        operation: string
    ): OwnershipValidationResult {
        // User must be the incident owner
        if (incident.ownerId !== userId) {
            return {
                isValid: false,
                reason: `Operation denied - incident is owned by another analyst`,
                currentOwner: incident.ownerId,
            };
        }

        // Validate status for operation
        const validStatuses = this.getValidIncidentStatusesForOperation(operation);
        if (!validStatuses.includes(incident.status)) {
            return {
                isValid: false,
                reason: `Operation ${operation} not allowed for incident status: ${incident.status}`,
                currentOwner: incident.ownerId,
            };
        }

        return { isValid: true };
    }

    /**
     * Validate incident owned access (My Incidents tab)
     * Requirements: 7.2
     */
    private static validateIncidentOwnedAccess(
        incident: SecurityIncident,
        userId: string
    ): OwnershipValidationResult {
        // User can only view incidents they own
        if (incident.ownerId !== userId) {
            return {
                isValid: false,
                reason: 'Access denied - incident is owned by another analyst',
                currentOwner: incident.ownerId,
            };
        }

        return { isValid: true };
    }

    /**
     * Validate incident global access (All Incidents tab - read-only)
     * Requirements: 8.2, 8.4
     */
    private static validateIncidentGlobalAccess(
        incident: SecurityIncident,
        userId: string
    ): OwnershipValidationResult {
        // All users in tenant can view all incidents (read-only)
        // Tenant isolation enforced at query level
        return {
            isValid: true,
            reason: 'Read-only access granted for visibility and awareness',
        };
    }

    /**
     * Get valid incident statuses for operation
     */
    private static getValidIncidentStatusesForOperation(operation: string): IncidentStatus[] {
        switch (operation) {
            case 'start_work':
                return ['open', 'in_progress'];
            case 'resolve':
            case 'dismiss':
                return ['open', 'in_progress'];
            default:
                return [];
        }
    }

    // ========================================================================
    // Ownership Transfer Prevention
    // ========================================================================

    /**
     * Prevent unauthorized ownership transfers
     * Requirements: 2.4, 2.5, 7.2
     */
    static async preventOwnershipTransfer(
        request: OwnershipTransferRequest,
        context?: AuditContext
    ): Promise<{ allowed: boolean; reason: string }> {
        try {
            // Log the transfer attempt for audit purposes
            await this.logOwnershipTransferAttempt(request, context);

            // Ownership transfers are generally not allowed in this system
            // Alerts: Once assigned, ownership is locked until resolution/escalation
            // Incidents: Ownership is preserved from primary alert and cannot be transferred

            if (request.adminOverride) {
                // Admin override requires special handling (not implemented in MVP)
                logger.warn('Admin override attempted for ownership transfer', {
                    entityType: request.entityType,
                    entityId: request.entityId,
                    currentUserId: request.currentUserId,
                    newOwnerId: request.newOwnerId,
                    reason: request.reason,
                });

                return {
                    allowed: false,
                    reason: 'Admin override for ownership transfer not implemented in current version',
                };
            }

            return {
                allowed: false,
                reason: 'Ownership transfers are not permitted to maintain accountability and prevent duplicate work',
            };
        } catch (error) {
            logger.error('Failed to process ownership transfer request', error instanceof Error ? error : new Error(String(error)), {
                entityType: request.entityType,
                entityId: request.entityId,
                currentUserId: request.currentUserId,
                newOwnerId: request.newOwnerId,
            });

            return {
                allowed: false,
                reason: 'Ownership transfer validation failed due to system error',
            };
        }
    }

    /**
     * Log ownership transfer attempt for audit trail
     * Requirements: 3.4, 7.2
     */
    private static async logOwnershipTransferAttempt(
        request: OwnershipTransferRequest,
        context?: AuditContext
    ): Promise<void> {
        try {
            const action = `${request.entityType}_ownership_transfer_attempted`;
            const description = `Attempted ownership transfer from ${request.currentUserId} to ${request.newOwnerId}: ${request.reason}`;

            await AuditService.createAuditLog({
                tenantId: request.tenantId,
                userId: request.currentUserId,
                action: action as any, // Type assertion for custom action
                entityType: request.entityType === 'alert' ? 'security_alert' : 'security_incident',
                entityId: request.entityId,
                description,
                previousState: null,
                newState: {
                    transferAttempt: {
                        fromUserId: request.currentUserId,
                        toUserId: request.newOwnerId,
                        reason: request.reason,
                        adminOverride: request.adminOverride || false,
                        denied: true,
                    },
                },
                changeDetails: {
                    summary: 'Ownership transfer attempt denied',
                    affectedFields: ['ownership'],
                    transferRequest: request,
                },
                metadata: {
                    transferAttempt: true,
                    denied: true,
                    reason: request.reason,
                    adminOverride: request.adminOverride || false,
                },
            }, context);
        } catch (error) {
            logger.error('Failed to log ownership transfer attempt', error instanceof Error ? error : new Error(String(error)), {
                entityType: request.entityType,
                entityId: request.entityId,
            });
            // Non-critical error, continue
        }
    }

    // ========================================================================
    // Ownership History Tracking
    // ========================================================================

    /**
     * Track ownership changes for audit purposes
     * Requirements: 3.4, 7.2
     */
    static async trackOwnershipChange(
        entityType: 'alert' | 'incident',
        entityId: string,
        tenantId: string,
        previousOwner: string | null,
        newOwner: string,
        transferredBy: string,
        reason: string,
        context?: AuditContext
    ): Promise<void> {
        try {
            const historyEntry: OwnershipHistoryEntry = {
                entityType,
                entityId,
                previousOwner,
                newOwner,
                transferredBy,
                reason,
                timestamp: new Date(),
                adminOverride: false,
            };

            // Log ownership change in audit trail
            const action = `${entityType}_ownership_changed`;
            const description = previousOwner
                ? `Ownership transferred from ${previousOwner} to ${newOwner}: ${reason}`
                : `Ownership assigned to ${newOwner}: ${reason}`;

            await AuditService.createAuditLog({
                tenantId,
                userId: transferredBy,
                action: action as any, // Type assertion for custom action
                entityType: entityType === 'alert' ? 'security_alert' : 'security_incident',
                entityId,
                description,
                previousState: previousOwner ? { ownerId: previousOwner } : null,
                newState: { ownerId: newOwner },
                changeDetails: {
                    summary: 'Ownership change recorded',
                    affectedFields: ['ownership'],
                    ownershipChange: {
                        previousOwner,
                        newOwner,
                        transferredBy,
                        reason,
                    },
                },
                metadata: {
                    ownershipChange: true,
                    previousOwner,
                    newOwner,
                    transferredBy,
                    reason,
                },
            }, context);

            logger.info('Ownership change tracked', {
                entityType,
                entityId,
                previousOwner,
                newOwner,
                transferredBy,
                reason,
            });
        } catch (error) {
            logger.error('Failed to track ownership change', error instanceof Error ? error : new Error(String(error)), {
                entityType,
                entityId,
                previousOwner,
                newOwner,
                transferredBy,
            });
            // Non-critical error, continue
        }
    }

    // ========================================================================
    // Role-Based Action Restrictions
    // ========================================================================

    /**
     * Validate role-based action permissions
     * Requirements: 8.2, 8.4
     */
    static async validateRoleBasedAccess(
        userId: string,
        tenantId: string,
        action: 'view_all_incidents' | 'modify_incidents' | 'manage_playbooks' | 'admin_override',
        userRole?: string // Optional role information if available
    ): Promise<OwnershipValidationResult> {
        try {
            // Note: In the current implementation, role information is not stored in the database
            // This is a placeholder for future role-based access control implementation

            switch (action) {
                case 'view_all_incidents':
                    // All Security Analysts can view all incidents (read-only)
                    // Requirements: 8.2, 8.4
                    return {
                        isValid: true,
                        reason: 'All analysts have read-only access to all incidents for visibility',
                    };

                case 'modify_incidents':
                    // Only incident owners can modify incidents
                    // Requirements: 7.2
                    return {
                        isValid: false,
                        reason: 'Incident modifications restricted to incident owner only',
                        requiredRole: 'incident_owner',
                    };

                case 'manage_playbooks':
                    // Playbook management requires Super Admin role
                    // Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
                    return {
                        isValid: userRole === 'super_admin',
                        reason: userRole === 'super_admin'
                            ? 'Super Admin role verified for playbook management'
                            : 'Playbook management restricted to Super Admin role only',
                        requiredRole: 'super_admin',
                    };

                case 'admin_override':
                    // Admin overrides require Super Admin role
                    return {
                        isValid: userRole === 'super_admin',
                        reason: userRole === 'super_admin'
                            ? 'Super Admin role verified for admin override'
                            : 'Admin overrides restricted to Super Admin role only',
                        requiredRole: 'super_admin',
                    };

                default:
                    return {
                        isValid: false,
                        reason: `Unknown action: ${action}`,
                    };
            }
        } catch (error) {
            logger.error('Failed to validate role-based access', error instanceof Error ? error : new Error(String(error)), {
                userId,
                tenantId,
                action,
                userRole,
            });
            return {
                isValid: false,
                reason: 'Role validation failed due to system error',
            };
        }
    }

    // ========================================================================
    // Ownership Integrity Checks
    // ========================================================================

    /**
     * Perform ownership integrity checks
     * Requirements: 2.4, 2.5, 3.4, 7.2
     */
    static async performOwnershipIntegrityCheck(
        tenantId: string
    ): Promise<{
        alertsChecked: number;
        incidentsChecked: number;
        integrityIssues: Array<{
            entityType: 'alert' | 'incident';
            entityId: string;
            issue: string;
            severity: 'warning' | 'error';
        }>;
    }> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const integrityIssues: Array<{
                entityType: 'alert' | 'incident';
                entityId: string;
                issue: string;
                severity: 'warning' | 'error';
            }> = [];

            // Check alert ownership integrity
            const alerts = await db.select().from(securityAlerts).where(
                eq(securityAlerts.tenantId, tenantId)
            );

            for (const alert of alerts) {
                // Check assignment consistency
                if (alert.status === 'open' && (alert.assignedTo || alert.assignedAt)) {
                    integrityIssues.push({
                        entityType: 'alert',
                        entityId: alert.id,
                        issue: 'Open alert has assignment data - should be null',
                        severity: 'error',
                    });
                }

                if (['assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'].includes(alert.status) &&
                    (!alert.assignedTo || !alert.assignedAt)) {
                    integrityIssues.push({
                        entityType: 'alert',
                        entityId: alert.id,
                        issue: `Alert status ${alert.status} requires assignment data`,
                        severity: 'error',
                    });
                }
            }

            // Check incident ownership integrity
            const incidents = await db.select().from(securityIncidents).where(
                eq(securityIncidents.tenantId, tenantId)
            );

            for (const incident of incidents) {
                // Check resolution consistency
                if (incident.status === 'resolved' && !incident.resolutionSummary) {
                    integrityIssues.push({
                        entityType: 'incident',
                        entityId: incident.id,
                        issue: 'Resolved incident missing resolution summary',
                        severity: 'error',
                    });
                }

                if (incident.status === 'dismissed' && !incident.dismissalJustification) {
                    integrityIssues.push({
                        entityType: 'incident',
                        entityId: incident.id,
                        issue: 'Dismissed incident missing dismissal justification',
                        severity: 'error',
                    });
                }

                // Check SLA timestamp consistency
                if (incident.acknowledgedAt && incident.acknowledgedAt < incident.createdAt) {
                    integrityIssues.push({
                        entityType: 'incident',
                        entityId: incident.id,
                        issue: 'Acknowledged timestamp is before creation timestamp',
                        severity: 'error',
                    });
                }
            }

            logger.info('Ownership integrity check completed', {
                tenantId,
                alertsChecked: alerts.length,
                incidentsChecked: incidents.length,
                issuesFound: integrityIssues.length,
            });

            return {
                alertsChecked: alerts.length,
                incidentsChecked: incidents.length,
                integrityIssues,
            };
        } catch (error) {
            logger.error('Failed to perform ownership integrity check', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
            });
            throw error;
        }
    }
}