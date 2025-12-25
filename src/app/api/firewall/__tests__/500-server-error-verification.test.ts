/**
 * Test Suite: 500 Server Error Handling Verification
 * 
 * Requirements: Task 8.6 - Return 500 for server errors
 * 
 * This test suite verifies that all firewall API endpoints properly return
 * 500 status codes with appropriate error messages when internal errors occur.
 */

import { NextRequest } from 'next/server';
import { GET as getDevice } from '../devices/[id]/route';
import { GET as getDevices } from '../devices/route';
import { GET as getPosture } from '../posture/[deviceId]/route';
import { GET as getHealth } from '../health/[deviceId]/route';
import { GET as getLicenses } from '../licenses/[deviceId]/route';
import { GET as getRisks } from '../config/risks/[deviceId]/route';
import { GET as getMetrics } from '../metrics/[deviceId]/route';
import { GET as getAlerts } from '../alerts/route';
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

describe('500 Server Error Handling - All Endpoints', () => {
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

    const testDeviceId = '770e8400-e29b-41d4-a716-446655440000';
    const testAlertId = '880e8400-e29b-41d4-a716-446655440000';

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

    describe('Device Endpoints - 500 Handling', () => {
        it('GET /api/firewall/devices/:id should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database connection failed');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${testDeviceId}`
            );

            const response = await getDevice(request, {
                params: { id: testDeviceId },
            });

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve device details');
        });

        it('GET /api/firewall/devices should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database query failed');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest('http://localhost:3000/api/firewall/devices');

            const response = await getDevices(request);

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve firewall devices');
        });
    });

    describe('Posture Endpoint - 500 Handling', () => {
        it('GET /api/firewall/posture/:deviceId should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/posture/${testDeviceId}`
            );

            const response = await getPosture(request, {
                params: { deviceId: testDeviceId },
            });

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve security posture');
        });
    });

    describe('Health Endpoint - 500 Handling', () => {
        it('GET /api/firewall/health/:deviceId should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/health/${testDeviceId}`
            );

            const response = await getHealth(request, {
                params: { deviceId: testDeviceId },
            });

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve health snapshots');
        });
    });

    describe('Licenses Endpoint - 500 Handling', () => {
        it('GET /api/firewall/licenses/:deviceId should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${testDeviceId}`
            );

            const response = await getLicenses(request, {
                params: { deviceId: testDeviceId },
            });

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve license information');
        });
    });

    describe('Config Risks Endpoint - 500 Handling', () => {
        it('GET /api/firewall/config/risks/:deviceId should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${testDeviceId}`
            );

            const response = await getRisks(request, {
                params: { deviceId: testDeviceId },
            });

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve configuration risks');
        });
    });

    describe('Metrics Endpoint - 500 Handling', () => {
        it('GET /api/firewall/metrics/:deviceId should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/metrics/${testDeviceId}`
            );

            const response = await getMetrics(request, {
                params: { deviceId: testDeviceId },
            });

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve metrics');
        });
    });

    describe('Alerts Endpoints - 500 Handling', () => {
        it('GET /api/firewall/alerts should return 500 on database error', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest('http://localhost:3000/api/firewall/alerts');

            const response = await getAlerts(request);

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve alerts');
        });

        it('PUT /api/firewall/alerts/:id/acknowledge should return 500 on database error', async () => {
            // Mock database to throw error
            (db.query.firewallAlerts.findFirst as jest.Mock).mockImplementation(() => {
                throw new Error('Database error');
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/alerts/${testAlertId}/acknowledge`,
                { method: 'PUT' }
            );

            const response = await acknowledgeAlert(request, {
                params: { id: testAlertId },
            });

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to acknowledge alert');
        });
    });

    describe('Error Message Consistency', () => {
        it('All 500 responses should include success: false', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const endpoints = [
                { handler: getDevice, params: { id: testDeviceId } },
                { handler: getPosture, params: { deviceId: testDeviceId } },
                { handler: getHealth, params: { deviceId: testDeviceId } },
                { handler: getLicenses, params: { deviceId: testDeviceId } },
                { handler: getRisks, params: { deviceId: testDeviceId } },
                { handler: getMetrics, params: { deviceId: testDeviceId } },
            ];

            for (const endpoint of endpoints) {
                const request = new NextRequest('http://localhost:3000/api/test');
                const response = await endpoint.handler(request, { params: endpoint.params });
                const data = await response.json();

                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
                expect(data.error.code).toBe('INTERNAL_ERROR');
                expect(data.error.message).toBeDefined();
                expect(typeof data.error.message).toBe('string');
            }
        });

        it('All 500 responses should include error code and message', async () => {
            // Mock database to throw error
            const mockSelect = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${testDeviceId}`
            );

            const response = await getDevice(request, {
                params: { id: testDeviceId },
            });

            const data = await response.json();

            // Verify error structure
            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');

            // Verify error values
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBeTruthy();
            expect(data.error.message.length).toBeGreaterThan(0);
        });
    });
});
