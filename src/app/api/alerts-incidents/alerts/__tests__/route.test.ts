/**
 * Tests for Alert API endpoints
 * Requirements: 1.1, 2.1, 4.2, 6.1, 6.2, 6.4, 6.5
 */

import { NextRequest } from 'next/server';

// Mock dependencies before importing the modules
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

jest.mock('@/services/alerts-incidents/AlertManager', () => ({
    AlertManager: {
        getAlerts: jest.fn(),
        getTriageQueue: jest.fn(),
        getInvestigationQueue: jest.fn(),
        createAlert: jest.fn(),
        assignAlert: jest.fn(),
        startInvestigation: jest.fn(),
        resolveAlert: jest.fn(),
    },
}));

jest.mock('@/services/alerts-incidents/IncidentManager', () => ({
    IncidentManager: {
        escalateAlert: jest.fn(),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
    },
}));

// Import after mocking
import { GET, POST } from '../route';
import { POST as assignPOST } from '../[id]/assign/route';
import { POST as investigatePOST } from '../[id]/investigate/route';
import { POST as resolvePOST } from '../[id]/resolve/route';
import { POST as escalatePOST } from '../[id]/escalate/route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager } from '@/services/alerts-incidents/AlertManager';
import { IncidentManager } from '@/services/alerts-incidents/IncidentManager';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockAlertManager = AlertManager as jest.Mocked<typeof AlertManager>;
const mockIncidentManager = IncidentManager as jest.Mocked<typeof IncidentManager>;

