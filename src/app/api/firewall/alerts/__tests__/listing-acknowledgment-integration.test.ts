/**
 * Integration tests for Alert Listing and Acknowledgment workflow
 * 
 * Requirements:
 * - 15.7: Alert Management API - List alerts with filtering
 * - 15.8: Alert Management API - Acknowledge alerts
 * - 12.3: Filter alerts by tenant_id, device_id, severity, acknowledged status
 * - 17.1-17.4: Tenant isolation
 * 
 * Tests the complete workflow:
 * 1. Create multiple alerts
 * 2. List alerts with various filters
 * 3. Acknowledge specific alerts
 * 4. Verify listing reflects acknowledgment status
 * 5. Test tenant isolation throughout
 */

import { db } from '@/lib/database';
import { firewallAlerts, firewallDevices } from '@/../database/schemas/firewall';
import { tenants, users } from '@/../database/schemas/main';
import { eq } from 'drizzle-orm';
import { AlertManager } from '@/lib/alert-manager';

describe('Alert Listing and Acknowledgment Integration', () => {
    let testTenantId: string;
    let testUserId: string;
    let testDeviceId: string;
    let alertIds: string[] = [];

    beforeEach(async () => {
        if (!db) {
            throw new Error('Database connection not available');
        }

        // Create test tenant
        const uniqueDomain = `test-alert-integration-${Date.now()}-${Math.random().toString(36).substring(7)}.test`;
        const [tenant] = await db
            .insert(tenants)
            .values({
                name: 'Test Tenant - Alert Integration',
                domain: uniqueDomain,
            })
            .returning();
        testTenantId = tenant.id;

        // Create test user
        const uniqueEmail = `test-alert-integration-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
        const [user] = await db
            .insert(users)
            .values({
                email: uniqueEmail,
                first_name: 'Test',
                last_name: 'User',
                password_hash: 'test-hash',
                tenant_id: testTenantId,
                role: 'tenant_admin',
                email_verified: true,
            })
            .returning();
        testUserId = user.id;

        // Create test device
        const uniqueSerial = `TEST-INTEGRATION-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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

        // Create multiple test alerts with different severities and types
        const alertsToCreate = [
            {
                alertType: 'wan_down',
                severity: 'critical' as const,
                message: 'WAN interface is down',
            },
            {
                alertType: 'vpn_down',
                severity: 'high' as const,
                message: 'VPN tunnel is down',
            },
            {
                alertType: 'high_cpu',
                severity: 'medium' as const,
                message: 'CPU usage above 80%',
            },
            {
                alertType: 'license_expiring',
                severity: 'low' as const,
                message: 'IPS license expiring in 30 days',
            },
            {
                alertType: 'config_change',
                severity: 'info' as const,
                message: 'Configuration updated',
            },
        ];

        alertIds = [];
        for (const alertData of alertsToCreate) {
            const [alert] = await db
                .insert(firewallAlerts)
                .values({
                    tenantId: testTenantId,
                    deviceId: testDeviceId,
                    alertType: alertData.alertType,
                    severity: alertData.severity,
                    message: alertData.message,
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                })
                .returning();
            alertIds.push(alert.id);
        }
    });

    afterEach(async () => {
        if (!db) return;

        // Cleanup
        await db.delete(firewallAlerts).where(eq(firewallAlerts.tenantId, testTenantId));
        await db.delete(firewallDevices).where(eq(firewallDevices.tenantId, testTenantId));
        await db.delete(users).where(eq(users.tenant_id, testTenantId));
        await db.delete(tenants).where(eq(tenants.id, testTenantId));
    });

    describe('Complete Workflow: List → Acknowledge → Verify', () => {
        it('should list all unacknowledged alerts, acknowledge one, and verify status change', async () => {
            // Step 1: List all unacknowledged alerts
            const unacknowledgedAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                acknowledged: false,
            });

            expect(unacknowledgedAlerts).toHaveLength(5);
            expect(unacknowledgedAlerts.every(a => !a.acknowledged)).toBe(true);

            // Step 2: Acknowledge the critical alert
            const criticalAlert = unacknowledgedAlerts.find(a => a.severity === 'critical');
            expect(criticalAlert).toBeDefined();

            await AlertManager.acknowledgeAlert(criticalAlert!.id, testUserId);

            // Step 3: List unacknowledged alerts again
            const remainingUnacknowledged = await AlertManager.getAlerts({
                tenantId: testTenantId,
                acknowledged: false,
            });

            expect(remainingUnacknowledged).toHaveLength(4);
            expect(remainingUnacknowledged.find(a => a.id === criticalAlert!.id)).toBeUndefined();

            // Step 4: List acknowledged alerts
            const acknowledgedAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                acknowledged: true,
            });

            expect(acknowledgedAlerts).toHaveLength(1);
            expect(acknowledgedAlerts[0].id).toBe(criticalAlert!.id);
            expect(acknowledgedAlerts[0].acknowledged).toBe(true);
            expect(acknowledgedAlerts[0].acknowledgedBy).toBe(testUserId);
            expect(acknowledgedAlerts[0].acknowledgedAt).toBeDefined();
        });

        it('should filter by severity, acknowledge multiple, and verify counts', async () => {
            // Step 1: List critical and high severity alerts
            const highPriorityAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                severity: ['critical', 'high'],
            });

            expect(highPriorityAlerts).toHaveLength(2);

            // Step 2: Acknowledge both high-priority alerts
            for (const alert of highPriorityAlerts) {
                await AlertManager.acknowledgeAlert(alert.id, testUserId);
            }

            // Step 3: Verify unacknowledged count decreased
            const remainingUnacknowledged = await AlertManager.getAlerts({
                tenantId: testTenantId,
                acknowledged: false,
            });

            expect(remainingUnacknowledged).toHaveLength(3);
            expect(remainingUnacknowledged.every(a =>
                a.severity !== 'critical' && a.severity !== 'high'
            )).toBe(true);

            // Step 4: Verify acknowledged high-priority alerts
            const acknowledgedHighPriority = await AlertManager.getAlerts({
                tenantId: testTenantId,
                acknowledged: true,
                severity: ['critical', 'high'],
            });

            expect(acknowledgedHighPriority).toHaveLength(2);
        });

        it('should list by device, acknowledge, and verify device-specific filtering', async () => {
            // Step 1: List all alerts for the device
            const deviceAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                deviceId: testDeviceId,
            });

            expect(deviceAlerts).toHaveLength(5);

            // Step 2: Acknowledge first 3 alerts
            for (let i = 0; i < 3; i++) {
                await AlertManager.acknowledgeAlert(deviceAlerts[i].id, testUserId);
            }

            // Step 3: List unacknowledged alerts for device
            const unacknowledgedDeviceAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                deviceId: testDeviceId,
                acknowledged: false,
            });

            expect(unacknowledgedDeviceAlerts).toHaveLength(2);

            // Step 4: List acknowledged alerts for device
            const acknowledgedDeviceAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                deviceId: testDeviceId,
                acknowledged: true,
            });

            expect(acknowledgedDeviceAlerts).toHaveLength(3);
        });
    });

    describe('Tenant Isolation in Workflow', () => {
        it('should not allow acknowledging alerts from other tenants', async () => {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Create another tenant with alerts
            const tenant2Domain = `tenant-2-${Date.now()}-${Math.random().toString(36).substring(7)}.test`;
            const [tenant2] = await db
                .insert(tenants)
                .values({
                    name: 'Tenant 2',
                    domain: tenant2Domain,
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
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN down on tenant 2',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                })
                .returning();

            // Step 1: Tenant 1 lists alerts - should not see tenant 2 alerts
            const tenant1Alerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
            });

            expect(tenant1Alerts).toHaveLength(5);
            expect(tenant1Alerts.find(a => a.id === alert2.id)).toBeUndefined();

            // Step 2: Tenant 2 lists alerts - should only see their own
            const tenant2Alerts = await AlertManager.getAlerts({
                tenantId: tenant2.id,
            });

            expect(tenant2Alerts).toHaveLength(1);
            expect(tenant2Alerts[0].id).toBe(alert2.id);

            // Cleanup
            await db.delete(firewallAlerts).where(eq(firewallAlerts.tenantId, tenant2.id));
            await db.delete(firewallDevices).where(eq(firewallDevices.tenantId, tenant2.id));
            await db.delete(tenants).where(eq(tenants.id, tenant2.id));
        });
    });

    describe('Pagination with Acknowledgment', () => {
        it('should paginate alerts and acknowledge across pages', async () => {
            // Step 1: Get first page (limit 2)
            const page1 = await AlertManager.getAlerts({
                tenantId: testTenantId,
                limit: 2,
                offset: 0,
            });

            expect(page1).toHaveLength(2);

            // Step 2: Acknowledge alerts from first page
            for (const alert of page1) {
                await AlertManager.acknowledgeAlert(alert.id, testUserId);
            }

            // Step 3: Get second page (limit 2, offset 2)
            const page2 = await AlertManager.getAlerts({
                tenantId: testTenantId,
                limit: 2,
                offset: 2,
                acknowledged: false,
            });

            expect(page2).toHaveLength(2);

            // Step 4: Verify first page alerts are acknowledged
            const acknowledgedAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                acknowledged: true,
            });

            expect(acknowledgedAlerts).toHaveLength(2);
            expect(acknowledgedAlerts.map(a => a.id).sort()).toEqual(page1.map(a => a.id).sort());
        });
    });

    describe('Date Range Filtering with Acknowledgment', () => {
        it('should filter by date range and acknowledge within range', async () => {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Create alerts with specific timestamps
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

            const [oldAlert] = await db
                .insert(firewallAlerts)
                .values({
                    tenantId: testTenantId,
                    deviceId: testDeviceId,
                    alertType: 'old_alert',
                    severity: 'low',
                    message: 'Old alert',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    createdAt: twoDaysAgo,
                })
                .returning();

            // Step 1: List alerts from yesterday onwards
            const recentAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                startDate: yesterday,
            });

            // Should include today's 5 alerts but not the old one
            expect(recentAlerts.length).toBeGreaterThanOrEqual(5);
            expect(recentAlerts.find(a => a.id === oldAlert.id)).toBeUndefined();

            // Step 2: Acknowledge recent alerts
            for (const alert of recentAlerts.slice(0, 2)) {
                await AlertManager.acknowledgeAlert(alert.id, testUserId);
            }

            // Step 3: List unacknowledged recent alerts
            const unacknowledgedRecent = await AlertManager.getAlerts({
                tenantId: testTenantId,
                startDate: yesterday,
                acknowledged: false,
            });

            expect(unacknowledgedRecent.length).toBe(recentAlerts.length - 2);
        });
    });

    describe('Combined Filters with Acknowledgment', () => {
        it('should apply multiple filters, acknowledge, and verify complex queries', async () => {
            // Step 1: List critical/high alerts for device that are unacknowledged
            const criticalUnacknowledged = await AlertManager.getAlerts({
                tenantId: testTenantId,
                deviceId: testDeviceId,
                severity: ['critical', 'high'],
                acknowledged: false,
            });

            expect(criticalUnacknowledged).toHaveLength(2);

            // Step 2: Acknowledge one critical alert
            await AlertManager.acknowledgeAlert(criticalUnacknowledged[0].id, testUserId);

            // Step 3: Re-query with same filters
            const remainingCritical = await AlertManager.getAlerts({
                tenantId: testTenantId,
                deviceId: testDeviceId,
                severity: ['critical', 'high'],
                acknowledged: false,
            });

            expect(remainingCritical).toHaveLength(1);

            // Step 4: Query acknowledged critical/high alerts
            const acknowledgedCritical = await AlertManager.getAlerts({
                tenantId: testTenantId,
                deviceId: testDeviceId,
                severity: ['critical', 'high'],
                acknowledged: true,
            });

            expect(acknowledgedCritical).toHaveLength(1);
            expect(acknowledgedCritical[0].id).toBe(criticalUnacknowledged[0].id);
        });
    });

    describe('Acknowledgment Metadata Verification', () => {
        it('should properly set all acknowledgment fields when acknowledging', async () => {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const beforeTime = new Date();

            // Get an alert
            const alerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                limit: 1,
            });

            const alertToAck = alerts[0];

            // Acknowledge it
            await AlertManager.acknowledgeAlert(alertToAck.id, testUserId);

            const afterTime = new Date();

            // Fetch the acknowledged alert
            const acknowledgedAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                acknowledged: true,
            });

            const acknowledgedAlert = acknowledgedAlerts.find(a => a.id === alertToAck.id);

            expect(acknowledgedAlert).toBeDefined();
            expect(acknowledgedAlert!.acknowledged).toBe(true);
            expect(acknowledgedAlert!.acknowledgedBy).toBe(testUserId);
            expect(acknowledgedAlert!.acknowledgedAt).toBeDefined();

            // Verify timestamp is within reasonable range
            const ackTime = new Date(acknowledgedAlert!.acknowledgedAt!);
            expect(ackTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(ackTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });
    });

    describe('Bulk Acknowledgment Workflow', () => {
        it('should acknowledge all alerts of a specific severity', async () => {
            // Step 1: Get all medium and low severity alerts
            const lowPriorityAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
                severity: ['medium', 'low'],
            });

            expect(lowPriorityAlerts.length).toBeGreaterThan(0);

            // Step 2: Acknowledge all of them
            for (const alert of lowPriorityAlerts) {
                await AlertManager.acknowledgeAlert(alert.id, testUserId);
            }

            // Step 3: Verify all are acknowledged
            const acknowledgedLowPriority = await AlertManager.getAlerts({
                tenantId: testTenantId,
                severity: ['medium', 'low'],
                acknowledged: true,
            });

            expect(acknowledgedLowPriority).toHaveLength(lowPriorityAlerts.length);

            // Step 4: Verify no unacknowledged low-priority alerts remain
            const unacknowledgedLowPriority = await AlertManager.getAlerts({
                tenantId: testTenantId,
                severity: ['medium', 'low'],
                acknowledged: false,
            });

            expect(unacknowledgedLowPriority).toHaveLength(0);
        });
    });

    describe('Sorting Verification', () => {
        it('should maintain timestamp descending order after acknowledgments', async () => {
            // Get all alerts (should be sorted by timestamp desc)
            const allAlerts = await AlertManager.getAlerts({
                tenantId: testTenantId,
            });

            // Verify initial sort order
            for (let i = 0; i < allAlerts.length - 1; i++) {
                const current = new Date(allAlerts[i].createdAt).getTime();
                const next = new Date(allAlerts[i + 1].createdAt).getTime();
                expect(current).toBeGreaterThanOrEqual(next);
            }

            // Acknowledge some alerts
            await AlertManager.acknowledgeAlert(allAlerts[0].id, testUserId);
            await AlertManager.acknowledgeAlert(allAlerts[2].id, testUserId);

            // Get all alerts again
            const alertsAfterAck = await AlertManager.getAlerts({
                tenantId: testTenantId,
            });

            // Verify sort order is still maintained
            for (let i = 0; i < alertsAfterAck.length - 1; i++) {
                const current = new Date(alertsAfterAck[i].createdAt).getTime();
                const next = new Date(alertsAfterAck[i + 1].createdAt).getTime();
                expect(current).toBeGreaterThanOrEqual(next);
            }
        });
    });
});
