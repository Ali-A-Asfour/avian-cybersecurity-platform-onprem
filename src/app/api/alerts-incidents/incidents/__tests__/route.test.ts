/**
 * Tests for Incident API endpoints
 * Requirements: 7.1, 8.1, 8.2, 8.4
 */

import { NextRequest } from 'next/server';
import { UserRole } from '@/types';

// Mock dependencies before importing the modules
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

jest.mock('@/services/alerts-incidents/IncidentManager', () => ({
    IncidentManager: {
        getMyIncidents: jest.fn(),
        getAllIncidents: jest.fn(),
        getIncidentQueueSummary: jest.fn(),
        startWork: jest.fn(),
        resolveIncident: jest.fn(),
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
import { GET } from '../route';
import { POST as startWorkPOST } from '../[id]/start-work/route';
import { POST as resolvePOST } from '../[id]/resolve/route';
import { POST as dismissPOST } from '../[id]/dismiss/route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { IncidentManager } from '@/services/alerts-incidents/IncidentManager';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockIncidentManager = IncidentManager as jest.Mocked<typeof IncidentManager>;

describe('Incident API Endpoints', () => {
    const mockUser = {
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: UserRole.SECURITY_ANALYST,
        iat: 0,
        exp: 0,
    };

    const mockTenant = { id: 'tenant-123' };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();

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

    describe('GET /api/alerts-incidents/incidents', () => {
        it('should return my incidents when queue=my', async () => {
            const mockIncidents = [
                {
                    id: 'incident-1',
                    tenantId: 'tenant-123',
                    ownerId: 'user-123',
                    status: 'open',
                    severity: 'high',
                    title: 'Security Incident 1',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    id: 'incident-2',
                    tenantId: 'tenant-123',
                    ownerId: 'user-123',
                    status: 'in_progress',
                    severity: 'critical',
                    title: 'Security Incident 2',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ];

            const mockQueueSummary = {
                incidents: mockIncidents,
                total: 2,
                openCount: 1,
                inProgressCount: 1,
            };

            mockIncidentManager.getMyIncidents.mockResolvedValue(mockIncidents as any);
            mockIncidentManager.getIncidentQueueSummary.mockResolvedValue(mockQueueSummary as any);

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?queue=my&page=1&limit=50');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidents).toEqual(mockIncidents);
            expect(data.data.metadata.queue).toBe('my');
            expect(data.data.metadata.readOnly).toBe(false);
            expect(mockIncidentManager.getMyIncidents).toHaveBeenCalledWith(
                'tenant-123',
                'user-123',
                50,
                0
            );
        });

        it('should return all incidents when queue=all (read-only)', async () => {
            const mockIncidents = [
                {
                    id: 'incident-1',
                    tenantId: 'tenant-123',
                    ownerId: 'user-123',
                    status: 'resolved',
                    severity: 'medium',
                    title: 'Resolved Incident',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    id: 'incident-2',
                    tenantId: 'tenant-123',
                    ownerId: 'user-456',
                    status: 'open',
                    severity: 'high',
                    title: 'Other User Incident',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ];

            const mockQueueSummary = {
                incidents: mockIncidents,
                total: 2,
                openCount: 1,
                inProgressCount: 0,
            };

            mockIncidentManager.getAllIncidents.mockResolvedValue(mockIncidents as any);
            mockIncidentManager.getIncidentQueueSummary.mockResolvedValue(mockQueueSummary as any);

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?queue=all&page=1&limit=50');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidents).toEqual(mockIncidents);
            expect(data.data.metadata.queue).toBe('all');
            expect(data.data.metadata.readOnly).toBe(true); // All Incidents view is read-only
            expect(mockIncidentManager.getAllIncidents).toHaveBeenCalledWith(
                'tenant-123',
                50,
                0
            );
        });

        it('should handle status filtering', async () => {
            const mockIncidents = [
                {
                    id: 'incident-1',
                    tenantId: 'tenant-123',
                    ownerId: 'user-123',
                    status: 'open',
                    severity: 'high',
                    title: 'Open Incident',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ];

            const mockQueueSummary = {
                incidents: mockIncidents,
                total: 1,
                openCount: 1,
                inProgressCount: 0,
            };

            mockIncidentManager.getMyIncidents.mockResolvedValue(mockIncidents as any);
            mockIncidentManager.getIncidentQueueSummary.mockResolvedValue(mockQueueSummary as any);

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?queue=my&status=open&status=in_progress');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidents).toEqual(mockIncidents);
        });

        it('should handle severity filtering', async () => {
            const mockIncidents = [
                {
                    id: 'incident-1',
                    tenantId: 'tenant-123',
                    ownerId: 'user-123',
                    status: 'open',
                    severity: 'critical',
                    title: 'Critical Incident',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ];

            const mockQueueSummary = {
                incidents: mockIncidents,
                total: 1,
                openCount: 1,
                inProgressCount: 0,
            };

            mockIncidentManager.getMyIncidents.mockResolvedValue(mockIncidents as any);
            mockIncidentManager.getIncidentQueueSummary.mockResolvedValue(mockQueueSummary as any);

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?queue=my&severity=critical&severity=high');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidents).toEqual(mockIncidents);
        });

        it('should handle date range filtering', async () => {
            const mockIncidents = [];
            const mockQueueSummary = {
                incidents: mockIncidents,
                total: 0,
                openCount: 0,
                inProgressCount: 0,
            };

            mockIncidentManager.getMyIncidents.mockResolvedValue(mockIncidents as any);
            mockIncidentManager.getIncidentQueueSummary.mockResolvedValue(mockQueueSummary as any);

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?queue=my&startDate=2024-01-01&endDate=2024-01-31');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidents).toEqual(mockIncidents);
        });

        it('should handle authentication failure', async () => {
            mockAuthMiddleware.mockResolvedValueOnce({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should handle tenant validation failure', async () => {
            mockTenantMiddleware.mockResolvedValueOnce({
                success: false,
                error: { code: 'TENANT_ERROR', message: 'Invalid tenant' },
            });

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should handle internal server errors', async () => {
            mockIncidentManager.getMyIncidents.mockRejectedValueOnce(new Error('Database connection failed'));

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?queue=my');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('POST /api/alerts-incidents/incidents/[id]/start-work', () => {
        it('should start work on incident successfully', async () => {
            mockIncidentManager.startWork.mockResolvedValue(undefined);

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/start-work', {
                method: 'POST',
            });

            const response = await startWorkPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidentId).toBe('incident-123');
            expect(data.data.message).toBe('Work started on incident successfully');
            expect(mockIncidentManager.startWork).toHaveBeenCalledWith({
                incidentId: 'incident-123',
                tenantId: 'tenant-123',
                ownerId: 'user-123',
            });
        });

        it('should handle missing incident ID', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents//start-work', {
                method: 'POST',
            });

            const response = await startWorkPOST(request, { params: { id: '' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Incident ID is required');
        });

        it('should handle incident not found', async () => {
            mockIncidentManager.startWork.mockRejectedValueOnce(new Error('Incident not found or not owned by user'));

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/start-work', {
                method: 'POST',
            });

            const response = await startWorkPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Incident not found or not owned by user');
        });

        it('should handle invalid status for starting work', async () => {
            mockIncidentManager.startWork.mockRejectedValueOnce(new Error('Incident is not in startable status'));

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/start-work', {
                method: 'POST',
            });

            const response = await startWorkPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_STATUS');
            expect(data.error.message).toBe('Incident is not in a status that allows starting work');
        });

        it('should handle authentication failure', async () => {
            mockAuthMiddleware.mockResolvedValueOnce({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/start-work', {
                method: 'POST',
            });

            const response = await startWorkPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('POST /api/alerts-incidents/incidents/[id]/resolve', () => {
        it('should resolve incident with summary successfully', async () => {
            mockIncidentManager.resolveIncident.mockResolvedValue(undefined);

            const resolveData = {
                summary: 'Incident resolved after thorough investigation. Root cause identified and mitigated.',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidentId).toBe('incident-123');
            expect(data.data.outcome).toBe('resolved');
            expect(data.data.message).toBe('Incident resolved successfully');
            expect(mockIncidentManager.resolveIncident).toHaveBeenCalledWith({
                incidentId: 'incident-123',
                tenantId: 'tenant-123',
                ownerId: 'user-123',
                outcome: 'resolved',
                summary: 'Incident resolved after thorough investigation. Root cause identified and mitigated.',
            });
        });

        it('should require summary for resolution', async () => {
            const resolveData = {
                // Missing summary
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Summary is required when resolving an incident');
        });

        it('should reject empty summary', async () => {
            const resolveData = {
                summary: '   ', // Only whitespace
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Summary is required when resolving an incident');
        });

        it('should handle incident not found', async () => {
            mockIncidentManager.resolveIncident.mockRejectedValueOnce(new Error('Incident not found or not owned by user'));

            const resolveData = {
                summary: 'Test summary',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle invalid status for resolution', async () => {
            mockIncidentManager.resolveIncident.mockRejectedValueOnce(new Error('Incident is not in resolvable status'));

            const resolveData = {
                summary: 'Test summary',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/resolve', {
                method: 'POST',
                body: JSON.stringify(resolveData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await resolvePOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_STATUS');
        });
    });

    describe('POST /api/alerts-incidents/incidents/[id]/dismiss', () => {
        it('should dismiss incident with justification successfully', async () => {
            mockIncidentManager.resolveIncident.mockResolvedValue(undefined);

            const dismissData = {
                justification: 'False positive - alert triggered by legitimate administrative activity.',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/dismiss', {
                method: 'POST',
                body: JSON.stringify(dismissData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await dismissPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.incidentId).toBe('incident-123');
            expect(data.data.outcome).toBe('dismissed');
            expect(data.data.message).toBe('Incident dismissed successfully');
            expect(mockIncidentManager.resolveIncident).toHaveBeenCalledWith({
                incidentId: 'incident-123',
                tenantId: 'tenant-123',
                ownerId: 'user-123',
                outcome: 'dismissed',
                justification: 'False positive - alert triggered by legitimate administrative activity.',
            });
        });

        it('should require justification for dismissal', async () => {
            const dismissData = {
                // Missing justification
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/dismiss', {
                method: 'POST',
                body: JSON.stringify(dismissData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await dismissPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Justification is required when dismissing an incident');
        });

        it('should reject empty justification', async () => {
            const dismissData = {
                justification: '   ', // Only whitespace
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/dismiss', {
                method: 'POST',
                body: JSON.stringify(dismissData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await dismissPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Justification is required when dismissing an incident');
        });

        it('should handle incident not found', async () => {
            mockIncidentManager.resolveIncident.mockRejectedValueOnce(new Error('Incident not found or not owned by user'));

            const dismissData = {
                justification: 'Test justification',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/dismiss', {
                method: 'POST',
                body: JSON.stringify(dismissData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await dismissPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle validation errors from IncidentManager', async () => {
            mockIncidentManager.resolveIncident.mockRejectedValueOnce(new Error('Justification is required when dismissing an incident'));

            const dismissData = {
                justification: 'Test justification',
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents/incident-123/dismiss', {
                method: 'POST',
                body: JSON.stringify(dismissData),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await dismissPOST(request, { params: { id: 'incident-123' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });
});