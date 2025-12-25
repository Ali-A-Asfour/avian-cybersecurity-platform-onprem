/**
 * EDR Posture Score Calculator
 * 
 * Calculates an overall security posture score (0-100) for a tenant based on:
 * - Device risk scores (30% weight)
 * - Active alerts by severity (25% weight)
 * - Critical vulnerabilities (25% weight)
 * - Compliance status (20% weight)
 * 
 * The posture score provides a single metric to track security improvements over time.
 */

import { db } from './database';
import { edrDevices, edrAlerts, edrVulnerabilities, edrDeviceVulnerabilities, edrCompliance } from '../../database/schemas/edr';
import { eq, and, gte, sql } from 'drizzle-orm';
import { storePostureScore } from './edr-database-operations';
import type { PostureScore, PostureFactors } from '../types/edr';

/**
 * Weight factors for posture score calculation
 */
const WEIGHTS = {
    DEVICE_RISK: 0.30,      // 30%
    ACTIVE_ALERTS: 0.25,    // 25%
    VULNERABILITIES: 0.25,  // 25%
    COMPLIANCE: 0.20,       // 20%
};

/**
 * Risk score thresholds
 */
const RISK_THRESHOLDS = {
    HIGH_RISK: 70,          // Risk score >= 70 is considered high risk
};

/**
 * CVSS score thresholds
 */
const CVSS_THRESHOLDS = {
    CRITICAL: 7.0,          // CVSS >= 7.0 is considered critical
};

/**
 * Alert severity weights for scoring
 */
const ALERT_SEVERITY_WEIGHTS = {
    high: 1.0,
    medium: 0.5,
    low: 0.2,
};

/**
 * Ensure database connection is available
 */
function ensureDb() {
    if (!db) {
        throw new Error('Database connection not available');
    }
    return db;
}

/**
 * Calculate device risk component (30% of total score)
 * Returns a score from 0-100 where 100 is best (lowest risk)
 */
async function calculateDeviceRiskScore(tenantId: string): Promise<{
    score: number;
    deviceCount: number;
    highRiskDeviceCount: number;
    averageRiskScore: number;
}> {
    const devices = await ensureDb()
        .select({
            riskScore: edrDevices.riskScore,
        })
        .from(edrDevices)
        .where(eq(edrDevices.tenantId, tenantId));

    if (devices.length === 0) {
        return {
            score: 100, // No devices = perfect score
            deviceCount: 0,
            highRiskDeviceCount: 0,
            averageRiskScore: 0,
        };
    }

    // Calculate average risk score
    const totalRisk = devices.reduce((sum, device) => sum + (device.riskScore || 0), 0);
    const averageRiskScore = totalRisk / devices.length;

    // Count high-risk devices
    const highRiskDeviceCount = devices.filter(
        (device) => (device.riskScore || 0) >= RISK_THRESHOLDS.HIGH_RISK
    ).length;

    // Convert average risk (0-100, higher is worse) to score (0-100, higher is better)
    // Invert the risk score: 100 - averageRisk
    const score = Math.max(0, Math.min(100, 100 - averageRiskScore));

    return {
        score,
        deviceCount: devices.length,
        highRiskDeviceCount,
        averageRiskScore,
    };
}

/**
 * Calculate active alerts component (25% of total score)
 * Returns a score from 0-100 where 100 is best (no alerts)
 */
async function calculateActiveAlertsScore(tenantId: string): Promise<{
    score: number;
    activeAlertCount: number;
    severityDistribution: { low: number; medium: number; high: number };
}> {
    const alerts = await ensureDb()
        .select({
            severity: edrAlerts.severity,
        })
        .from(edrAlerts)
        .where(
            and(
                eq(edrAlerts.tenantId, tenantId),
                eq(edrAlerts.status, 'active')
            )
        );

    const severityDistribution = {
        low: 0,
        medium: 0,
        high: 0,
    };

    // Count alerts by severity
    alerts.forEach((alert) => {
        const severity = alert.severity?.toLowerCase();
        if (severity === 'high') {
            severityDistribution.high++;
        } else if (severity === 'medium') {
            severityDistribution.medium++;
        } else if (severity === 'low') {
            severityDistribution.low++;
        }
    });

    const activeAlertCount = alerts.length;

    if (activeAlertCount === 0) {
        return {
            score: 100, // No active alerts = perfect score
            activeAlertCount: 0,
            severityDistribution,
        };
    }

    // Calculate weighted alert impact
    // Each severity has a different weight
    const weightedAlertCount =
        severityDistribution.high * ALERT_SEVERITY_WEIGHTS.high +
        severityDistribution.medium * ALERT_SEVERITY_WEIGHTS.medium +
        severityDistribution.low * ALERT_SEVERITY_WEIGHTS.low;

    // Normalize to 0-100 scale
    // Assume 10 weighted alerts = 0 score, 0 weighted alerts = 100 score
    // Use exponential decay to penalize more alerts
    const maxWeightedAlerts = 10;
    const score = Math.max(0, Math.min(100, 100 * Math.exp(-weightedAlertCount / maxWeightedAlerts)));

    return {
        score,
        activeAlertCount,
        severityDistribution,
    };
}

/**
 * Calculate vulnerabilities component (25% of total score)
 * Returns a score from 0-100 where 100 is best (no critical vulnerabilities)
 */
