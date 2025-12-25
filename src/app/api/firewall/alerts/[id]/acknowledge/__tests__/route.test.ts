/**
 * Tests for PUT /api/firewall/alerts/:id/acknowledge
 * 
 * Requirements: 15.8 - Alert Management API
 */

// Mock NextResponse before other imports
jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    return {
        ...actual,
        NextResponse: {
            json: (body: any, init?: ResponseInit) => {
                return new Response(JSON.stringify(body), {
                    ...init,
                    headers: {
                        'content-type': 'application/json',
                        ...init?.headers,
                    },
                });
            },
        },
    };
});

// Mock the middleware
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');

// Mock AlertManager
jest.mock('@/lib/alert-manager', () => ({
    AlertManager: {
        acknowledgeAlert: jest.fn(),
    },
}));

import { PUT } from '../route';
import { db } from '@/lib/database';
import { firewallAlerts, firewallDevices } from '@/../database/schemas/firewall';
import { tenants, users } from '@/../database/schemas/main';
import { eq, and } from 'drizzle-orm';
import { AlertManager } from '@/lib/alert-manager';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

describe('PUT /api/firewall/alerts/:id/acknowledge', () => {
    let testTenantId: string;
    let testUserId: string;
    let testDeviceId: string;
    let testAlertId: string;

    beforeEach(async () => {
        if (!db) {
            throw new Error('Database connection not available');
        }

        // Create test tenant with unique slug
        const uniqueSlug = `test-alert-ack-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const [tenant] = await db
            .insert(tenants)
            .values({
                name: 'Test Tenant - Alert Acknowledge',
                slug: uniqueSlug,
            })
            .returning();
        testTenantId = tenant.id;

        // Create test user with unique email
        const uniqueEmail = `test-alert-ack-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
        const [user] = await db
            .insert(users)
            .values({
                email: uniqueEmail,
                password_hash: 'test-hash',
                tenant_id: testTenantId,
                role: 'admin',
                email_verified: true,
            })
            .returning();
        testUserId = user.id;

        // Create test device with unique serial
        const uniqueSerial = `TEST-ACK-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const [device] = await db
            .insert(firewallDevices)
            .values({
                tenantId: testTenantId,
                managementIp: '192.168.1.100',
                model: 'TZ400',
                serialNumber: uniqueSerial,
                status: 'active',
            })
            .returning();
        testDeviceId = device.id;

        // Create test alert (unacknowledged)
        const [alert] = await db
            .insert(firewallAlerts)
            .values({
                tenantId: testTenantId,
                deviceId: testDeviceId,
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
                metadata: {},
                acknowledged: false,
            })
            .returning();
        testAlertId = alert.id;

        // Setup default middleware mocks
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: testUserId,
                email: uniqueEmail,
                tenant_id: testTenantId,
                role: 'admin',
            },
        });

        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: {
                id: testTenantId,
                name: 'Test Tenant - Alert Acknowledge',
                slug: uniqueSlug,
            },
        });

        // Mock AlertManager.acknowledgeAlert
        (AlertManager.acknowledgeAlert as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(async () => {
        if (!db) return;

        // Cleanup in reverse order of dependencies
        await db.delete(firewallAlerts).where(eq(firewallAlerts.tenantId, testTenantId));
        await db.delete(firewallDevices).where(eq(firewallDevices.tenantId, testTenantId));
        await db.delete(users).where(eq(users.tenant_id, testTenantId));
        await db.delete(tenants).where(eq(tenants.id, testTenantId));

        jest.clearAllMocks();
    });

    it('should acknowledge an alert successfully', async () => {
        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${testAlertId}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: testAlertId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Alert acknowledged successfully');
        expect(data.data).toBeDefined();
        expect(data.data.id).toBe(testAlertId);
        expect(data.data.acknowledged).toBe(true);
        expect(data.data.acknowledgedBy).toBe(testUserId);
        expect(data.data.acknowledgedAt).toBeDefined();

        // Verify AlertManager.acknowledgeAlert was called
        expect(AlertManager.acknowledgeAlert).toHaveBeenCalledWith(testAlertId, testUserId);
    });

    it('should return 401 if user is not authenticated', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: 'Authentication required',
        });

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${testAlertId}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: testAlertId } });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 if tenant validation fails', async () => {
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: { message: 'Tenant validation failed' },
        });

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${testAlertId}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: testAlertId } });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('TENANT_ERROR');
    });

    it('should return 400 for invalid alert ID format', async () => {
        const invalidId = 'not-a-uuid';

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${invalidId}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: invalidId } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toBe('Invalid alert ID format');
    });

    it('should return 404 if alert does not exist', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${nonExistentId}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: nonExistentId } });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NOT_FOUND');
        expect(data.error.message).toBe('Alert not found or access denied');
    });

    it('should return 404 if alert belongs to different tenant', async () => {
        if (!db) {
            throw new Error('Database connection not available');
        }

        // Create another tenant
        const otherSlug = `other-tenant-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const [otherTenant] = await db
            .insert(tenants)
            .values({
                name: 'Other Tenant',
                slug: otherSlug,
            })
            .returning();

        // Create device for other tenant
        const otherSerial = `OTHER-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const [otherDevice] = await db
            .insert(firewallDevices)
            .values({
                tenantId: otherTenant.id,
                managementIp: '192.168.2.100',
                model: 'TZ500',
                serialNumber: otherSerial,
                status: 'active',
            })
            .returning();

        // Create alert for other tenant
        const [otherAlert] = await db
            .insert(firewallAlerts)
            .values({
                tenantId: otherTenant.id,
                deviceId: otherDevice.id,
                alertType: 'vpn_down',
                severity: 'high',
                message: 'VPN tunnel is down',
                source: 'api',
                metadata: {},
                acknowledged: false,
            })
            .returning();

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${otherAlert.id}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: otherAlert.id } });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NOT_FOUND');
        expect(data.error.message).toBe('Alert not found or access denied');

        // Cleanup
        await db.delete(firewallAlerts).where(eq(firewallAlerts.tenantId, otherTenant.id));
        await db.delete(firewallDevices).where(eq(firewallDevices.tenantId, otherTenant.id));
        await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
    });

    it('should return 400 if alert is already acknowledged', async () => {
        if (!db) {
            throw new Error('Database connection not available');
        }

        // Create an already acknowledged alert
        const [acknowledgedAlert] = await db
            .insert(firewallAlerts)
            .values({
                tenantId: testTenantId,
                deviceId: testDeviceId,
                alertType: 'high_cpu',
                severity: 'medium',
                message: 'CPU usage is high',
                source: 'api',
                metadata: {},
                acknowledged: true,
                acknowledgedBy: testUserId,
                acknowledgedAt: new Date(),
            })
            .returning();

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${acknowledgedAlert.id}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: acknowledgedAlert.id } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('ALREADY_ACKNOWLEDGED');
        expect(data.error.message).toBe('Alert has already been acknowledged');

        // Verify AlertManager.acknowledgeAlert was NOT called
        expect(AlertManager.acknowledgeAlert).not.toHaveBeenCalled();
    });

    it('should handle AlertManager errors gracefully', async () => {
        (AlertManager.acknowledgeAlert as jest.Mock).mockRejectedValue(
            new Error('Database error')
        );

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${testAlertId}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: testAlertId } });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INTERNAL_ERROR');
        expect(data.error.message).toBe('Failed to acknowledge alert');
    });

    it('should enforce tenant isolation - user cannot acknowledge alerts from other tenants', async () => {
        if (!db) {
            throw new Error('Database connection not available');
        }

        // Create another tenant with device and alert
        const tenant2Slug = `tenant-2-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const [tenant2] = await db
            .insert(tenants)
            .values({
                name: 'Tenant 2',
                slug: tenant2Slug,
            })
            .returning();

        const tenant2Serial = `TENANT2-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const [device2] = await db
            .insert(firewallDevices)
            .values({
                tenantId: tenant2.id,
                managementIp: '10.0.0.100',
                model: 'NSA 2700',
                serialNumber: tenant2Serial,
                status: 'active',
            })
            .returning();

        const [alert2] = await db
            .insert(firewallAlerts)
            .values({
                tenantId: tenant2.id,
                deviceId: device2.id,
                alertType: 'license_expiring',
                severity: 'medium',
                message: 'IPS license expiring soon',
                source: 'api',
                metadata: {},
                acknowledged: false,
            })
            .returning();

        // User from testTenantId tries to acknowledge alert from tenant2
        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${alert2.id}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: alert2.id } });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NOT_FOUND');

        // Verify alert was NOT acknowledged
        const unchangedAlert = await db.query.firewallAlerts.findFirst({
            where: eq(firewallAlerts.id, alert2.id),
        });
        expect(unchangedAlert?.acknowledged).toBe(false);

        // Cleanup
        await db.delete(firewallAlerts).where(eq(firewallAlerts.tenantId, tenant2.id));
        await db.delete(firewallDevices).where(eq(firewallDevices.tenantId, tenant2.id));
        await db.delete(tenants).where(eq(tenants.id, tenant2.id));
    });

    it('should update all acknowledgment fields correctly', async () => {
        if (!db) {
            throw new Error('Database connection not available');
        }

        const beforeTime = new Date();

        const request = new Request(
            `http://localhost:3000/api/firewall/alerts/${testAlertId}/acknowledge`,
            {
                method: 'PUT',
            }
        );

        const response = await PUT(request, { params: { id: testAlertId } });
        const data = await response.json();

        const afterTime = new Date();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify all acknowledgment fields are set
        const updatedAlert = await db.query.firewallAlerts.findFirst({
            where: eq(firewallAlerts.id, testAlertId),
        });

        expect(updatedAlert).toBeDefined();
        expect(updatedAlert?.acknowledged).toBe(true);
        expect(updatedAlert?.acknowledgedBy).toBe(testUserId);
        expect(updatedAlert?.acknowledgedAt).toBeDefined();

        // Verify timestamp is reasonable
        const ackTime = new Date(updatedAlert!.acknowledgedAt!);
        expect(ackTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(ackTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
});
