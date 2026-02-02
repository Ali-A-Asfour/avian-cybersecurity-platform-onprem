/**
 * EDR Data Normalization Layer
 * 
 * Transforms Microsoft Defender and Intune API responses into AVIAN's normalized data models.
 * Handles device merging, risk/severity mapping, and null field handling.
 * 
 * Requirements: 1.2, 1.3, 2.2, 3.2, 4.2
 */

import {
    DefenderDevice,
    IntuneDevice,
    DefenderAlert,
    Vulnerability,
    ComplianceStatus,
    NormalizedDevice,
    NormalizedAlert,
    NormalizedVulnerability,
    NormalizedCompliance,
    PostureScore,
    PostureFactors,
} from '@/types/edr';

// ============================================================================
// Risk and Severity Mapping Constants
// ============================================================================

/**
 * Maps Microsoft risk levels to AVIAN's 0-100 scale
 */
const RISK_LEVEL_MAP: Record<string, number> = {
    'None': 0,
    'Informational': 10,
    'Low': 30,
    'Medium': 60,
    'High': 90,
    'Critical': 100,
};

/**
 * Maps Microsoft severity levels to AVIAN severity levels
 */
const SEVERITY_MAP: Record<string, string> = {
    'Informational': 'low',
    'Low': 'low',
    'Medium': 'medium',
    'High': 'high',
    'Critical': 'critical',
};

/**
 * Maps Microsoft exposure levels to risk scores
 */
const EXPOSURE_LEVEL_MAP: Record<string, number> = {
    'None': 0,
    'Low': 25,
    'Medium': 50,
    'High': 75,
    'Critical': 100,
};

// ============================================================================
// Device Normalization
// ============================================================================

export interface EDRNormalizer {
    normalizeDevice(
        defenderDevice: DefenderDevice,
        intuneDevice?: IntuneDevice
    ): Omit<NormalizedDevice, 'id' | 'createdAt' | 'updatedAt'>;

    mergeDevices(
        defenderDevices: DefenderDevice[],
        intuneDevices: IntuneDevice[]
    ): Array<Omit<NormalizedDevice, 'id' | 'createdAt' | 'updatedAt'>>;

    normalizeAlert(defenderAlert: DefenderAlert): Omit<NormalizedAlert, 'id' | 'createdAt' | 'updatedAt'>;

    normalizeVulnerability(vuln: Vulnerability): Omit<NormalizedVulnerability, 'id' | 'createdAt' | 'updatedAt'>;

    normalizeCompliance(compliance: ComplianceStatus): Omit<NormalizedCompliance, 'id' | 'createdAt' | 'updatedAt'>;

    calculatePostureScore(
        devices: NormalizedDevice[],
        alerts: NormalizedAlert[],
        vulnerabilities: NormalizedVulnerability[],
        compliance: NormalizedCompliance[]
    ): Omit<PostureScore, 'id' | 'createdAt'>;
}

/**
 * Normalizes a Defender device, optionally merging with Intune device data
 * 
 * @param defenderDevice - Device data from Microsoft Defender
 * @param intuneDevice - Optional device data from Microsoft Intune
 * @param tenantId - AVIAN tenant ID
 * @returns Normalized device object ready for database storage
 */
export function normalizeDevice(
    defenderDevice: DefenderDevice,
    tenantId: string,
    intuneDevice?: IntuneDevice
): Omit<NormalizedDevice, 'id' | 'createdAt' | 'updatedAt'> {
    // Map risk score from exposure level if not directly available
    // Use exposure level mapping only if riskScore is undefined/null, not if it's 0
    const riskScore = defenderDevice.riskScore !== undefined && defenderDevice.riskScore !== null
        ? defenderDevice.riskScore
        : EXPOSURE_LEVEL_MAP[defenderDevice.exposureLevel] ?? 0;

    return {
        tenantId,
        microsoftDeviceId: defenderDevice.id,
        deviceName: defenderDevice.computerDnsName || intuneDevice?.deviceName || 'Unknown Device',
        operatingSystem: defenderDevice.osPlatform || intuneDevice?.operatingSystem || 'Unknown',
        osVersion: defenderDevice.osVersion || intuneDevice?.osVersion || 'Unknown',
        primaryUser: intuneDevice?.userPrincipalName || intuneDevice?.emailAddress || 'Unknown',
        defenderHealthStatus: defenderDevice.healthStatus || 'Unknown',
        riskScore,
        exposureLevel: defenderDevice.exposureLevel || 'None',
        intuneComplianceState: intuneDevice?.complianceState || 'Unknown',
        intuneEnrollmentStatus: intuneDevice?.enrollmentType || 'Unknown',
        lastSeenAt: new Date(defenderDevice.lastSeen || intuneDevice?.lastSyncDateTime || new Date()),
    };
}

