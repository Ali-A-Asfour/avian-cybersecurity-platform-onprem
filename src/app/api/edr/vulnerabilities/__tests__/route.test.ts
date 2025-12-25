/**
 * Tests for GET /api/edr/vulnerabilities endpoint
 * 
 * Requirements: 3.4, 9.4, 15.2, 15.4
 * - List vulnerabilities filtered by tenant
 * - Support filters (severity, exploitability)
 * - Include affected device count in response
 * - Support pagination
 * - Enforce tenant isolation
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { db } from '@/lib/database';
import {
    edrVulnerabilities,
    edrDevices,
    edrDeviceVulnerabilities,
} from '../../../../../../database/schemas/edr';
import { tenants, users } from '../../../../../../database/schemas/main';
import { eq, and } from 'drizzle-orm';

// Mock the middleware
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

const { authMiddleware } = require('@/middleware/auth.middleware');
const { tenantMiddleware } = require('@/middleware/tenant.middleware');

describe('GET /api/edr/vulnerabilities', () => {
    let testTenantId: string;
    let testUserId: string;
    let testDeviceId: string;
    let testVulnerabilityIds: string[] = [];

    beforeAll(async () => {
        // Create test tenant
        const tenant = await db
            .insert(tenants)
            .values({
                name: 'Test Tenant Vulnerabilities',
                domain: 'test-vuln.example.com',
            })
            .returning();
        testTenantId = tenant[0].id;

        // Create test user
        const user = await db
            .insert(users)
            .values({
                email: 'test-vuln@example.com',
                password_hash: 'hash',
                tenant_id: testTenantId,
                role: 'admin',
            })
            .returning();
        testUserId = user[0].id;

        // Create test device
        const device = await db
            .insert(edrDevices)
            .values({
                tenantId: testTenantId,
                microsoftDeviceId: 'test-device-vuln-001',
                deviceName: 'Test Device Vuln',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'active',
                riskScore: 50,
                exposureLevel: 'medium',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
            })
            .returning();
        testDeviceId = device[0].id;

        // Create test vulnerabilities with different severities and exploitability
        const vulnerabilities = await db
            .insert(edrVulnerabilities)
            .values([
                {
                    tenantId: testTenantId,
                    cveId: 'CVE-2024-0001',
                    severity: 'critical',
                    cvssScore: '9.8',
                    exploitability: 'high',
                    description: 'Critical vulnerability 1',
                },
                {
                    tenantId: testTenantId,
                    cveId: 'CVE-2024-0002',
                    severity: 'high',
                    cvssScore: '7.5',
                    exploitability: 'functional',
                    description: 'High vulnerability 1',
                },
                {
                    tenantId: testTenantId,
                    cveId: 'CVE-2024-0003',
                    severity: 'medium',
                    cvssScore: '5.0',
                    exploitability: 'proof_of_concept',
                    description: 'Medium vulnerability 1',
                },
                {
                    tenantId: testTenantId,
                    cveId: 'CVE-2024-0004',
                    severity: 'low',
                    cvssScore: '2.5',
                    exploitability: 'unproven',
                    description: 'Low vulnerability 1',
                },
            ])
            .returning();

        testVulnerabilityIds = vulnerabilities.map((v) => v.id);

        // Associate first two vulnerabilities with the device
        await db.insert(edrDeviceVulnerabilities).values([
            {
                deviceId: testDeviceId,
                vulnerabilityId: testVulnerabilityIds[0],
            },
            {
                deviceId: testDeviceId,
                vulnerabilityId: testVulnerabilityIds[1],
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
                email: 'test-vuln@example.com',
                role: 'admin',
            },
        });

        tenantMiddleware.mockResolvedValue({
            success: true,
            tenant: {
                id: testTenantId,
                name: 'Test Tenant Vulnerabilities',
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
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
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
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Vulnerability Listing', () => {
        it('should return all vulnerabilities for tenant', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(4);
            expect(data.meta.total).toBe(4);
            expect(data.meta.page).toBe(1);
            expect(data.meta.limit).toBe(50);
        });

        it('should include affected device count for each vulnerability', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            // Find the critical vulnerability
            const criticalVuln = data.data.find(
                (v: any) => v.cveId === 'CVE-2024-0001'
            );
            expect(criticalVuln.affectedDeviceCount).toBe(1);

            // Find the high vulnerability
            const highVuln = data.data.find((v: any) => v.cveId === 'CVE-2024-0002');
            expect(highVuln.affectedDeviceCount).toBe(1);

            // Find the medium vulnerability (not associated with device)
            const mediumVuln = data.data.find(
                (v: any) => v.cveId === 'CVE-2024-0003'
            );
            expect(mediumVuln.affectedDeviceCount).toBe(0);
        });

        it('should order vulnerabilities by CVSS score descending', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data[0].cvssScore).toBe(9.8);
            expect(data.data[1].cvssScore).toBe(7.5);
            expect(data.data[2].cvssScore).toBe(5.0);
            expect(data.data[3].cvssScore).toBe(2.5);
        });
    });

    describe('Severity Filtering', () => {
        it('should filter vulnerabilities by critical severity', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?severity=critical'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].severity).toBe('critical');
            expect(data.data[0].cveId).toBe('CVE-2024-0001');
        });

        it('should filter vulnerabilities by high severity', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?severity=high'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].severity).toBe('high');
        });

        it('should filter vulnerabilities by medium severity', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?severity=medium'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].severity).toBe('medium');
        });

        it('should filter vulnerabilities by low severity', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?severity=low'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].severity).toBe('low');
        });

        it('should return 400 for invalid severity', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?severity=invalid'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Severity must be one of');
        });
    });

    describe('Exploitability Filtering', () => {
        it('should filter vulnerabilities by high exploitability', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?exploitability=high'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].exploitability).toBe('high');
        });

        it('should filter vulnerabilities by functional exploitability', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?exploitability=functional'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].exploitability).toBe('functional');
        });

        it('should filter vulnerabilities by proof_of_concept exploitability', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?exploitability=proof_of_concept'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].exploitability).toBe('proof_of_concept');
        });

        it('should filter vulnerabilities by unproven exploitability', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?exploitability=unproven'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].exploitability).toBe('unproven');
        });

        it('should return 400 for invalid exploitability', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?exploitability=invalid'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Exploitability must be one of');
        });
    });

    describe('Combined Filtering', () => {
        it('should filter by both severity and exploitability', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?severity=critical&exploitability=high'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].severity).toBe('critical');
            expect(data.data[0].exploitability).toBe('high');
        });

        it('should return empty array when no vulnerabilities match filters', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?severity=low&exploitability=high'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(0);
            expect(data.meta.total).toBe(0);
        });
    });

    describe('Pagination', () => {
        it('should paginate results with default page and limit', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.meta.page).toBe(1);
            expect(data.meta.limit).toBe(50);
            expect(data.meta.totalPages).toBe(1);
        });

        it('should paginate results with custom limit', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?limit=2'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(2);
            expect(data.meta.limit).toBe(2);
            expect(data.meta.totalPages).toBe(2);
        });

        it('should return second page of results', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?page=2&limit=2'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(2);
            expect(data.meta.page).toBe(2);
        });

        it('should return 400 for invalid page number', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?page=0'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Page must be a positive number');
        });

        it('should return 400 for invalid limit', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities?limit=101'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Limit must be a number between 1 and 100');
        });
    });

    describe('Tenant Isolation', () => {
        it('should only return vulnerabilities for authenticated tenant', async () => {
            // Create another tenant with vulnerabilities
            const otherTenant = await db
                .insert(tenants)
                .values({
                    name: 'Other Tenant',
                    domain: 'other.example.com',
                })
                .returning();

            await db.insert(edrVulnerabilities).values({
                tenantId: otherTenant[0].id,
                cveId: 'CVE-2024-9999',
                severity: 'critical',
                cvssScore: '10.0',
                exploitability: 'high',
                description: 'Other tenant vulnerability',
            });

            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(4); // Only test tenant vulnerabilities
            expect(data.data.every((v: any) => v.tenantId === testTenantId)).toBe(
                true
            );

            // Clean up
            await db.delete(tenants).where(eq(tenants.id, otherTenant[0].id));
        });
    });

    describe('Response Format', () => {
        it('should return vulnerabilities with all required fields', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            const vuln = data.data[0];
            expect(vuln).toHaveProperty('id');
            expect(vuln).toHaveProperty('tenantId');
            expect(vuln).toHaveProperty('cveId');
            expect(vuln).toHaveProperty('severity');
            expect(vuln).toHaveProperty('cvssScore');
            expect(vuln).toHaveProperty('exploitability');
            expect(vuln).toHaveProperty('description');
            expect(vuln).toHaveProperty('affectedDeviceCount');
            expect(vuln).toHaveProperty('createdAt');
            expect(vuln).toHaveProperty('updatedAt');
        });

        it('should parse CVSS score as number', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/vulnerabilities'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(typeof data.data[0].cvssScore).toBe('number');
        });
    });
});
