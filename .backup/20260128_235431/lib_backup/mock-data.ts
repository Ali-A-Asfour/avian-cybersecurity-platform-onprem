// Mock data service for development when APIs aren't available
import { Alert, Ticket, UserRole } from '@/types';

// Mock alerts data - designed for end-to-end workflow testing
// Workflow: Alert (open) → Investigate → My Alerts (assigned) → Escalate/Dismiss → Tickets
export const mockAlerts: Alert[] = [
    // STEP 1: New alerts in triage queue (open status) - appear in "All Alerts" tab
    {
        id: '550e8400-e29b-41d4-a716-446655440001',
        tenant_id: 'demo-tenant',
        title: 'Suspicious Login Activity Detected',
        description: 'Multiple failed login attempts from IP 192.168.1.100 targeting admin account',
        severity: 'high' as any,
        status: 'open' as any, // Unassigned - appears in "All Alerts" triage queue
        category: 'authentication' as any,
        source: 'EDR System',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
        metadata: {
            ip_address: '192.168.1.100',
            user_account: 'admin@company.com',
            failed_attempts: 15,
            geolocation: 'Unknown (VPN detected)'
        }
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440002',
        tenant_id: 'demo-tenant',
        title: 'Malware Detection on Endpoint',
        description: 'Trojan.Win32.Generic detected on workstation WS-001 in Downloads folder',
        severity: 'critical' as any,
        status: 'open' as any, // Unassigned - appears in "All Alerts" triage queue
        category: 'malware' as any,
        source: 'Antivirus',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 30 * 60 * 1000),
        metadata: {
            hostname: 'WS-001',
            file_path: 'C:\\Users\\john\\Downloads\\suspicious.exe',
            hash: 'a1b2c3d4e5f6789012345',
            user: 'john.doe@company.com'
        }
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440003',
        tenant_id: 'demo-tenant',
        title: 'Unusual Network Traffic Pattern',
        description: 'High volume outbound traffic to suspicious IP address detected',
        severity: 'medium' as any,
        status: 'open' as any, // Unassigned - appears in "All Alerts" triage queue
        category: 'network' as any,
        source: 'Firewall',
        created_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
        metadata: {
            destination_ip: '203.0.113.45',
            bytes_transferred: '2.5GB',
            protocol: 'HTTPS',
            source_host: 'WS-002'
        }
    },
    // STEP 2: Alerts assigned to analyst (assigned status) - appear in "My Alerts" tab
    {
        id: '550e8400-e29b-41d4-a716-446655440004',
        tenant_id: 'demo-tenant',
        title: 'Phishing Email Detected',
        description: 'Suspicious email with malicious attachment sent to multiple users',
        severity: 'high' as any,
        status: 'assigned' as any, // Assigned to analyst - appears in "My Alerts" investigation queue
        category: 'phishing' as any,
        source: 'Email Security',
        created_at: new Date(Date.now() - 8 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
        metadata: {
            sender: 'noreply@suspicious-domain.com',
            recipients: ['user1@company.com', 'user2@company.com'],
            attachment: 'invoice.pdf.exe',
            subject: 'Urgent: Payment Required'
        }
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440005',
        tenant_id: 'demo-tenant',
        title: 'Privilege Escalation Attempt',
        description: 'User attempting to access admin-level resources without proper authorization',
        severity: 'critical' as any,
        status: 'assigned' as any, // Assigned to analyst - appears in "My Alerts" investigation queue
        category: 'privilege_escalation' as any,
        source: 'Active Directory',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 30 * 60 * 1000),
        metadata: {
            user: 'temp.contractor@company.com',
            attempted_resource: 'Domain Admin Group',
            method: 'PowerShell Script',
            blocked: true
        }
    },
    // STEP 3: Alert currently being investigated (investigating status)
    {
        id: '550e8400-e29b-41d4-a716-446655440006',
        tenant_id: 'demo-tenant',
        title: 'Ransomware Activity Detected',
        description: 'File encryption patterns detected on multiple workstations',
        severity: 'critical' as any,
        status: 'investigating' as any, // Currently being investigated - ready for escalation
        category: 'ransomware' as any,
        source: 'EDR System',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 15 * 60 * 1000),
        metadata: {
            affected_hosts: ['WS-003', 'WS-004', 'WS-005'],
            encryption_pattern: '.locked',
            ransom_note: 'README_DECRYPT.txt',
            initial_vector: 'WS-003'
        }
    }
];

// Mock tickets data - CLEAN SLATE: No pre-seeded helpdesk tickets
// All tickets start empty - only user-created tickets will appear
// Security incident tickets are created dynamically when alerts are escalated via the workflow
export const mockTickets: Ticket[] = [];

// Helper function to get "My Tickets" (tickets assigned to current user)
// Clean slate: No pre-seeded tickets - only user-created tickets will appear
// Security tickets are created dynamically when alerts are escalated - no mock security tickets
export const getMyTickets = () => {
    // Return empty array - only user-created tickets will appear after creation
    // Security incident tickets are created dynamically from escalated alerts
    return [];
};

// Mock API responses
export const mockApiResponse = {
    success: true,
    data: {
        alerts: mockAlerts,
        tickets: mockTickets
    }
};

// Helper function to simulate API delay
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock fetch function for development
export const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    await delay(500); // Simulate network delay

    let data: any = { success: false, error: 'Not found' };

    if (url.includes('/api/alerts-incidents/alerts')) {
        // Handle alerts API for new alerts-incidents system
        data = { success: true, data: { alerts: mockAlerts } };
    } else if (url.includes('/api/alerts')) {
        // Handle legacy alerts API
        data = { success: true, data: { alerts: mockAlerts } };
    } else if (url.includes('/api/tickets')) {
        // Handle tickets API - CLEAN SLATE: No pre-seeded helpdesk tickets
        // Only user-created tickets will appear after creation
        const query = new URL(url, 'http://localhost').searchParams;
        const myTickets = query.get('my') === 'true';
        const securityOnly = query.get('security') === 'true';

        if (securityOnly) {
            // Security tickets start empty - created only when alerts are escalated
            data = { success: true, data: { tickets: [] } };
        } else if (myTickets) {
            // Return empty array - only user-created tickets assigned to current user will appear
            data = { success: true, data: { tickets: [] } };
        } else {
            // Return empty array - clean slate for all helpdesk tickets
            data = { success: true, data: { tickets: [] } };
        }
    } else if (url.includes('/api/auth/status')) {
        data = {
            success: true,
            data: {
                user: {
                    role: UserRole.SECURITY_ANALYST,
                    id: 'demo-user',
                    email: 'demo@example.com',
                    name: 'Demo User'
                }
            }
        };
    }

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};