/**
 * Tests for Help Desk Queue Metrics API
 * GET /api/help-desk/queue/metrics
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { UserRole } from '@/types';

// Mock the dependencies
jest.mock('@/services/help-desk/QueueManagementService');
jest.mock('@/lib/auth-utils');

const mockQueueManagementService = require('@/services/help-desk/QueueManagementService').QueueManagementService;
const mockValidateAuth = require('@/lib/auth-utils').validateAuth;

describe('GET /api/help-desk/queue/metrics', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Set up test environment
        process.env.NODE_ENV = 'development';
        process.env.BYPASS_AUTH = 'true';
    });

    afterEach(() => {
        // Clean up
        delete process.env.BYPASS_AUTH;
    });

    it('should return queue metrics for help desk analyst', async () => {
        // Mock auth validation
        mockValidateAuth.mockResolvedValue({
            user: {
                id: 'analyst1',
                role: UserRole.IT_HELPDESK_ANALYST,
            },
            tenant: {
                id: 'tenant1',
            },
        });

        // Mock queue metrics
        const mockMetrics = {
            total_tickets: 10,
            unassigned_tickets: 3,
            assigned_tickets: 7,
            overdue_tickets: 2,
            by_severity: {
                low: 2,
                medium: 4,
                high: 3,
                critical: 1,
            },
            by_status: {
                new: 3,
                in_progress: 4,
                awaiting_response: 1,
                resolved: 2,
                closed: 0,
            },
            average_queue_time: 4.5,
        };

        mockQueueManagementService.getQueueMetrics.mockResolvedValue(mockMetrics);

        const request = new NextRequest('http://localhost/api/help-desk/queue/metrics');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockMetrics);
        expect(mockQueueManagementService.getQueueMetrics).toHaveBeenCalledWith(
            'tenant1',
            UserRole.IT_HELPDESK_ANALYST,
            'analyst1'
        );
    });

    it('should return 401 for unauthenticated requests', async () => {
        // Disable bypass auth for this test
        delete process.env.BYPASS_AUTH;

        mockValidateAuth.mockResolvedValue(null);

        const request = new NextRequest('http://localhost/api/help-desk/queue/metrics');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');

        // Restore bypass auth
        process.env.BYPASS_AUTH = 'true';
    });

    it('should return 403 for unauthorized roles', async () => {
        // Disable bypass auth for this test
        delete process.env.BYPASS_AUTH;

        mockValidateAuth.mockResolvedValue({
            user: {
                id: 'user1',
                role: UserRole.END_USER,
            },
            tenant: {
                id: 'tenant1',
            },
        });

        const request = new NextRequest('http://localhost/api/help-desk/queue/metrics');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Access denied: Only help desk users can access queue metrics');

        // Restore bypass auth
        process.env.BYPASS_AUTH = 'true';
    });
});