/**
 * Merges Defender and Intune device lists into normalized devices
 * Matches devices by ID, hostname, or serial number
 * 
 * @param defenderDevices - Array of Defender devices
 * @param intuneDevices - Array of Intune devices
 * @param tenantId - AVIAN tenant ID
 * @returns Array of normalized devices with merged data
 */
export function mergeDevices(
    defenderDevices: DefenderDevice[],
    intuneDevices: IntuneDevice[],
    tenantId: string
): Array<Omit<NormalizedDevice, 'id' | 'createdAt' | 'updatedAt'>> {
    const normalizedDevices: Array<Omit<NormalizedDevice, 'id' | 'createdAt' | 'updatedAt'>> = [];
    const matchedIntuneIds = new Set<string>();

    // Create lookup maps for Intune devices
    const intuneByAzureId = new Map<string, IntuneDevice>();
    const intuneByHostname = new Map<string, IntuneDevice>();
    const intuneBySerial = new Map<string, IntuneDevice>();

    intuneDevices.forEach(device => {
        if (device.azureADDeviceId) {
            intuneByAzureId.set(device.azureADDeviceId.toLowerCase(), device);
        }
        if (device.deviceName) {
            intuneByHostname.set(device.deviceName.toLowerCase(), device);
        }
        if (device.serialNumber) {
            intuneBySerial.set(device.serialNumber.toLowerCase(), device);
        }
    });

    // Process Defender devices and try to match with Intune
    for (const defenderDevice of defenderDevices) {
        let matchedIntuneDevice: IntuneDevice | undefined;

        // Try matching by Azure AD Device ID (most reliable)
        if (defenderDevice.id) {
            matchedIntuneDevice = intuneByAzureId.get(defenderDevice.id.toLowerCase());
        }

        // Try matching by hostname
        if (!matchedIntuneDevice && defenderDevice.computerDnsName) {
            matchedIntuneDevice = intuneByHostname.get(defenderDevice.computerDnsName.toLowerCase());
        }

        // If matched, mark the Intune device as processed
        if (matchedIntuneDevice) {
            matchedIntuneIds.add(matchedIntuneDevice.id);
        }

        // Normalize with or without Intune data
        normalizedDevices.push(normalizeDevice(defenderDevice, tenantId, matchedIntuneDevice));
    }

    // Add any Intune devices that weren't matched with Defender
    for (const intuneDevice of intuneDevices) {
        if (!matchedIntuneIds.has(intuneDevice.id)) {
            // Create a minimal Defender device object for normalization
            const syntheticDefenderDevice: DefenderDevice = {
                id: intuneDevice.azureADDeviceId || intuneDevice.id,
                computerDnsName: intuneDevice.deviceName,
                osPlatform: intuneDevice.operatingSystem,
                osVersion: intuneDevice.osVersion,
                lastSeen: intuneDevice.lastSyncDateTime,
                healthStatus: 'Unknown',
                riskScore: 0,
                exposureLevel: 'None',
            };

            normalizedDevices.push(normalizeDevice(syntheticDefenderDevice, tenantId, intuneDevice));
        }
    }

    return normalizedDevices;
}

// ============================================================================
// Alert Normalization
// ============================================================================

/**
 * Normalizes a Defender alert into AVIAN's alert model
 * 
 * @param defenderAlert - Alert data from Microsoft Defender
 * @param tenantId - AVIAN tenant ID
 * @param deviceId - AVIAN device ID (from normalized device)
 * @returns Normalized alert object ready for database storage
 */
export function normalizeAlert(
    defenderAlert: DefenderAlert,
    tenantId: string,
    deviceId: string
): Omit<NormalizedAlert, 'id' | 'createdAt' | 'updatedAt'> {
    // Map severity to AVIAN format
    const severity = SEVERITY_MAP[defenderAlert.severity] || 'medium';

    return {
        tenantId,
        deviceId,
        microsoftAlertId: defenderAlert.id,
        severity,
        threatType: defenderAlert.category || 'Unknown',
        threatName: defenderAlert.title || 'Unknown Threat',
        status: defenderAlert.status || 'New',
        description: defenderAlert.description || '',
        detectedAt: new Date(defenderAlert.createdDateTime || new Date()),
    };
}

// ============================================================================
// Vulnerability Normalization
// ============================================================================

/**
 * Normalizes a vulnerability into AVIAN's vulnerability model
 * 
 * @param vuln - Vulnerability data from Microsoft Defender
 * @param tenantId - AVIAN tenant ID
 * @returns Normalized vulnerability object ready for database storage
 */
