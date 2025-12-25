/**
 * Tests for GET /api/edr/vulnerabilities/:cveId/devices endpoint
 * 
 * Requirements: 3.4, 9.4, 15.4
 * - Return list of devices affected by the vulnerability
 * - Enforce tenant isolation
 * - Validate CVE ID format
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { db } from '@/lib/database';
import {
    edrVulnerabilities,
    edrDevices,
    edrDeviceVulnerabilities,
} from '../../../../../../../../database/schemas/edr';
import { tenants, users } from '../../../../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';

// Mock the middleware
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

const { authMiddleware } = require('@/middleware/auth.middleware');
const { tenantMiddleware } = require('@/middleware/tenant.middleware');

describe('GET /api/edr/vulnerabilities/:cveId/devices', () => {
    let testTenantId: string;
    let testUserId: string;
    let testDeviceIds: string[] = [];
    let testVulnerabilityId: string;
    let testCveId: string;

    beforeAll(async () => {
        // Create test tenant
        const tenant = await db
            .insert(tenants)
            .values({
                name: 'Test Tenant Vuln Devices',
                domain: 'test-vuln-devices.example.com',
            })
            .returning();
        testTenantId = tenant[0].id;

        // Create test user
        const user = await db
            .insert(users)
            .values({
                email: 'test-vuln-devices@example.com',
                password_hash: 'hash',
                tenant_id: testTenantId,
                role: 'admin',
            })
            .returning();
        testUserId = user[0].id;

        // Create test devices
        const devices = await db
            .insert(edrDevices)
            .values([
                {
                    tenantId: testTenantId,
                    microsoftDeviceId: 'test-device-001',
                    deviceName: 'Device 1',
                    operatingSystem: 'Windows 11',
                    osVersion: '22H2',
                    primaryUser: 'user1@example.com',
                    defenderHealthStatus: 'active',
                    riskScore: 75,
                    exposureLevel: 'high',
                    intuneComplianceState: 'noncompliant',
                    intuneEnrollmentStatus: 'enrolled',
                },
                {
                    tenantId: testTenantId,
                    microsoftDeviceId: 'test-device-002',
                    deviceName: 'Device 2',
                    operatingSystem: 'Windows 10',
                    osVersion: '21H2',
                    primaryUser: 'user2@example.com',
                    defenderHealthStatus: 'active',
                    riskScore: 50,
                    exposureLevel: 'medium',
                    intuneComplianceState: 'compliant',
                    intuneEnrollmentStatus: 'enrolled',
                },
                {
                    tenantId: testTenantId,
                    microsoftDeviceId: 'test-device-003',
                    deviceName: 'Device 3',
                    operatingSystem: 'Windows 11',
                    osVersion: '23H2',
                    primaryUser: 'user3@example.com',
                    defenderHealthStatus: 'active',
                    riskScore: 30,
                    exposureLevel: 'low',
                    intuneComplianceState: 'compliant',
                    intuneEnrollmentStatus: 'enrolled',
                },
            ])
            .returning();

        testDeviceIds = devices.map((d) => d.id);

        // Create test vulnerability
        testCveId = 'CVE-2024-1234';
        const vulnerability = await db
            .insert(edrVulnerabilities)
            .values({
                tenantId: testTenantId,
                cveId: testCveId,
                severity: 'critical',
                cvssScore: '9.8',
                exploitability: 'high',
                description: 'Test critical vulnerability',
            })
            .returning();

        testVulnerabilityId = vulnerability[0].id;

        // Associate vulnerability with first two devices
        await db.insert(edrDeviceVulnerabilities).values([
            {
                deviceId: testDeviceIds[0],
                vulnerabilityId: testVulnerabilityId,
            },
            {
                deviceId: testDeviceIds[1],
                vulnerabilityId: testVulnerabilityId,
            },
        ]);
    });

    afterAll(async () => {
        // Clean up test data
        if (testTenantId) {
            await db.delete(tenants).where(eq(tenants.id, testTenantId));
        }
    });

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup default mock responses
        authMiddleware.mockResolvedValue({
            success: true,
            user: {
                id: testUserId,
                tenant_id: testTenantId,
                email: 'test-vuln-devices@example.com',
                role: 'admin',
            },
        });

        tenantMiddleware.mockResolvedValue({
            success: true,
            tenant: {
                id: testTenantId,
                name: 'Test Tenant Vuln Devices',
            },
        });
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 when authentication fails', async () => {
            authMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 when tenant validation fails', async () => {
            tenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Tenant not found' },
            });

            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('CVE ID Validation', () => {
        it('should accept valid CVE ID format (4 digits)', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });

            expect(response.status).toBe(200);
        });

        it('should accept valid CVE ID format (5 digits)', async () => {
            const cveId = 'CVE-2024-12345';
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${cveId}/devices`
            );
            const response = await GET(request, { params: { cveId } });

            // Will return 404 since it doesn't exist, but validates format
            expect(response.status).toBe(404);
        });

        it('should accept valid CVE ID format (6 digits)', async () => {
            const cveId = 'CVE-2024-123456';
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${cveId}/devices`
            );
            const response = await GET(request, { params: { cveId } });

            // Will return 404 since it doesn't exist, but validates format
            expect(response.status).toBe(404);
        });

        it('should accept valid CVE ID format (7 digits)', async () => {
            const cveId = 'CVE-2024-1234567';
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${cveId}/devices`
            );
            const response = await GET(request, { params: { cveId } });

            // Will return 404 since it doesn't exist, but validates format
            expect(response.status).toBe(404);
        });

        it('should accept lowercase CVE ID', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/cve-2024-1234/devices`
            );
            const response = await GET(request, {
                params: { cveId: 'cve-2024-1234' },
            });

            expect(response.status).toBe(200);
        });

        it('should return 400 for invalid CVE ID format (missing CVE prefix)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities/2024-1234/devices'
            );
            const response = await GET(request, { params: { cveId: '2024-1234' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid CVE ID format');
        });

        it('should return 400 for invalid CVE ID format (wrong year format)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities/CVE-24-1234/devices'
            );
            const response = await GET(request, { params: { cveId: 'CVE-24-1234' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for invalid CVE ID format (too few digits)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities/CVE-2024-123/devices'
            );
            const response = await GET(request, {
                params: { cveId: 'CVE-2024-123' },
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for invalid CVE ID format (too many digits)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities/CVE-2024-12345678/devices'
            );
            const response = await GET(request, {
                params: { cveId: 'CVE-2024-12345678' },
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Affected Devices Retrieval', () => {
        it('should return all devices affected by the vulnerability', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.devices).toHaveLength(2);
            expect(data.data.meta.total).toBe(2);
        });

        it('should include vulnerability details in response', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.vulnerability).toBeDefined();
            expect(data.data.vulnerability.cveId).toBe(testCveId);
            expect(data.data.vulnerability.severity).toBe('critical');
            expect(data.data.vulnerability.cvssScore).toBe(9.8);
            expect(data.data.vulnerability.exploitability).toBe('high');
        });

        it('should include device details for each affected device', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            const device = data.data.devices[0];
            expect(device).toHaveProperty('id');
            expect(device).toHaveProperty('deviceName');
            expect(device).toHaveProperty('operatingSystem');
            expect(device).toHaveProperty('osVersion');
            expect(device).toHaveProperty('primaryUser');
            expect(device).toHaveProperty('riskScore');
            expect(device).toHaveProperty('intuneComplianceState');
            expect(device).toHaveProperty('vulnerabilityDetectedAt');
        });

        it('should return 404 when vulnerability does not exist', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities/CVE-2024-9999/devices'
            );
            const response = await GET(request, {
                params: { cveId: 'CVE-2024-9999' },
            });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Vulnerability not found');
        });

        it('should return empty devices array when vulnerability has no affected devices', async () => {
            // Create a vulnerability with no device associations
            const noDeviceVuln = await db
                .insert(edrVulnerabilities)
                .values({
                    tenantId: testTenantId,
                    cveId: 'CVE-2024-5555',
                    severity: 'low',
                    cvssScore: '2.0',
                    exploitability: 'unproven',
                    description: 'No devices affected',
                })
                .returning();

            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities/CVE-2024-5555/devices'
            );
            const response = await GET(request, {
                params: { cveId: 'CVE-2024-5555' },
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.devices).toHaveLength(0);
            expect(data.data.meta.total).toBe(0);

            // Clean up
            await db
                .delete(edrVulnerabilities)
                .where(eq(edrVulnerabilities.id, noDeviceVuln[0].id));
        });
    });

    describe('Tenant Isolation', () => {
        it('should not return vulnerability from another tenant', async () => {
            // Create another tenant with a vulnerability
            const otherTenant = await db
                .insert(tenants)
                .values({
                    name: 'Other Tenant',
                    domain: 'other.example.com',
                })
                .returning();

            const otherVuln = await db
                .insert(edrVulnerabilities)
                .values({
                    tenantId: otherTenant[0].id,
                    cveId: 'CVE-2024-8888',
                    severity: 'critical',
                    cvssScore: '10.0',
                    exploitability: 'high',
                    description: 'Other tenant vulnerability',
                })
                .returning();

            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities/CVE-2024-8888/devices'
            );
            const response = await GET(request, {
                params: { cveId: 'CVE-2024-8888' },
            });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');

            // Clean up
            await db.delete(tenants).where(eq(tenants.id, otherTenant[0].id));
        });

        it('should only return devices from authenticated tenant', async () => {
            // Create another tenant with a device
            const otherTenant = await db
                .insert(tenants)
                .values({
                    name: 'Other Tenant 2',
                    domain: 'other2.example.com',
                })
                .returning();

            const otherDevice = await db
                .insert(edrDevices)
                .values({
                    tenantId: otherTenant[0].id,
                    microsoftDeviceId: 'other-device-001',
                    deviceName: 'Other Device',
                    operatingSystem: 'Windows 11',
                    osVersion: '22H2',
                    primaryUser: 'other@example.com',
                    defenderHealthStatus: 'active',
                    riskScore: 50,
                    exposureLevel: 'medium',
                    intuneComplianceState: 'compliant',
                    intuneEnrollmentStatus: 'enrolled',
                })
                .returning();

            // Associate the other tenant's device with our test vulnerability
            // This should not happen in practice, but tests tenant isolation
            await db.insert(edrDeviceVulnerabilities).values({
                deviceId: otherDevice[0].id,
                vulnerabilityId: testVulnerabilityId,
            });

            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            // Should still only return 2 devices (from test tenant)
            expect(data.data.devices).toHaveLength(2);
            expect(
                data.data.devices.every((d: any) => d.tenantId === testTenantId)
            ).toBe(true);

            // Clean up
            await db.delete(tenants).where(eq(tenants.id, otherTenant[0].id));
        });
    });

    describe('Response Format', () => {
        it('should return properly formatted response', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('data');
            expect(data.data).toHaveProperty('vulnerability');
            expect(data.data).toHaveProperty('devices');
            expect(data.data).toHaveProperty('meta');
            expect(data.data.meta).toHaveProperty('total');
        });

        it('should parse CVSS score as number', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/edr/vulnerabilities/${testCveId}/devices`
            );
            const response = await GET(request, { params: { cveId: testCveId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(typeof data.data.vulnerability.cvssScore).toBe('number');
        });
    });
});
