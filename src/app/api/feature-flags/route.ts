import { NextResponse } from 'next/server';

// Feature flags configuration
// In production, this would come from a database or external service
const featureFlags = {
    'new-dashboard': process.env.FEATURE_NEW_DASHBOARD === 'true',
    'beta-analytics': process.env.FEATURE_BETA_ANALYTICS === 'true',
    'advanced-reporting': process.env.FEATURE_ADVANCED_REPORTING === 'true',
    'ai-insights': process.env.FEATURE_AI_INSIGHTS === 'true',
    'team-collaboration': process.env.FEATURE_TEAM_COLLABORATION !== 'false', // Default true
    'mobile-app': process.env.FEATURE_MOBILE_APP === 'true',
};

export async function GET() {
    try {
        return NextResponse.json(featureFlags);
    } catch {
        console.error('Error fetching feature flags:', error);
        return NextResponse.json(
            { error: 'Failed to fetch feature flags' },
            { status: 500 }
        );
    }
}

// Admin endpoint to update feature flags (protected)
export async function POST(_request: Request) {
    try {
        // In production, add proper authentication here
        const { flag, enabled } = await request.json();

        if (!flag || typeof enabled !== 'boolean') {
            return NextResponse.json(
                { error: 'Invalid flag or enabled value' },
                { status: 400 }
            );
        }

        // In production, update database or external service
        // For now, just return success
        return NextResponse.json({
            success: true,
            message: `Feature flag '${flag}' ${enabled ? 'enabled' : 'disabled'}`
        });
    } catch {
        console.error('Error updating feature flag:', error);
        return NextResponse.json(
            { error: 'Failed to update feature flag' },
            { status: 500 }
        );
    }
}