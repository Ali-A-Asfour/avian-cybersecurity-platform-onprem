/**
 * Test Suite: 401 Authentication Verification for Firewall API
 * 
 * Requirements: 15.10 - API Error Handling
 * - Return 401 for unauthenticated requests
 * - Verify all firewall API endpoints enforce authentication
 * 
 * This test suite verifies that all firewall API endpoints return 401
 * when accessed without valid authentication credentials.
 */

import { NextRequest } from 'next/server';
import { GET as getDevices, POST as postDevices } from '../devices/route';
import { GET as getDevice, PUT as putDevice, DELETE as deleteDevice } from '../devices/[id]/route';
import { POST as uploadConfig } from '../config/upload/route';
import { GET as getConfigRisks } from '../config/risks/[deviceId]/route';
import { GET as getPosture } from '../posture/[deviceId]/route';
import { GET as getHealth } from '../health/[deviceId]/route';
import { GET as getLicenses } from '../licenses/[deviceId]/route';
import { GET as getAlerts } from '../alerts/route';
import { PUT as acknowledgeAlert } from '../alerts/[id]/acknowledge/route';
import { GET as getMetrics } from '../metrics/[deviceId]/route';

// Mock the auth middleware to simulate unauthenticated requests
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn().mockResolvedValue({
        success: false,
        error: 'Authentication required',
        user: null,
    }),
}));

// Mock the database
jest.mock('@/lib/database', () => ({
    db: {},
}));

describe('Firewall API - 401 Authentication Verification', () => {
    const mockRequest = (url: string, method: string = 'GET', body?: any) => {
        return new NextRequest(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    };

    describe('Device Management Endpoints', () => {
        it('POST /api/firewall/devices should return 401 without authentication', async () => {
            const request = mockRequest('http://localhost:3000/api/firewall/devices', 'POST', {
                managementIp: '192.168.1.1',
                apiUsername: 'admin',
                apiPassword: 'password',
            });

            const response = await postDevices(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('GET /api/firewall/devices should return 401 without authentication', async () => {
            const request = mockRequest('http://localhost:3000/api/firewall/devices');

            const response = await getDevices(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('GET /api/firewall/devices/:id should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(`http://localhost:3000/api/firewall/devices/${deviceId}`);

            const response = await getDevice(request, { params: { id: deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('PUT /api/firewall/devices/:id should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(
                `http://localhost:3000/api/firewall/devices/${deviceId}`,
                'PUT',
                { model: 'TZ400' }
            );

            const response = await putDevice(request, { params: { id: deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('DELETE /api/firewall/devices/:id should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(
                `http://localhost:3000/api/firewall/devices/${deviceId}`,
                'DELETE'
            );

            const response = await deleteDevice(request, { params: { id: deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });
    });

    describe('Configuration Endpoints', () => {
        it('POST /api/firewall/config/upload should return 401 without authentication', async () => {
            const request = mockRequest('http://localhost:3000/api/firewall/config/upload', 'POST', {
                deviceId: '123e4567-e89b-12d3-a456-426614174000',
                configText: 'config content',
            });

            const response = await uploadConfig(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('GET /api/firewall/config/risks/:deviceId should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(`http://localhost:3000/api/firewall/config/risks/${deviceId}`);

            const response = await getConfigRisks(request, { params: { deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });
    });

    describe('Posture and Health Endpoints', () => {
        it('GET /api/firewall/posture/:deviceId should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(`http://localhost:3000/api/firewall/posture/${deviceId}`);

            const response = await getPosture(request, { params: { deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('GET /api/firewall/health/:deviceId should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(`http://localhost:3000/api/firewall/health/${deviceId}`);

            const response = await getHealth(request, { params: { deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('GET /api/firewall/licenses/:deviceId should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(`http://localhost:3000/api/firewall/licenses/${deviceId}`);

            const response = await getLicenses(request, { params: { deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });
    });

    describe('Alert Endpoints', () => {
        it('GET /api/firewall/alerts should return 401 without authentication', async () => {
            const request = mockRequest('http://localhost:3000/api/firewall/alerts');

            const response = await getAlerts(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });

        it('PUT /api/firewall/alerts/:id/acknowledge should return 401 without authentication', async () => {
            const alertId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(
                `http://localhost:3000/api/firewall/alerts/${alertId}/acknowledge`,
                'PUT'
            );

            const response = await acknowledgeAlert(request, { params: { id: alertId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });
    });

    describe('Metrics Endpoints', () => {
        it('GET /api/firewall/metrics/:deviceId should return 401 without authentication', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const request = mockRequest(`http://localhost:3000/api/firewall/metrics/${deviceId}`);

            const response = await getMetrics(request, { params: { deviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toContain('Authentication required');
        });
    });

    describe('Authentication Error Response Format', () => {
        it('should return consistent error format across all endpoints', async () => {
            const deviceId = '123e4567-e89b-12d3-a456-426614174000';
            const endpoints = [
                { handler: getDevices, request: mockRequest('http://localhost:3000/api/firewall/devices'), params: undefined },
                { handler: getDevice, request: mockRequest(`http://localhost:3000/api/firewall/devices/${deviceId}`), params: { params: { id: deviceId } } },
                { handler: getPosture, request: mockRequest(`http://localhost:3000/api/firewall/posture/${deviceId}`), params: { params: { deviceId } } },
                { handler: getAlerts, request: mockRequest('http://localhost:3000/api/firewall/alerts'), params: undefined },
            ];

            for (const endpoint of endpoints) {
                const response = endpoint.params
                    ? await endpoint.handler(endpoint.request, endpoint.params as any)
                    : await endpoint.handler(endpoint.request);
                const data = await response.json();

                // Verify consistent error structure
                expect(response.status).toBe(401);
                expect(data).toHaveProperty('success');
                expect(data.success).toBe(false);
                expect(data).toHaveProperty('error');
                expect(data.error).toHaveProperty('code');
                expect(data.error).toHaveProperty('message');
                expect(data.error.code).toBe('UNAUTHORIZED');
            }
        });
    });
});