describe('Alert API Endpoints', () => {
    const mockUser = {
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'security_analyst' as const,
        iat: 0,
        exp: 0,
    };

    const mockTenant = { id: 'tenant-123' };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default successful auth and tenant middleware responses
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: mockUser,
        });

        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });
    });

    describe('GET /api/alerts-incidents/alerts', () => {
        it('should return all alerts (triage queue) when queue=all', async () => {
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-123',
                    status: 'open',
                    severity: 'high',
                    title: 'Test Alert 1',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-123',
                    status: 'open',
                    severity: 'medium',
                    title: 'Test Alert 2',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ];

            mockAlertManager.getAlerts.mockResolvedValue(mockAlerts as any);
            mockAlertManager.getTriageQueue.mockResolvedValue(mockAlerts as any);
            mockAlertManager.getInvestigationQueue.mockResolvedValue([]);

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts?queue=all&page=1&limit=50');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.alerts).toEqual(mockAlerts);
            expect(data.data.metadata.queue).toBe('all');
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-123',
                status: 'open',
                limit: 50,
                offset: 0,
            });
        });

        it('should return my alerts (investigation queue) when queue=my', async () => {
            const mockAlerts = [
                {
                    id: 'alert-3',
                    tenantId: 'tenant-123',
                    status: 'assigned',
                    assignedTo: 'user-123',
                    severity: 'critical',
                    title: 'My Alert 1',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ];

            mockAlertManager.getAlerts.mockResolvedValue(mockAlerts as any);
            mockAlertManager.getTriageQueue.mockResolvedValue([]);
            mockAlertManager.getInvestigationQueue.mockResolvedValue(mockAlerts as any);

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts?queue=my&page=1&limit=50');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.alerts).toEqual(mockAlerts);
            expect(data.data.metadata.queue).toBe('my');
            expect(mockAlertManager.getAlerts).toHaveBeenCalledWith({
                tenantId: 'tenant-123',
                assignedTo: 'user-123',
                status: ['assigned', 'investigating'],
                limit: 50,
                offset: 0,
            });
        });

        it('should handle authentication failure', async () => {
            mockAuthMiddleware.mockResolvedValue({
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

        it('should handle tenant validation failure', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { code: 'TENANT_ERROR', message: 'Invalid tenant' },
            });

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('POST /api/alerts-incidents/alerts', () => {
        it('should create a new alert successfully', async () => {
            const alertData = {
                sourceSystem: 'edr',
                sourceId: 'edr-alert-123',
                alertType: 'malware_detection',
                classification: 'malware',
                severity: 'high',
                title: 'Malware Detected',
                description: 'Suspicious file detected',
                metadata: { threatName: 'Trojan.Win32.Test' },
                detectedAt: '2024-01-01T00:00:00Z',
            };

            mockAlertManager.createAlert.mockResolvedValue('alert-123');

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
            expect(mockAlertManager.createAlert).toHaveBeenCalledWith(
                'tenant-123',
                expect.objectContaining({
                    sourceSystem: 'edr',
                    sourceId: 'edr-alert-123',
                    severity: 'high',
                    title: 'Malware Detected',
                })
            );
        });

        it('should validate required fields', async () => {
            const incompleteData = {
                sourceSystem: 'edr',
                // Missing required fields
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts', {
                method: 'POST',
                body: JSON.stringify(incompleteData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Missing required fields');
        });

        it('should validate enum values', async () => {
            const invalidData = {
                sourceSystem: 'invalid_source',
                sourceId: 'test-123',
                alertType: 'test',
                classification: 'test',
                severity: 'invalid_severity',
                title: 'Test Alert',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts', {
                method: 'POST',
                body: JSON.stringify(invalidData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/alerts-incidents/alerts/[id]/assign', () => {
        it('should assign alert successfully', async () => {
            mockAlertManager.assignAlert.mockResolvedValue(undefined);

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/alert-123/assign', {
                method: 'POST',
            });

            const response = await assignPOST(request, { params: { id: 'alert-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.alertId).toBe('alert-123');
            expect(data.data.assignedTo).toBe('user-123');
            expect(mockAlertManager.assignAlert).toHaveBeenCalledWith({
                alertId: 'alert-123',
                assignedTo: 'user-123',
                tenantId: 'tenant-123',
            });
        });

        it('should handle invalid alert ID format', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/invalid-id/assign', {
                method: 'POST',
            });

            const response = await assignPOST(request, { params: { id: 'invalid-id' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid alert ID format');
        });

        it('should handle assignment conflicts', async () => {
            mockAlertManager.assignAlert.mockRejectedValue(new Error('Alert not found, already assigned, or not in open status'));

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/assign', {
                method: 'POST',
            });

            const response = await assignPOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ASSIGNMENT_FAILED');
        });
    });

    describe('POST /api/alerts-incidents/alerts/[id]/investigate', () => {
        it('should start investigation successfully', async () => {
            mockAlertManager.startInvestigation.mockResolvedValue(undefined);

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/investigate', {
                method: 'POST',
            });

            const response = await investigatePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.status).toBe('investigating');
            expect(mockAlertManager.startInvestigation).toHaveBeenCalledWith(
                '550e8400-e29b-41d4-a716-446655440000',
                'tenant-123',
                'user-123'
            );
        });

        it('should handle investigation failures', async () => {
            mockAlertManager.startInvestigation.mockRejectedValue(new Error('Alert not found, not assigned to user, or not in assigned status'));

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/investigate', {
                method: 'POST',
            });

            const response = await investigatePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVESTIGATION_FAILED');
        });
    });

    describe('POST /api/alerts-incidents/alerts/[id]/resolve', () => {
        it('should resolve alert as benign successfully', async () => {
            mockAlertManager.resolveAlert.mockResolvedValue(undefined);

            const resolveData = {
                outcome: 'benign',
                notes: 'False positive - legitimate software behavior',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.outcome).toBe('benign');
            expect(data.data.status).toBe('closed_benign');
            expect(mockAlertManager.resolveAlert).toHaveBeenCalledWith({
                alertId: '550e8400-e29b-41d4-a716-446655440000',
                tenantId: 'tenant-123',
                outcome: 'benign',
                notes: 'False positive - legitimate software behavior',
            });
        });

        it('should resolve alert as false positive successfully', async () => {
            mockAlertManager.resolveAlert.mockResolvedValue(undefined);

            const resolveData = {
                outcome: 'false_positive',
                notes: 'Detection rule needs tuning',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.outcome).toBe('false_positive');
            expect(data.data.status).toBe('closed_false_positive');
        });

        it('should require mandatory notes', async () => {
            const resolveData = {
                outcome: 'benign',
                // Missing notes
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Analyst notes are required');
        });

        it('should validate outcome values', async () => {
            const resolveData = {
                outcome: 'invalid_outcome',
                notes: 'Test notes',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid outcome');
        });
    });

    describe('POST /api/alerts-incidents/alerts/[id]/escalate', () => {
        it('should escalate alert to incident successfully', async () => {
            mockIncidentManager.escalateAlert.mockResolvedValue('incident-123');

            const escalateData = {
                incidentTitle: 'Critical Security Incident',
                incidentDescription: 'Requires immediate attention',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/escalate', {
                method: 'POST',
                body: JSON.stringify(escalateData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await escalatePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.incidentId).toBe('incident-123');
            expect(data.data.alertStatus).toBe('escalated');
            expect(mockIncidentManager.escalateAlert).toHaveBeenCalledWith({
                alertId: '550e8400-e29b-41d4-a716-446655440000',
                tenantId: 'tenant-123',
                incidentTitle: 'Critical Security Incident',
                incidentDescription: 'Requires immediate attention',
            });
        });

        it('should escalate alert without optional fields', async () => {
            mockIncidentManager.escalateAlert.mockResolvedValue('incident-456');

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/escalate', {
                method: 'POST',
                body: JSON.stringify({}),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await escalatePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.incidentId).toBe('incident-456');
            expect(mockIncidentManager.escalateAlert).toHaveBeenCalledWith({
                alertId: '550e8400-e29b-41d4-a716-446655440000',
                tenantId: 'tenant-123',
                incidentTitle: undefined,
                incidentDescription: undefined,
            });
        });

        it('should handle escalation failures', async () => {
            mockIncidentManager.escalateAlert.mockRejectedValue(new Error('Alert must be assigned before escalation'));

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/escalate', {
                method: 'POST',
                body: JSON.stringify({}),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await escalatePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ESCALATION_FAILED');
        });

        it('should validate field types', async () => {
            const invalidData = {
                incidentTitle: 123, // Should be string
                incidentDescription: true, // Should be string
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/escalate', {
                method: 'POST',
                body: JSON.stringify(invalidData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await escalatePOST(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });
});