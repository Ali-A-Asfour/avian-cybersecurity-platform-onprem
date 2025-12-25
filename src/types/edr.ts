/**
 * TypeScript interfaces for Microsoft Defender and Intune API responses
 * and normalized AVIAN data models for EDR integration
 */

// ============================================================================
// Microsoft Defender API Response Types
// ============================================================================

export interface DefenderDevice {
    id: string;
    computerDnsName: string;
    osPlatform: string;
    osVersion: string;
    lastSeen: string;
    healthStatus: string;
    riskScore: number;
    exposureLevel: string;
    // Additional fields from Microsoft API
    firstSeen?: string;
    lastIpAddress?: string;
    lastExternalIpAddress?: string;
    agentVersion?: string;
    osBuild?: string;
    rbacGroupId?: number;
    rbacGroupName?: string;
    deviceValue?: string;
    ipAddresses?: Array<{
        ipAddress: string;
        macAddress: string;
        type: string;
    }>;
}

export interface DefenderAlert {
    id: string;
    severity: string;
    title: string;
    category: string;
    status: string;
    description: string;
    detectionSource: string;
    createdDateTime: string;
    devices?: Array<{ deviceId: string }>;
    // Additional fields
    classification?: string;
    determination?: string;
    investigationState?: string;
    assignedTo?: string;
    resolvedTime?: string;
    firstActivity?: string;
    lastActivity?: string;
    comments?: Array<{
        comment: string;
        createdBy: string;
        createdTime: string;
    }>;
}

export interface Vulnerability {
    id: string;
    cveId: string;
    severity: string;
    cvssScore: number;
    exploitability: string;
    description: string;
    affectedDevices?: string[];
    // Additional fields
    publishedOn?: string;
    updatedOn?: string;
    publicExploit?: boolean;
    exploitVerified?: boolean;
    exploitInKit?: boolean;
    exploitTypes?: string[];
    exploitUris?: string[];
}

// ============================================================================
// Microsoft Intune API Response Types
// ============================================================================

export interface IntuneDevice {
    id: string;
    deviceName: string;
    operatingSystem: string;
    osVersion: string;
    userPrincipalName: string;
    complianceState: string;
    enrollmentType: string;
    lastSyncDateTime: string;
    // Additional fields
    managedDeviceOwnerType?: string;
    deviceEnrollmentType?: string;
    managementAgent?: string;
    azureADDeviceId?: string;
    deviceRegistrationState?: string;
    emailAddress?: string;
    serialNumber?: string;
    manufacturer?: string;
    model?: string;
    imei?: string;
    phoneNumber?: string;
    totalStorageSpaceInBytes?: number;
    freeStorageSpaceInBytes?: number;
}

export interface ComplianceStatus {
    deviceId: string;
    complianceState: string;
    complianceGracePeriodExpirationDateTime?: string;
    deviceCompliancePolicyStates?: Array<{
        settingName: string;
        state: string;
        settingStates?: Array<{
            setting: string;
            state: string;
            errorCode?: string;
            errorDescription?: string;
        }>;
    }>;
}

// ============================================================================
// Normalized AVIAN Data Models
// ============================================================================

export interface NormalizedDevice {
    id: string;
    tenantId: string;
    microsoftDeviceId: string;
    deviceName: string;
    operatingSystem: string;
    osVersion: string;
    primaryUser: string;
    defenderHealthStatus: string;
    riskScore: number;
    exposureLevel: string;
    intuneComplianceState: string;
    intuneEnrollmentStatus: string;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface NormalizedAlert {
    id: string;
    tenantId: string;
    deviceId: string;
    microsoftAlertId: string;
    severity: string;
    threatType: string;
    threatName: string;
    status: string;
    description: string;
    detectedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface NormalizedVulnerability {
    id: string;
    tenantId: string;
    cveId: string;
    severity: string;
    cvssScore: number;
    exploitability: string;
    description: string;
    affectedDeviceCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface NormalizedCompliance {
    id: string;
    tenantId: string;
    deviceId: string;
    complianceState: string;
    failedRules: Array<{ ruleName: string; state: string }>;
    securityBaselineStatus: string;
    requiredAppsStatus: Array<{ appName: string; installed: boolean }>;
    checkedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================================
// Remote Action Types
// ============================================================================

export interface ActionResult {
    id: string;
    status: string;
    message: string;
}

export interface RemoteAction {
    id: string;
    tenantId: string;
    deviceId: string;
    userId: string;
    actionType: 'isolate' | 'unisolate' | 'scan' | 'resolve_alert';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    resultMessage: string;
    initiatedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
}

// ============================================================================
// Posture Score Types
// ============================================================================

export interface PostureScore {
    id: string;
    tenantId: string;
    score: number;
    deviceCount: number;
    highRiskDeviceCount: number;
    activeAlertCount: number;
    criticalVulnerabilityCount: number;
    nonCompliantDeviceCount: number;
    calculatedAt: Date;
    createdAt: Date;
}

export interface PostureFactors {
    deviceRiskAverage: number;
    alertSeverityDistribution: { low: number; medium: number; high: number };
    vulnerabilityExposure: number;
    compliancePercentage: number;
}

// ============================================================================
// Microsoft Graph API Client Types
// ============================================================================

export interface MicrosoftGraphCredentials {
    clientId: string;
    clientSecret: string;
    tenantId: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    ext_expires_in?: number;
    refresh_token?: string;
}

export interface GraphAPIError {
    error: {
        code: string;
        message: string;
        innerError?: {
            code: string;
            message: string;
            date: string;
            'request-id': string;
        };
    };
}

export interface RateLimitInfo {
    retryAfter: number;
    endpoint: string;
    timestamp: Date;
}
