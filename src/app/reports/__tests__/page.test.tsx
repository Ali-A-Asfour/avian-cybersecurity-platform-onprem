/**
 * Tests for Reports Page
 * 
 * Tests role-based access control and navigation functionality
 * for the reports module (Task 8.1).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ReportsPage from '../page';
import { useAuth } from '@/hooks/useAuth';

// Mock the hooks
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({
    useAuth: jest.fn(),
}));

// Mock the child components
jest.mock('@/components/reports/ReportsNavigation', () => ({
    ReportsNavigation: ({ currentReportType, onReportTypeChange }: any) => (
        <div data-testid="reports-navigation">
            <span>Current: {currentReportType}</span>
            <button onClick={() => onReportTypeChange?.('monthly')}>Change to Monthly</button>
        </div>
    ),
}));

jest.mock('@/components/reports/ReportPreview', () => ({
    ReportPreview: () => <div data-testid="report-preview">Report Preview</div>,
}));

jest.mock('@/components/reports/PDFExportInterface', () => ({
    PDFExportInterface: () => <div data-testid="pdf-export">Export PDF</div>,
}));

jest.mock('@/components/layout/ClientLayout', () => ({
    ClientLayout: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="client-layout">{children}</div>
    ),
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('ReportsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseRouter.mockReturnValue({
            push: mockPush,
        } as any);
    });

    it('shows loading state while authentication is loading', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            loading: true,
            isAuthenticated: false,
        });

        render(<ReportsPage />);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('allows access for super admin users', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'super_admin', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(screen.getByText('Executive Security Reports')).toBeInTheDocument();
            expect(screen.getByTestId('reports-navigation')).toBeInTheDocument();
        });
    });

    it('allows access for security analyst users', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '2', email: 'analyst@test.com', name: 'Analyst', role: 'security_analyst', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(screen.getByText('Executive Security Reports')).toBeInTheDocument();
            expect(screen.getByTestId('reports-navigation')).toBeInTheDocument();
        });
    });

    it('redirects unauthorized users to dashboard', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '3', email: 'user@test.com', name: 'User', role: 'user', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('shows access denied for unauthenticated users', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            loading: false,
            isAuthenticated: false,
        });

        render(<ReportsPage />);

        expect(screen.getByText('Access Restricted')).toBeInTheDocument();
        expect(screen.getByText(/Executive Security Reports are available to authorized personnel only/)).toBeInTheDocument();
    });

    it('redirects tenant admin users to dashboard', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '4', email: 'tenant@test.com', name: 'Tenant Admin', role: 'tenant_admin', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('redirects IT helpdesk analyst users to dashboard', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '5', email: 'helpdesk@test.com', name: 'IT Analyst', role: 'it_helpdesk_analyst', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('redirects regular users to dashboard', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '6', email: 'user@test.com', name: 'Regular User', role: 'user', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('renders all main components when user has access', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'super_admin', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(screen.getByText('Executive Security Reports')).toBeInTheDocument();
            expect(screen.getByText('Board-ready security performance reports showcasing business value and risk reduction')).toBeInTheDocument();
            expect(screen.getByTestId('reports-navigation')).toBeInTheDocument();
            expect(screen.getByText('Export PDF')).toBeInTheDocument();
            // Report preview is only shown when a report is generated, not by default
            expect(screen.getByText('Ready to Create Executive Report')).toBeInTheDocument();
        });
    });

    it('starts with weekly report type by default', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'super_admin', tenantId: 'tenant1' },
            loading: false,
            isAuthenticated: true,
        });

        render(<ReportsPage />);

        await waitFor(() => {
            expect(screen.getByText('Current: weekly')).toBeInTheDocument();
        });
    });
});