export function normalizeVulnerability(
    vuln: Vulnerability,
    tenantId: string
): Omit<NormalizedVulnerability, 'id' | 'createdAt' | 'updatedAt'> {
    // Map severity to AVIAN format
    const severity = SEVERITY_MAP[vuln.severity] || 'medium';

    return {
        tenantId,
        cveId: vuln.cveId,
        severity,
        cvssScore: vuln.cvssScore || 0,
        exploitability: vuln.exploitability || 'Unknown',
        description: vuln.description || '',
        affectedDeviceCount: vuln.affectedDevices?.length || 0,
    };
}

// ============================================================================
// Compliance Normalization
// ============================================================================

/**
 * Normalizes compliance status into AVIAN's compliance model
 * 
 * @param compliance - Compliance data from Microsoft Intune
 * @param tenantId - AVIAN tenant ID
 * @param deviceId - AVIAN device ID (from normalized device)
 * @returns Normalized compliance object ready for database storage
 */
export function normalizeCompliance(
    compliance: ComplianceStatus,
    tenantId: string,
    deviceId: string
): Omit<NormalizedCompliance, 'id' | 'createdAt' | 'updatedAt'> {
    // Extract failed rules from compliance policy states
    const failedRules: Array<{ ruleName: string; state: string }> = [];

    if (compliance.deviceCompliancePolicyStates) {
        for (const policyState of compliance.deviceCompliancePolicyStates) {
            if (policyState.state !== 'compliant' && policyState.state !== 'notApplicable') {
                failedRules.push({
                    ruleName: policyState.settingName,
                    state: policyState.state,
                });
            }
        }
    }

    // Determine security baseline status
    const securityBaselineStatus = compliance.complianceState === 'compliant'
        ? 'Compliant'
        : 'Non-Compliant';

    // Extract required apps status (placeholder - would need additional API call)
    const requiredAppsStatus: Array<{ appName: string; installed: boolean }> = [];

    return {
        tenantId,
        deviceId,
        complianceState: compliance.complianceState || 'Unknown',
        failedRules,
        securityBaselineStatus,
        requiredAppsStatus,
        checkedAt: new Date(compliance.complianceGracePeriodExpirationDateTime || new Date()),
    };
}

// ============================================================================
// Posture Score Calculation
// ============================================================================

/**
 * Calculates AVIAN posture score based on device risk, alerts, vulnerabilities, and compliance
 * 
 * Weighting:
 * - Device risk scores: 30%
 * - Active alerts: 25%
 * - Vulnerabilities: 25%
 * - Compliance: 20%
 * 
 * @param devices - Array of normalized devices
 * @param alerts - Array of normalized alerts
 * @param vulnerabilities - Array of normalized vulnerabilities
 * @param compliance - Array of normalized compliance records
 * @param tenantId - AVIAN tenant ID
 * @returns Posture score object ready for database storage
 */
export function calculatePostureScore(
    devices: NormalizedDevice[],
    alerts: NormalizedAlert[],
    vulnerabilities: NormalizedVulnerability[],
    compliance: NormalizedCompliance[],
    tenantId: string
): Omit<PostureScore, 'id' | 'createdAt'> {
    const deviceCount = devices.length;

    if (deviceCount === 0) {
        // No devices, return zero score
        return {
            tenantId,
            score: 0,
            deviceCount: 0,
            highRiskDeviceCount: 0,
            activeAlertCount: 0,
            criticalVulnerabilityCount: 0,
            nonCompliantDeviceCount: 0,
            calculatedAt: new Date(),
        };
    }

    // Calculate device risk average (30% weight)
    const totalRiskScore = devices.reduce((sum, device) => sum + device.riskScore, 0);
    const avgRiskScore = totalRiskScore / deviceCount;
    const deviceRiskFactor = (100 - avgRiskScore) / 100; // Invert: lower risk = higher score

    // Count high-risk devices (risk score >= 70)
    const highRiskDeviceCount = devices.filter(d => d.riskScore >= 70).length;

    // Calculate alert factor (25% weight)
    const activeAlerts = alerts.filter(a => a.status !== 'Resolved' && a.status !== 'Dismissed');
    const activeAlertCount = activeAlerts.length;
    const highSeverityAlerts = activeAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length;
    const alertImpact = (highSeverityAlerts * 10) + (activeAlertCount * 2);
    const alertFactor = Math.max(0, 100 - alertImpact) / 100;

    // Calculate vulnerability factor (25% weight)
    const criticalVulnerabilities = vulnerabilities.filter(v => v.cvssScore >= 7.0);
    const criticalVulnerabilityCount = criticalVulnerabilities.length;
    const totalVulnExposure = vulnerabilities.reduce((sum, v) => sum + (v.affectedDeviceCount * v.cvssScore), 0);
    const vulnImpact = Math.min(100, totalVulnExposure / deviceCount);
    const vulnFactor = (100 - vulnImpact) / 100;

    // Calculate compliance factor (20% weight)
    const nonCompliantDevices = compliance.filter(c => c.complianceState !== 'compliant');
    const nonCompliantDeviceCount = nonCompliantDevices.length;
    const compliancePercentage = deviceCount > 0
        ? ((deviceCount - nonCompliantDeviceCount) / deviceCount) * 100
        : 100;
    const complianceFactor = compliancePercentage / 100;

    // Calculate weighted score (0-100)
    const score = Math.round(
        (deviceRiskFactor * 30) +
        (alertFactor * 25) +
        (vulnFactor * 25) +
        (complianceFactor * 20)
    );

    return {
        tenantId,
        score: Math.max(0, Math.min(100, score)), // Clamp to 0-100
        deviceCount,
        highRiskDeviceCount,
        activeAlertCount,
        criticalVulnerabilityCount,
        nonCompliantDeviceCount,
        calculatedAt: new Date(),
    };
}

