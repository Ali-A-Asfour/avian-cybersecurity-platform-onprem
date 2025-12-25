/**
 * Integration tests for Alert API endpoints
 * Tests the actual API behavior with mocked services
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock the services and middleware
jest.mock('@/services/alerts-incidents/AlertManager', () => ({
    AlertManager: {
        getAlerts: jest.fn(),
        getTriageQueue: jest.fn(),
        getInvestigationQueue: jest.fn(),
        createAlert: jest.fn(),
    },
}));

jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('Alert API Integration Tests', () => {
    const { AlertManager } = require('@/services/alerts-incidents/AlertManager');
    const { authMiddleware } = require('@/middleware/auth.middleware');
    const { tenantMiddleware } = require('@/middleware/tenant.middleware');

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup successful auth
        authMiddleware.mockResolvedValue({
            success: true,
            user: {
                user_id: 'user-123',
                tenant_id: 'tenant-123',
                role: 'security_analyst',
            },
        });

        // Setup successful tenant
        tenantMiddleware.mockResolvedValue({
            success: true,
            tenant: { id: 'tenant-123' },
        });
    });

    describe('GET /api/alerts-incidents/alerts', () => {
        it('should handle successful alert retrieval', async () => {
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-123',
                    status: 'open',
                    severity: 'high',
                    title: 'Test Alert',
                },
            ];

            AlertManager.getAlerts.mockResolvedValue(mockAlerts);
            AlertManager.getTriageQueue.mockResolvedValue(mockAlerts);
            AlertManager.getInvestigationQueue.mockResolvedValue([]);

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts?queue=all');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.alerts).toEqual(mockAlerts);
        });

        it('should handle authentication failure', async () => {
            authMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should handle service errors gracefully', async () => {
            AlertManager.getAlerts.mockRejectedValue(new Error('Database error'));

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('POST /api/alerts-incidents/alerts', () => {
        it('should create alert successfully', async () => {
            AlertManager.createAlert.mockResolvedValue('alert-123');

            const alertData = {
                sourceSystem: 'edr',
                sourceId: 'edr-123',
                alertType: 'malware',
                classification: 'malware',
                severity: 'high',
                title: 'Test Alert',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts', {
                method: 'POST',
                body: JSON.stringify(alertData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.alertId).toBe('alert-123');
        });

        it('should validate required fields', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts', {
                method: 'POST',
                body: JSON.stringify({}),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });
});