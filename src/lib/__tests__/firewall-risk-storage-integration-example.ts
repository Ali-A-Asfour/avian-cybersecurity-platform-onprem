/**
 * Integration Example: Firewall Config Upload and Risk Storage
 * 
 * This file demonstrates how to use the risk storage service
 * in conjunction with the config parser and risk engine.
 * 
 * This is NOT a test file - it's a reference implementation example.
 */

import { ConfigParser, RiskEngine } from '../firewall-config-parser';
import {
    storeConfigRisks,
    replaceDeviceRisks,
    getRisksByDevice,
    getRisksByDeviceAndSeverity,
    countRisksBySeverity,
} from '../firewall-risk-storage';

/**
 * Example 1: Upload and analyze a firewall configuration
 */
export async function uploadFirewallConfig(
    deviceId: string,
    configFileContent: string
): Promise<{
    snapshotId: string;
    riskScore: number;
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
}> {
    // Step 1: Parse the configuration file
    const parser = new ConfigParser();
    const config = parser.parseConfig(configFileContent);

    // Step 2: Analyze configuration for risks
    const riskEngine = new RiskEngine();
    const risks = riskEngine.analyzeConfig(config);

    // Step 3: Calculate risk score (0-100)
    const riskScore = riskEngine.calculateRiskScore(risks);

    // Step 4: Generate a snapshot ID for this config upload
    const snapshotId = crypto.randomUUID();

    // Step 5: Replace old risks with new ones
    // This deletes all existing risks for the device and stores the new ones
    const result = await replaceDeviceRisks(deviceId, risks, snapshotId);

    console.log(`Deleted ${result.deletedCount} old risks`);
    console.log(`Created ${result.createdRisks.length} new risks`);
    console.log(`Risk score: ${riskScore}/100`);

    // Step 6: Count risks by severity
    const counts = await countRisksBySeverity(deviceId);

    return {
        snapshotId,
        riskScore,
        totalRisks: counts.total,
        criticalRisks: counts.critical,
        highRisks: counts.high,
        mediumRisks: counts.medium,
        lowRisks: counts.low,
    };
}

/**
 * Example 2: Get all risks for a device
 */
export async function getDeviceRisks(deviceId: string) {
    const risks = await getRisksByDevice(deviceId);

    console.log(`Found ${risks.length} risks for device ${deviceId}`);

    // Group risks by severity
    const risksBySeverity = {
        critical: risks.filter((r) => r.severity === 'critical'),
        high: risks.filter((r) => r.severity === 'high'),
        medium: risks.filter((r) => r.severity === 'medium'),
        low: risks.filter((r) => r.severity === 'low'),
    };

    return risksBySeverity;
}

/**
 * Example 3: Get only critical risks for a device
 */
export async function getCriticalRisks(deviceId: string) {
    const criticalRisks = await getRisksByDeviceAndSeverity(deviceId, 'critical');

    console.log(`Found ${criticalRisks.length} critical risks`);

    // Log each critical risk
    for (const risk of criticalRisks) {
        console.log(`- ${risk.riskType}: ${risk.description}`);
        console.log(`  Remediation: ${risk.remediation}`);
    }

    return criticalRisks;
}

/**
 * Example 4: Store risks without replacing old ones
 * (Useful for initial config upload or when you want to keep historical risks)
 */
export async function storeRisksWithoutReplacing(
    deviceId: string,
    configFileContent: string
): Promise<string> {
    // Parse and analyze config
    const parser = new ConfigParser();
    const riskEngine = new RiskEngine();
    const config = parser.parseConfig(configFileContent);
    const risks = riskEngine.analyzeConfig(config);

    // Generate snapshot ID
    const snapshotId = crypto.randomUUID();

    // Store risks WITHOUT deleting old ones
    const storedRisks = await storeConfigRisks(deviceId, risks, snapshotId);

    console.log(`Stored ${storedRisks.length} new risks (kept old risks)`);

    return snapshotId;
}

