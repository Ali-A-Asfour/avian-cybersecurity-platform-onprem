import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { PlaybookManager } from '@/services/alerts-incidents/PlaybookManager';

// Mock the PlaybookManager
jest.mock('@/services/alerts-incidents/PlaybookManager');
const mockPlaybookManager = PlaybookManager as jest.Mocked<typeof PlaybookManager>;

// Mock logger
jest.mock('@/lib/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('/api/alerts-incidents/playbooks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET', () => {
        it('should return playbooks successfully', async () => {
            const mockPlaybooks = [
                {
                    id: '1',
                    name: 'Test Playbook',
                    version: '1.0',
                    status: 'active',
                    purpose: 'Test purpose',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            mockPlaybookManager.getPlaybooks.mockResolvedValue(mockPlaybooks as any);

            const request = new NextRequest('http://localhost/api/alerts-incidents/playbooks');
            request.headers.set('x-user', JSON.stringify({
                id: '1',
                role: 'super_admin',
                tenantId: 'tenant1',
            }));

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPlaybooks);
            expect(mockPlaybookManager.getPlaybooks).toHaveBeenCalledWith({});
        });

        it('should return 401 when no user header', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/playbooks');

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Authentication required');
        });

        it('should handle filters correctly', async () => {
            mockPlaybookManager.getPlaybooks.mockResolvedValue([]);

            const request = new NextRequest('http://localhost/api/alerts-incidents/playbooks?status=active&limit=10');
            request.headers.set('x-user', JSON.stringify({
                id: '1',
                role: 'super_admin',
                tenantId: 'tenant1',
            }));

            await GET(request);

            expect(mockPlaybookManager.getPlaybooks).toHaveBeenCalledWith({
                status: 'active',
                classification: undefined,
                createdBy: undefined,
                limit: 10,
                offset: undefined,
            });
        });
    });

    describe('POST', () => {
        it('should create playbook successfully for super admin', async () => {
            const mockPlaybookId = 'new-playbook-id';
            mockPlaybookManager.createPlaybook.mockResolvedValue(mockPlaybookId);

            const requestBody = {
                playbook: {
                    name: 'New Playbook',
                    version: '1.0',
                    status: 'draft',
                    purpose: 'Test purpose',
                    decisionGuidance: {
                        escalateToIncident: 'Escalate if...',
                        resolveBenign: 'Resolve if...',
                        resolveFalsePositive: 'False positive if...',
                    },
                },
                classifications: [
                    { classification: 'malware', isPrimary: true },
                ],
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/playbooks', {
                method: 'POST',
                body: JSON.stringify(requestBody),
            });
            request.headers.set('x-user', JSON.stringify({
                id: '1',
                role: 'super_admin',
                tenantId: 'tenant1',
            }));

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.id).toBe(mockPlaybookId);
            expect(mockPlaybookManager.createPlaybook).toHaveBeenCalledWith(
                { ...requestBody.playbook, createdBy: '1' },
                requestBody.classifications,
                'super_admin'
            );
        });

        it('should return 403 for security analyst', async () => {
            const requestBody = {
                playbook: {
                    name: 'New Playbook',
                    version: '1.0',
                    purpose: 'Test purpose',
                    decisionGuidance: {},
                },
                classifications: [],
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/playbooks', {
                method: 'POST',
                body: JSON.stringify(requestBody),
            });
            request.headers.set('x-user', JSON.stringify({
                id: '1',
                role: 'security_analyst',
                tenantId: 'tenant1',
            }));

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toContain('Insufficient permissions');
        });

        it('should return 400 for missing required fields', async () => {
            const requestBody = {
                playbook: null,
                classifications: null,
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/playbooks', {
                method: 'POST',
                body: JSON.stringify(requestBody),
            });
            request.headers.set('x-user', JSON.stringify({
                id: '1',
                role: 'super_admin',
                tenantId: 'tenant1',
            }));

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('required');
        });

        it('should handle PlaybookManager errors correctly', async () => {
            mockPlaybookManager.createPlaybook.mockRejectedValue(
                new Error('Playbook with name "Test" and version "1.0" already exists')
            );

            const requestBody = {
                playbook: {
                    name: 'Test Playbook',
                    version: '1.0',
                    purpose: 'Test purpose',
                    decisionGuidance: {},
                },
                classifications: [{ classification: 'test', isPrimary: true }],
            };

            const request = new NextRequest('http://localhost/api/alerts-incidents/playbooks', {
                method: 'POST',
                body: JSON.stringify(requestBody),
            });
            request.headers.set('x-user', JSON.stringify({
                id: '1',
                role: 'super_admin',
                tenantId: 'tenant1',
            }));

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.error).toContain('already exists');
        });
    });
});