async function calculateVulnerabilitiesScore(tenantId: string): Promise<{
    score: number;
    criticalVulnerabilityCount: number;
    totalVulnerabilityCount: number;
}> {
    const vulnerabilities = await ensureDb()
        .select({
            cvssScore: edrVulnerabilities.cvssScore,
        })
        .from(edrVulnerabilities)
        .where(eq(edrVulnerabilities.tenantId, tenantId));

    const totalVulnerabilityCount = vulnerabilities.length;

    if (totalVulnerabilityCount === 0) {
        return {
            score: 100, // No vulnerabilities = perfect score
            criticalVulnerabilityCount: 0,
            totalVulnerabilityCount: 0,
        };
    }

    // Count critical vulnerabilities (CVSS >= 7.0)
    const criticalVulnerabilityCount = vulnerabilities.filter((vuln) => {
        const cvssScore = parseFloat(vuln.cvssScore || '0');
        return cvssScore >= CVSS_THRESHOLDS.CRITICAL;
    }).length;

    // Calculate score based on critical vulnerabilities
    // Assume 20 critical vulnerabilities = 0 score, 0 critical vulnerabilities = 100 score
    // Use exponential decay
    const maxCriticalVulns = 20;
    const score = Math.max(
        0,
        Math.min(100, 100 * Math.exp(-criticalVulnerabilityCount / maxCriticalVulns))
    );

    return {
        score,
        criticalVulnerabilityCount,
        totalVulnerabilityCount,
    };
}

/**
 * Calculate compliance component (20% of total score)
 * Returns a score from 0-100 where 100 is best (all devices compliant)
 */
async function calculateComplianceScore(tenantId: string): Promise<{
    score: number;
    nonCompliantDeviceCount: number;
    totalDeviceCount: number;
    compliancePercentage: number;
}> {
    const complianceRecords = await ensureDb()
        .select({
            complianceState: edrCompliance.complianceState,
        })
        .from(edrCompliance)
        .where(eq(edrCompliance.tenantId, tenantId));

    const totalDeviceCount = complianceRecords.length;

    if (totalDeviceCount === 0) {
        return {
            score: 100, // No devices = perfect score
            nonCompliantDeviceCount: 0,
            totalDeviceCount: 0,
            compliancePercentage: 100,
        };
    }

    // Count compliant devices
    const compliantDeviceCount = complianceRecords.filter(
        (record) => record.complianceState?.toLowerCase() === 'compliant'
    ).length;

    const nonCompliantDeviceCount = totalDeviceCount - compliantDeviceCount;

    // Calculate compliance percentage
    const compliancePercentage = (compliantDeviceCount / totalDeviceCount) * 100;

    // Score is directly the compliance percentage
    const score = compliancePercentage;

    return {
        score,
        nonCompliantDeviceCount,
        totalDeviceCount,
        compliancePercentage,
    };
}

/**
 * Calculate overall posture score for a tenant
 * Combines all components with their respective weights
 */
export async function calculatePostureScore(tenantId: string): Promise<{
    score: number;
    factors: PostureFactors;
    deviceCount: number;
    highRiskDeviceCount: number;
    activeAlertCount: number;
    criticalVulnerabilityCount: number;
    nonCompliantDeviceCount: number;
}> {
    // Calculate each component
    const deviceRisk = await calculateDeviceRiskScore(tenantId);
    const activeAlerts = await calculateActiveAlertsScore(tenantId);
    const vulnerabilities = await calculateVulnerabilitiesScore(tenantId);
    const compliance = await calculateComplianceScore(tenantId);

    // Calculate weighted total score
    const totalScore =
        deviceRisk.score * WEIGHTS.DEVICE_RISK +
        activeAlerts.score * WEIGHTS.ACTIVE_ALERTS +
        vulnerabilities.score * WEIGHTS.VULNERABILITIES +
        compliance.score * WEIGHTS.COMPLIANCE;

    // Round to nearest integer
    const finalScore = Math.round(totalScore);

    // Build factors object
    const factors: PostureFactors = {
        deviceRiskAverage: deviceRisk.averageRiskScore,
        alertSeverityDistribution: activeAlerts.severityDistribution,
        vulnerabilityExposure: vulnerabilities.criticalVulnerabilityCount,
        compliancePercentage: compliance.compliancePercentage,
    };

    return {
        score: finalScore,
        factors,
        deviceCount: deviceRisk.deviceCount,
        highRiskDeviceCount: deviceRisk.highRiskDeviceCount,
        activeAlertCount: activeAlerts.activeAlertCount,
        criticalVulnerabilityCount: vulnerabilities.criticalVulnerabilityCount,
        nonCompliantDeviceCount: compliance.nonCompliantDeviceCount,
    };
}

/**
 * Calculate and store posture score for a tenant
 * This is the main entry point for posture score calculation
 */
export async function calculateAndStorePostureScore(
    tenantId: string
): Promise<PostureScore> {
    // Calculate the score
    const calculation = await calculatePostureScore(tenantId);

    // Store in database
    const result = await storePostureScore({
        tenantId,
        score: calculation.score,
        deviceCount: calculation.deviceCount,
        highRiskDeviceCount: calculation.highRiskDeviceCount,
        activeAlertCount: calculation.activeAlertCount,
        criticalVulnerabilityCount: calculation.criticalVulnerabilityCount,
        nonCompliantDeviceCount: calculation.nonCompliantDeviceCount,
        calculatedAt: new Date(),
    });

    // Return the full posture score object
    return {
        id: result.id,
        tenantId,
        score: calculation.score,
        deviceCount: calculation.deviceCount,
        highRiskDeviceCount: calculation.highRiskDeviceCount,
        activeAlertCount: calculation.activeAlertCount,
        criticalVulnerabilityCount: calculation.criticalVulnerabilityCount,
        nonCompliantDeviceCount: calculation.nonCompliantDeviceCount,
        calculatedAt: new Date(),
        createdAt: new Date(),
    };
}