/**
 * Example 5: Complete API endpoint implementation
 */
export async function handleConfigUploadAPI(
    deviceId: string,
    configFile: string,
    tenantId: string
) {
    try {
        // Validate device belongs to tenant (pseudo-code)
        // const device = await validateDeviceOwnership(deviceId, tenantId);

        // Parse and analyze config
        const parser = new ConfigParser();
        const riskEngine = new RiskEngine();
        const config = parser.parseConfig(configFile);
        const risks = riskEngine.analyzeConfig(config);
        const riskScore = riskEngine.calculateRiskScore(risks);

        // Store risks with snapshot
        const snapshotId = crypto.randomUUID();
        const result = await replaceDeviceRisks(deviceId, risks, snapshotId);

        // Get risk counts
        const counts = await countRisksBySeverity(deviceId);

        // Return API response
        return {
            success: true,
            snapshotId,
            riskScore,
            riskSummary: {
                totalRisks: counts.total,
                criticalRisks: counts.critical,
                highRisks: counts.high,
                mediumRisks: counts.medium,
                lowRisks: counts.low,
            },
            risks: result.createdRisks.map((risk) => ({
                id: risk.id,
                riskType: risk.riskType,
                severity: risk.severity,
                description: risk.description,
                remediation: risk.remediation,
                category: risk.riskCategory,
                detectedAt: risk.detectedAt,
            })),
        };
    } catch (error) {
        console.error('Error uploading config:', error);
        return {
            success: false,
            error: 'Failed to upload and analyze configuration',
        };
    }
}

/**
 * Example 6: Get risk summary for dashboard
 */
export async function getRiskSummaryForDashboard(deviceId: string) {
    const counts = await countRisksBySeverity(deviceId);
    const allRisks = await getRisksByDevice(deviceId);

    // Get most recent risks (top 5)
    const recentRisks = allRisks.slice(0, 5);

    // Get critical risks that need immediate attention
    const criticalRisks = await getRisksByDeviceAndSeverity(deviceId, 'critical');

    return {
        summary: {
            total: counts.total,
            critical: counts.critical,
            high: counts.high,
            medium: counts.medium,
            low: counts.low,
        },
        recentRisks: recentRisks.map((r) => ({
            type: r.riskType,
            severity: r.severity,
            description: r.description,
            detectedAt: r.detectedAt,
        })),
        criticalRisks: criticalRisks.map((r) => ({
            type: r.riskType,
            description: r.description,
            remediation: r.remediation,
        })),
    };
}

/**
 * Example 7: Sample configuration file content for testing
 */
export const SAMPLE_CONFIG_WITH_RISKS = `
# SonicWall Configuration Export
# Device: TZ400
# Firmware: 7.0.1-5050

# Firewall Rules
access-rule from WAN to LAN source any destination any service any action allow name "dangerous-rule"
access-rule from GUEST to LAN source any destination 192.168.1.0/24 service any action allow name "guest-to-lan"

# Admin Settings
admin username admin
https admin port 443
ssh enable
wan management enable

# Security Features
ips disable
gateway-av disable
dpi-ssl disable
botnet disable

# VPN Configuration
vpn policy name "site-to-site" encryption DES authentication psk

# System Settings
hostname firewall01
# NTP not configured
`;

/**
 * Example 8: Usage in a Next.js API route
 */
export const exampleAPIRoute = `
// File: src/app/api/firewall/config/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { uploadFirewallConfig } from '@/lib/__tests__/firewall-risk-storage-integration-example';

export async function POST(request: NextRequest) {
    const { deviceId, configFile } = await request.json();
    
    // Validate request
    if (!deviceId || !configFile) {
        return NextResponse.json(
            { error: 'Missing deviceId or configFile' },
            { status: 400 }
        );
    }
    
    try {
        // Upload and analyze config
        const result = await uploadFirewallConfig(deviceId, configFile);
        
        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Config upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload configuration' },
            { status: 500 }
        );
    }
}
`;
