/**
 * Test Suite: 404 Not Found Error Handling Verification
 * 
 * Requirements: Task 8.6 - Return 404 for not found resources
 * 
 * This test suite verifies that all firewall API endpoints properly return
 * 404 status codes with appropriate error messages when resources are not found.
 */

import { NextRequest } from 'next/server';
import { GET as getDevice } from '../devices/[id]/route';
import { GET as getPosture } from '../posture/[deviceId]/route';
import { GET as getHealth } from '../health/[deviceId]/route';
import { GET as getLicenses } from '../licenses/[deviceId]/route';
import { GET as getRisks } from '../config/risks/[deviceId]/route';
import { GET as getMetrics } from '../metrics/[deviceId]/route';
import { PUT as acknowledgeAlert } from '../alerts/[id]/acknowledge/route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';

// Mock dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
        query: {
            firewallAlerts: {
                findFirst: jest.fn(),
            },
        },
    },
}));

describe('404 Not Found Error Handling - All Endpoints', () => {
    const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_id: '660e8400-e29b-41d4-a716-446655440000',
        role: 'tenant_admin',
        email: 'admin@test.com',
    };

    const mockTenant = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        name: 'Test Tenant',
    };

    const nonExistentDeviceId = '00000000-0000-0000-0000-000000000000';
    const nonExistentAlertId = '00000000-0000-0000-0000-000000000001';

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock successful authentication
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: mockUser,
        });

        // Mock successful tenant validation
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });
    });

    describe('Device Endpoints - 404 Handling', () => {
        it('GET /api/firewall/devices/:id should return 404 when device not found', async () => {
            // Mock database to return empty result
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${nonExistentDeviceId}`
            );

            const response = await getDevice(request, {
                params: { id: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });
    });

    describe('Posture Endpoint - 404 Handling', () => {
        it('GET /api/firewall/posture/:deviceId should return 404 when device not found', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/posture/${nonExistentDeviceId}`
            );

            const response = await getPosture(request, {
                params: { deviceId: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });

        it('GET /api/firewall/posture/:deviceId should return 404 when no posture data exists', async () => {
            // Mock device exists but no posture data
            const mockDevice = {
                id: nonExistentDeviceId,
                tenantId: mockUser.tenant_id,
                model: 'TZ400',
                firmwareVersion: '7.0.1',
                serialNumber: 'TEST123',
                managementIp: '192.168.1.1',
            };

            let callCount = 0;
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue(callCount++ === 0 ? [mockDevice] : []),
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/posture/${nonExistentDeviceId}`
            );

            const response = await getPosture(request, {
                params: { deviceId: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('No security posture data found for this device');
        });
    });

    describe('Health Endpoint - 404 Handling', () => {
        it('GET /api/firewall/health/:deviceId should return 404 when device not found', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/health/${nonExistentDeviceId}`
            );

            const response = await getHealth(request, {
                params: { deviceId: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });
    });

    describe('Licenses Endpoint - 404 Handling', () => {
        it('GET /api/firewall/licenses/:deviceId should return 404 when device not found', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${nonExistentDeviceId}`
            );

            const response = await getLicenses(request, {
                params: { deviceId: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });

        it('GET /api/firewall/licenses/:deviceId should return 404 when no license data exists', async () => {
            // Mock device exists but no license data
            const mockDevice = {
                id: nonExistentDeviceId,
                tenantId: mockUser.tenant_id,
                model: 'TZ400',
                firmwareVersion: '7.0.1',
                serialNumber: 'TEST123',
                managementIp: '192.168.1.1',
            };

            let callCount = 0;
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue(callCount++ === 0 ? [mockDevice] : []),
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${nonExistentDeviceId}`
            );

            const response = await getLicenses(request, {
                params: { deviceId: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('No license data found for this device');
        });
    });

    describe('Config Risks Endpoint - 404 Handling', () => {
        it('GET /api/firewall/config/risks/:deviceId should return 404 when device not found', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${nonExistentDeviceId}`
            );

            const response = await getRisks(request, {
                params: { deviceId: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Firewall device not found');
        });
    });

    describe('Metrics Endpoint - 404 Handling', () => {
        it('GET /api/firewall/metrics/:deviceId should return 404 when device not found', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/metrics/${nonExistentDeviceId}`
            );

            const response = await getMetrics(request, {
                params: { deviceId: nonExistentDeviceId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });
    });

    describe('Alert Acknowledgment Endpoint - 404 Handling', () => {
        it('PUT /api/firewall/alerts/:id/acknowledge should return 404 when alert not found', async () => {
            // Mock alert not found
            (db.query.firewallAlerts.findFirst as jest.Mock).mockResolvedValue(null);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/alerts/${nonExistentAlertId}/acknowledge`,
                { method: 'PUT' }
            );

            const response = await acknowledgeAlert(request, {
                params: { id: nonExistentAlertId },
            });

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Alert not found or access denied');
        });
    });

    describe('Error Message Consistency', () => {
        it('All 404 responses should include success: false', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const endpoints = [
                { handler: getDevice, params: { id: nonExistentDeviceId } },
                { handler: getPosture, params: { deviceId: nonExistentDeviceId } },
                { handler: getHealth, params: { deviceId: nonExistentDeviceId } },
                { handler: getLicenses, params: { deviceId: nonExistentDeviceId } },
                { handler: getRisks, params: { deviceId: nonExistentDeviceId } },
                { handler: getMetrics, params: { deviceId: nonExistentDeviceId } },
            ];

            for (const endpoint of endpoints) {
                const request = new NextRequest('http://localhost:3000/api/test');
                const response = await endpoint.handler(request, { params: endpoint.params });
                const data = await response.json();

                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
                expect(data.error.code).toBe('NOT_FOUND');
                expect(data.error.message).toBeDefined();
                expect(typeof data.error.message).toBe('string');
            }
        });

        it('All 404 responses should include error code and message', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${nonExistentDeviceId}`
            );

            const response = await getDevice(request, {
                params: { id: nonExistentDeviceId },
            });

            const data = await response.json();

            // Verify error structure
            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');

            // Verify error values
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBeTruthy();
            expect(data.error.message.length).toBeGreaterThan(0);
        });
    });
});
