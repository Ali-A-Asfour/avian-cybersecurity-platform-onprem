// Development mode utilities
export const isDevelopmentMode = () => {
    return process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
};

// Utility function to simulate delays in development
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Mock data for components that need it
export const mockStats = {
    alerts: {
        total: 15,
        critical: 3,
        high: 5,
        medium: 4,
        low: 3,
        open: 8,
        investigating: 4,
        resolved: 3
    },
    tickets: {
        total: 25,
        open: 12,
        in_progress: 8,
        resolved: 5
    },
    assets: {
        total: 150,
        online: 142,
        offline: 8,
        critical: 5
    }
};

export const mockPlaybooks = [
    {
        id: '1',
        name: 'Malware Response',
        description: 'Standard response procedure for malware detection',
        category: 'Incident Response',
        stepCount: 8,
        lastUpdated: '2024-12-01'
    },
    {
        id: '2',
        name: 'Phishing Investigation',
        description: 'Steps to investigate and respond to phishing attempts',
        category: 'Email Security',
        stepCount: 12,
        lastUpdated: '2024-11-28'
    },
    {
        id: '3',
        name: 'Data Breach Response',
        description: 'Comprehensive data breach response playbook',
        category: 'Incident Response',
        stepCount: 15,
        lastUpdated: '2024-11-25'
    }
];

export const mockDataSources = [
    {
        id: '1',
        name: 'CrowdStrike EDR',
        type: 'EDR',
        status: 'connected',
        lastSync: '2024-12-10T10:30:00Z',
        eventsToday: 1250
    },
    {
        id: '2',
        name: 'SonicWall Firewall',
        type: 'Firewall',
        status: 'connected',
        lastSync: '2024-12-10T10:25:00Z',
        eventsToday: 850
    },
    {
        id: '3',
        name: 'Microsoft Defender',
        type: 'Antivirus',
        status: 'warning',
        lastSync: '2024-12-10T09:45:00Z',
        eventsToday: 320
    }
];

export const mockAssets = [
    {
        id: '1',
        hostname: 'WS-001',
        type: 'Workstation',
        os: 'Windows 11',
        status: 'online',
        lastSeen: '2024-12-10T10:30:00Z',
        riskScore: 25
    },
    {
        id: '2',
        hostname: 'SRV-DC01',
        type: 'Server',
        os: 'Windows Server 2022',
        status: 'online',
        lastSeen: '2024-12-10T10:29:00Z',
        riskScore: 15
    },
    {
        id: '3',
        hostname: 'WS-002',
        type: 'Workstation',
        os: 'Windows 10',
        status: 'offline',
        lastSeen: '2024-12-09T17:30:00Z',
        riskScore: 45
    }
];