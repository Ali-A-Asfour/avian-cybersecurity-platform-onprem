import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface ActivityItem {
    id: string;
    timestamp: string;
    description: string;
    type: 'alert' | 'compliance' | 'device' | 'ticket' | 'integration';
    icon: string;
}

interface RecentActivityFeedProps {
    activities: Array<ActivityItem>;
    onActivityClick: (activity: ActivityItem) => void;
    loading?: boolean;
}

const RecentActivityFeedComponent: React.FC<RecentActivityFeedProps> = ({
    activities,
    onActivityClick,
    loading = false
}) => {
    if (loading) {
        return (
            <div
                className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
                role="status"
                aria-label="Loading recent activity data"
            >
                <div className="animate-pulse">
                    <div className="h-4 bg-neutral-700 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-neutral-700 rounded-full"></div>
                                <div className="flex-1">
                                    <div className="h-3 bg-neutral-700 rounded w-3/4 mb-1"></div>
                                    <div className="h-2 bg-neutral-700 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <span className="sr-only">Loading recent activity data...</span>
            </div>
        );
    }

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'alert':
                return 'text-error-400 bg-error-900/20';
            case 'compliance':
                return 'text-warning-400 bg-warning-900/20';
            case 'device':
                return 'text-primary-400 bg-primary-900/20';
            case 'ticket':
                return 'text-success-400 bg-success-900/20';
            case 'integration':
                return 'text-neutral-400 bg-neutral-700/20';
            default:
                return 'text-neutral-400 bg-neutral-700/20';
        }
    };

    // Ensure we only show the 3 most recent activities
    const recentActivities = activities.slice(0, 3);

    return (
        <section
            className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
            role="region"
            aria-label="Recent system activity"
        >
            <h3 className="text-white text-base sm:text-lg font-semibold mb-4">Recent Activity</h3>
            {recentActivities.length === 0 ? (
                <div
                    className="text-neutral-400 text-center py-8"
                    role="status"
                    aria-label="No recent activity available"
                >
                    No recent activity to display
                </div>
            ) : (
                <div className="space-y-3 sm:space-y-4" role="list">
                    {recentActivities.map((activity, index) => (
                        <div
                            key={activity.id}
                            onClick={() => onActivityClick(activity)}
                            className={cn(
                                "flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
                                "hover:bg-neutral-700/50 hover:border-primary-500/30 border border-transparent",
                                "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-800",
                                "active:scale-98 active:transition-transform" // Touch feedback
                            )}
                            role="button"
                            tabIndex={0}
                            aria-label={`Activity ${index + 1} of ${recentActivities.length}: ${activity.description}, ${formatTimestamp(activity.timestamp)}. Click to view details.`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onActivityClick(activity);
                                }
                            }}
                        >
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0",
                                    getTypeColor(activity.type)
                                )}
                                aria-hidden="true"
                            >
                                {activity.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-medium truncate">
                                    {activity.description}
                                </div>
                                <div className="text-neutral-400 text-xs">
                                    <time dateTime={activity.timestamp}>
                                        {formatTimestamp(activity.timestamp)}
                                    </time>
                                </div>
                            </div>
                            <div className="text-neutral-500 text-xs flex-shrink-0" aria-hidden="true">
                                →
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const RecentActivityFeed = memo(RecentActivityFeedComponent, (prevProps, nextProps) => {
    // Compare activities array
    if (prevProps.activities.length !== nextProps.activities.length) return false;

    // Deep comparison for activities array (only first 3 items matter)
    const prevActivities = prevProps.activities.slice(0, 3);
    const nextActivities = nextProps.activities.slice(0, 3);

    for (let i = 0; i < prevActivities.length; i++) {
        const prev = prevActivities[i];
        const next = nextActivities[i];

        if (prev.id !== next.id ||
            prev.timestamp !== next.timestamp ||
            prev.description !== next.description ||
            prev.type !== next.type ||
            prev.icon !== next.icon) {
            return false;
        }
    }

    // Compare other props
    return (
        prevProps.loading === nextProps.loading &&
        prevProps.onActivityClick === nextProps.onActivityClick
    );
});