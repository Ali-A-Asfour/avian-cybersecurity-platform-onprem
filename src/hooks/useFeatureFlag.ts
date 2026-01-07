import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

interface FeatureFlags {
    [key: string]: boolean;
}

// Feature flag configuration
const defaultFlags: FeatureFlags = {
    'new-dashboard': false,
    'beta-analytics': false,
    'advanced-reporting': false,
    'ai-insights': false,
    'team-collaboration': true,
    'mobile-app': false,
};

export function useFeatureFlag(flagName: string): boolean {
    const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch feature flags from API
        const fetchFlags = async () => {
            try {
                const response = await api.get('/api/feature-flags');
                if (response.ok) {
                    const serverFlags = await response.json();
                    setFlags({ ...defaultFlags, ...serverFlags });
                }
            } catch (error) {
                console.warn('Failed to fetch feature flags, using defaults:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFlags();
    }, []);

    // Return default value while loading
    if (loading) {
        return defaultFlags[flagName] ?? false;
    }

    return flags[flagName] ?? false;
}

export function useFeatureFlags(): { flags: FeatureFlags; loading: boolean } {
    const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFlags = async () => {
            try {
                const response = await api.get('/api/feature-flags');
                if (response.ok) {
                    const serverFlags = await response.json();
                    setFlags({ ...defaultFlags, ...serverFlags });
                }
            } catch (error) {
                console.warn('Failed to fetch feature flags, using defaults:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFlags();
    }, []);

    return { flags, loading };
}