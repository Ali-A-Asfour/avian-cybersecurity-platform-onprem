import { NextResponse } from 'next/server';

export async function GET() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));

    const integrationsData = {
        integrations: [
            {
                serviceName: 'microsoft',
                status: 'healthy' as const,
                lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
            },
            {
                serviceName: 'sonicwall',
                status: 'healthy' as const,
                lastSync: new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes ago
            },
            {
                serviceName: 'edr-antivirus',
                status: 'warning' as const,
                lastSync: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
            },
            {
                serviceName: 'avian-agents',
                status: 'healthy' as const,
                lastSync: new Date(Date.now() - 1 * 60 * 1000).toISOString() // 1 minute ago
            }
        ],
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(integrationsData);
}