/**
 * Calculates detailed posture factors for display
 * 
 * @param devices - Array of normalized devices
 * @param alerts - Array of normalized alerts
 * @param vulnerabilities - Array of normalized vulnerabilities
 * @param compliance - Array of normalized compliance records
 * @returns Posture factors object with detailed breakdown
 */
export function calculatePostureFactors(
    devices: NormalizedDevice[],
    alerts: NormalizedAlert[],
    vulnerabilities: NormalizedVulnerability[],
    compliance: NormalizedCompliance[]
): PostureFactors {
    const deviceCount = devices.length;

    if (deviceCount === 0) {
        return {
            deviceRiskAverage: 0,
            alertSeverityDistribution: { low: 0, medium: 0, high: 0 },
            vulnerabilityExposure: 0,
            compliancePercentage: 100,
        };
    }

    // Device risk average
    const totalRiskScore = devices.reduce((sum, device) => sum + device.riskScore, 0);
    const deviceRiskAverage = Math.round(totalRiskScore / deviceCount);

    // Alert severity distribution
    const activeAlerts = alerts.filter(a => a.status !== 'Resolved' && a.status !== 'Dismissed');
    const alertSeverityDistribution = {
        low: activeAlerts.filter(a => a.severity === 'low').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length,
        high: activeAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length,
    };

    // Vulnerability exposure (average CVSS score weighted by affected devices)
    const totalVulnExposure = vulnerabilities.reduce(
        (sum, v) => sum + (v.affectedDeviceCount * v.cvssScore),
        0
    );
    const vulnerabilityExposure = deviceCount > 0
        ? Math.round((totalVulnExposure / deviceCount) * 10) / 10
        : 0;

    // Compliance percentage
    const nonCompliantDeviceCount = compliance.filter(c => c.complianceState !== 'compliant').length;
    const compliancePercentage = Math.round(((deviceCount - nonCompliantDeviceCount) / deviceCount) * 100);

    return {
        deviceRiskAverage,
        alertSeverityDistribution,
        vulnerabilityExposure,
        compliancePercentage,
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps a Microsoft risk level string to AVIAN's 0-100 scale
 */
export function mapRiskLevel(riskLevel: string): number {
    return RISK_LEVEL_MAP[riskLevel] ?? 50; // Default to medium if unknown
}

/**
 * Maps a Microsoft severity string to AVIAN's severity format
 */
export function mapSeverity(severity: string): string {
    return SEVERITY_MAP[severity] ?? 'medium'; // Default to medium if unknown
}

/**
 * Validates that a normalized device has all required fields
 */
export function validateNormalizedDevice(device: Partial<NormalizedDevice>): boolean {
    return !!(
        device.tenantId &&
        device.microsoftDeviceId &&
        device.deviceName &&
        device.operatingSystem &&
        device.lastSeenAt
    );
}

/**
 * Validates that a normalized alert has all required fields
 */
export function validateNormalizedAlert(alert: Partial<NormalizedAlert>): boolean {
    return !!(
        alert.tenantId &&
        alert.deviceId &&
        alert.microsoftAlertId &&
        alert.severity &&
        alert.threatName &&
        alert.detectedAt
    );
}

/**
 * Validates that a normalized vulnerability has all required fields
 */
export function validateNormalizedVulnerability(vuln: Partial<NormalizedVulnerability>): boolean {
    return !!(
        vuln.tenantId &&
        vuln.cveId &&
        vuln.severity
    );
}

/**
 * Validates that a normalized compliance record has all required fields
 */
export function validateNormalizedCompliance(compliance: Partial<NormalizedCompliance>): boolean {
    return !!(
        compliance.tenantId &&
        compliance.deviceId &&
        compliance.complianceState &&
        compliance.checkedAt
    );
}
