/**
 * EDR Security Posture Calculator
 * Calculates security posture scores based on device risk, alerts, vulnerabilities, and compliance
 */

import { db } from '@/lib/database';
import { 
  edrDevices, 
  edrAlerts, 
  edrVulnerabilities,
  edrCompliance,
  edrPostureScores 
} from '../../database/schemas/edr';
import { eq, and, gte, count } from 'drizzle-orm';

export interface PostureCalculation {
  score: number; // 0-100
  deviceCount: number;
  highRiskDeviceCount: number;
  activeAlertCount: number;
  criticalVulnerabilityCount: number;
  nonCompliantDeviceCount: number;
  factors: {
    deviceRiskFactor: number; // 0-100
    alertFactor: number; // 0-100
    vulnerabilityFactor: number; // 0-100
    complianceFactor: number; // 0-100
  };
}

/**
 * Calculate security posture score for a tenant
 */
export async function calculatePostureScore(tenantId: string): Promise<PostureCalculation> {
  try {
    // Get all devices for tenant
    const devices = await db
      .select()
      .from(edrDevices)
      .where(eq(edrDevices.tenantId, tenantId));

    if (devices.length === 0) {
      return {
        score: 100, // Perfect score if no devices
        deviceCount: 0,
        highRiskDeviceCount: 0,
        activeAlertCount: 0,
        criticalVulnerabilityCount: 0,
        nonCompliantDeviceCount: 0,
        factors: {
          deviceRiskFactor: 100,
          alertFactor: 100,
          vulnerabilityFactor: 100,
          complianceFactor: 100,
        },
      };
    }

    // Calculate device risk factor
    const deviceRiskFactor = await calculateDeviceRiskFactor(devices);
    const highRiskDeviceCount = devices.filter(device => device.riskScore >= 70).length;

    // Calculate alert factor
    const { alertFactor, activeAlertCount } = await calculateAlertFactor(tenantId);

    // Calculate vulnerability factor
    const { vulnerabilityFactor, criticalVulnerabilityCount } = await calculateVulnerabilityFactor(tenantId);

    // Calculate compliance factor
    const { complianceFactor, nonCompliantDeviceCount } = await calculateComplianceFactor(tenantId);

    // Calculate overall score (weighted average)
    const weights = {
      deviceRisk: 0.3,
      alerts: 0.25,
      vulnerabilities: 0.25,
      compliance: 0.2,
    };

    const score = Math.round(
      deviceRiskFactor * weights.deviceRisk +
      alertFactor * weights.alerts +
      vulnerabilityFactor * weights.vulnerabilities +
      complianceFactor * weights.compliance
    );

    return {
      score: Math.max(0, Math.min(100, score)), // Ensure 0-100 range
      deviceCount: devices.length,
      highRiskDeviceCount,
      activeAlertCount,
      criticalVulnerabilityCount,
      nonCompliantDeviceCount,
      factors: {
        deviceRiskFactor,
        alertFactor,
        vulnerabilityFactor,
        complianceFactor,
      },
    };
  } catch (error) {
    throw new Error(`Failed to calculate posture score: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate device risk factor based on individual device risk scores
 */
async function calculateDeviceRiskFactor(devices: any[]): Promise<number> {
  if (devices.length === 0) return 100;

  // Calculate average risk score
  const totalRiskScore = devices.reduce((sum, device) => sum + (device.riskScore || 0), 0);
  const averageRiskScore = totalRiskScore / devices.length;

  // Convert to posture factor (lower risk = higher posture score)
  // Risk score 0 = posture 100, Risk score 100 = posture 0
  return Math.max(0, 100 - averageRiskScore);
}

/**
 * Calculate alert factor based on active alerts
 */
async function calculateAlertFactor(tenantId: string): Promise<{ alertFactor: number; activeAlertCount: number }> {
  try {
    // Get active alerts from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeAlerts = await db
      .select()
      .from(edrAlerts)
      .where(and(
        eq(edrAlerts.tenantId, tenantId),
        eq(edrAlerts.status, 'active'),
        gte(edrAlerts.detectedAt, sevenDaysAgo)
      ));

    const activeAlertCount = activeAlerts.length;

    // Calculate factor based on alert count and severity
    let alertScore = 0;
    let totalWeight = 0;

    activeAlerts.forEach(alert => {
      let weight = 1;
      let severityScore = 50; // Default

      switch (alert.severity.toLowerCase()) {
        case 'critical':
          weight = 4;
          severityScore = 0; // Critical alerts heavily impact score
          break;
        case 'high':
          weight = 3;
          severityScore = 25;
          break;
        case 'medium':
          weight = 2;
          severityScore = 50;
          break;
        case 'low':
          weight = 1;
          severityScore = 75;
          break;
        case 'info':
          weight = 0.5;
          severityScore = 90;
          break;
      }

      alertScore += severityScore * weight;
      totalWeight += weight;
    });

    let alertFactor = 100; // Perfect score if no alerts
    if (totalWeight > 0) {
      alertFactor = Math.round(alertScore / totalWeight);
    }

    // Apply penalty for high alert volume
    if (activeAlertCount > 50) {
      alertFactor = Math.max(0, alertFactor - 20);
    } else if (activeAlertCount > 20) {
      alertFactor = Math.max(0, alertFactor - 10);
    } else if (activeAlertCount > 10) {
      alertFactor = Math.max(0, alertFactor - 5);
    }

    return { alertFactor, activeAlertCount };
  } catch (error) {
    console.error('Error calculating alert factor:', error);
    return { alertFactor: 50, activeAlertCount: 0 }; // Default neutral score
  }
}

/**
 * Calculate vulnerability factor based on CVE vulnerabilities
 */
async function calculateVulnerabilityFactor(tenantId: string): Promise<{ vulnerabilityFactor: number; criticalVulnerabilityCount: number }> {
  try {
    const vulnerabilities = await db
      .select()
      .from(edrVulnerabilities)
      .where(eq(edrVulnerabilities.tenantId, tenantId));

    const criticalVulnerabilities = vulnerabilities.filter(vuln => 
      vuln.severity.toLowerCase() === 'critical' || vuln.cvssScore >= 9.0
    );
    const criticalVulnerabilityCount = criticalVulnerabilities.length;

    if (vulnerabilities.length === 0) {
      return { vulnerabilityFactor: 100, criticalVulnerabilityCount: 0 };
    }

    // Calculate factor based on vulnerability severity distribution
    let vulnerabilityScore = 0;
    let totalWeight = 0;

    vulnerabilities.forEach(vuln => {
      let weight = 1;
      let severityScore = 50;

      if (vuln.cvssScore) {
        // Use CVSS score for more accurate assessment
        if (vuln.cvssScore >= 9.0) {
          weight = 4;
          severityScore = 0; // Critical
        } else if (vuln.cvssScore >= 7.0) {
          weight = 3;
          severityScore = 25; // High
        } else if (vuln.cvssScore >= 4.0) {
          weight = 2;
          severityScore = 50; // Medium
        } else {
          weight = 1;
          severityScore = 75; // Low
        }
      } else {
        // Fallback to severity string
        switch (vuln.severity.toLowerCase()) {
          case 'critical':
            weight = 4;
            severityScore = 0;
            break;
          case 'high':
            weight = 3;
            severityScore = 25;
            break;
          case 'medium':
            weight = 2;
            severityScore = 50;
            break;
          case 'low':
            weight = 1;
            severityScore = 75;
            break;
        }
      }

      // Apply exploitability penalty
      if (vuln.exploitability === 'high') {
        severityScore = Math.max(0, severityScore - 25);
      } else if (vuln.exploitability === 'medium') {
        severityScore = Math.max(0, severityScore - 10);
      }

      vulnerabilityScore += severityScore * weight;
      totalWeight += weight;
    });

    let vulnerabilityFactor = Math.round(vulnerabilityScore / totalWeight);

    // Apply penalty for high vulnerability count
    if (vulnerabilities.length > 100) {
      vulnerabilityFactor = Math.max(0, vulnerabilityFactor - 20);
    } else if (vulnerabilities.length > 50) {
      vulnerabilityFactor = Math.max(0, vulnerabilityFactor - 10);
    } else if (vulnerabilities.length > 20) {
      vulnerabilityFactor = Math.max(0, vulnerabilityFactor - 5);
    }

    return { vulnerabilityFactor, criticalVulnerabilityCount };
  } catch (error) {
    console.error('Error calculating vulnerability factor:', error);
    return { vulnerabilityFactor: 50, criticalVulnerabilityCount: 0 };
  }
}

/**
 * Calculate compliance factor based on device compliance status
 */
async function calculateComplianceFactor(tenantId: string): Promise<{ complianceFactor: number; nonCompliantDeviceCount: number }> {
  try {
    // Get all devices for tenant
    const devices = await db
      .select()
      .from(edrDevices)
      .where(eq(edrDevices.tenantId, tenantId));

    if (devices.length === 0) {
      return { complianceFactor: 100, nonCompliantDeviceCount: 0 };
    }

    // Count compliant vs non-compliant devices
    const compliantDevices = devices.filter(device => 
      device.intuneComplianceState === 'compliant'
    );
    const nonCompliantDevices = devices.filter(device => 
      device.intuneComplianceState === 'noncompliant'
    );
    const unknownComplianceDevices = devices.filter(device => 
      !device.intuneComplianceState || device.intuneComplianceState === 'unknown'
    );

    const nonCompliantDeviceCount = nonCompliantDevices.length;

    // Calculate compliance percentage
    const compliancePercentage = (compliantDevices.length / devices.length) * 100;

    // Apply penalty for unknown compliance status
    const unknownPenalty = (unknownComplianceDevices.length / devices.length) * 20;

    const complianceFactor = Math.max(0, Math.round(compliancePercentage - unknownPenalty));

    return { complianceFactor, nonCompliantDeviceCount };
  } catch (error) {
    console.error('Error calculating compliance factor:', error);
    return { complianceFactor: 50, nonCompliantDeviceCount: 0 };
  }
}

/**
 * Get posture score trend for a tenant
 */
export async function getPostureScoreTrend(tenantId: string, days: number = 30): Promise<Array<{ date: string; score: number }>> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const scores = await db
      .select({
        score: edrPostureScores.score,
        calculatedAt: edrPostureScores.calculatedAt,
      })
      .from(edrPostureScores)
      .where(and(
        eq(edrPostureScores.tenantId, tenantId),
        gte(edrPostureScores.calculatedAt, startDate)
      ))
      .orderBy(edrPostureScores.calculatedAt);

    return scores.map(score => ({
      date: score.calculatedAt.toISOString().split('T')[0],
      score: score.score,
    }));
  } catch (error) {
    console.error('Error getting posture score trend:', error);
    return [];
  }
}