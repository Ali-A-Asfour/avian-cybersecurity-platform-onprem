import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PlaybooksTab } from '../PlaybooksTab';
import { useAuth } from '@/hooks/useAuth';

// Mock the useAuth hook
jest.mock('@/hooks/useAuth');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('PlaybooksTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock successful responses
        mockFetch.mockImplementation((url) => {
            if (url.includes('/api/alerts-incidents/playbooks/classifications')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        data: [
                            {
                                classification: 'malware',
                                primaryPlaybook: {
                                    id: '1',
                                    name: 'Malware Investigation',
                                    version: '1.0',
                                    status: 'active',
                                    purpose: 'Investigate malware alerts',
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                },
                                secondaryCount: 2,
                            },
                        ],
                    }),
                } as Response);
            }

            if (url.includes('/api/alerts-incidents/playbooks')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        data: [
                            {
                                id: '1',
                                name: 'Malware Investigation',
                                version: '1.0',
                                status: 'active',
                                purpose: 'Investigate malware alerts',
                                initialValidationSteps: ['Check file hash'],
                                sourceInvestigationSteps: ['Analyze behavior'],
                                containmentChecks: ['Isolate system'],
                                decisionGuidance: {
                                    escalateToIncident: 'If confirmed malware',
                                    resolveBenign: 'If false positive',
                                    resolveFalsePositive: 'If scanner error',
                                },
                                createdBy: 'admin',
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                        ],
                    }),
                } as Response);
            }

            return Promise.reject(new Error('Unknown URL'));
        });
    });

    describe('Role-based Access Control', () => {
        it('should show create button for super admin', async () => {
            mockUseAuth.mockReturnValue({
                user: {
                    id: '1',
                    email: 'admin@test.com',
                    name: 'Admin',
                    role: 'super_admin',
                    tenantId: 'tenant1',
                },
                loading: false,
                isAuthenticated: true,
            });

            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.getByText('Create Playbook')).toBeInTheDocument();
            });
        });

        it('should not show create button for security analyst', async () => {
            mockUseAuth.mockReturnValue({
                user: {
                    id: '1',
                    email: 'analyst@test.com',
                    name: 'Analyst',
                    role: 'security_analyst',
                    tenantId: 'tenant1',
                },
                loading: false,
                isAuthenticated: true,
            });

            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.queryByText('Create Playbook')).not.toBeInTheDocument();
            });
        });

        it('should show read-only message for security analyst', async () => {
            mockUseAuth.mockReturnValue({
                user: {
                    id: '1',
                    email: 'analyst@test.com',
                    name: 'Analyst',
                    role: 'security_analyst',
                    tenantId: 'tenant1',
                },
                loading: false,
                isAuthenticated: true,
            });

            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
            });
        });
    });

    describe('Playbook Display', () => {
        beforeEach(() => {
            mockUseAuth.mockReturnValue({
                user: {
                    id: '1',
                    email: 'admin@test.com',
                    name: 'Admin',
                    role: 'super_admin',
                    tenantId: 'tenant1',
                },
                loading: false,
                isAuthenticated: true,
            });
        });

        it('should display playbooks list', async () => {
            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.getByText('Malware Investigation')).toBeInTheDocument();
                expect(screen.getByText('v1.0')).toBeInTheDocument();
                expect(screen.getByText('active')).toBeInTheDocument();
            });
        });

        it('should display classification coverage', async () => {
            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.getByText('Classification Coverage')).toBeInTheDocument();
                expect(screen.getByText('malware')).toBeInTheDocument();
                expect(screen.getByText('Covered')).toBeInTheDocument();
            });
        });

        it('should show view button for all users', async () => {
            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.getByText('View')).toBeInTheDocument();
            });
        });

        it('should show admin actions for super admin', async () => {
            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.getByText('Edit')).toBeInTheDocument();
                expect(screen.getByText('Delete')).toBeInTheDocument();
            });
        });
    });

    describe('Status Filtering', () => {
        beforeEach(() => {
            mockUseAuth.mockReturnValue({
                user: {
                    id: '1',
                    email: 'admin@test.com',
                    name: 'Admin',
                    role: 'super_admin',
                    tenantId: 'tenant1',
                },
                loading: false,
                isAuthenticated: true,
            });
        });

        it('should filter playbooks by status', async () => {
            render(<PlaybooksTab />);

            // Wait for initial load to complete
            await waitFor(() => {
                expect(screen.getByText('Malware Investigation')).toBeInTheDocument();
            });

            const statusFilter = screen.getByLabelText('Status');

            await act(async () => {
                fireEvent.change(statusFilter, { target: { value: 'draft' } });
            });

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('status=draft'),
                    expect.any(Object)
                );
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            mockUseAuth.mockReturnValue({
                user: {
                    id: '1',
                    email: 'admin@test.com',
                    name: 'Admin',
                    role: 'super_admin',
                    tenantId: 'tenant1',
                },
                loading: false,
                isAuthenticated: true,
            });
        });

        it('should display error message when API fails', async () => {
            mockFetch.mockRejectedValue(new Error('API Error'));

            render(<PlaybooksTab />);

            await waitFor(() => {
                expect(screen.getByText('API Error')).toBeInTheDocument();
            });
        });
    });

    describe('Loading State', () => {
        it('should show loading spinner', () => {
            mockUseAuth.mockReturnValue({
                user: {
                    id: '1',
                    email: 'admin@test.com',
                    name: 'Admin',
                    role: 'super_admin',
                    tenantId: 'tenant1',
                },
                loading: false,
                isAuthenticated: true,
            });

            // Mock a slow response
            mockFetch.mockImplementation(() => new Promise(() => { }));

            render(<PlaybooksTab />);

            expect(screen.getByText('Loading playbooks...')).toBeInTheDocument();
        });
    });
});