import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { IntegrationHealthPanelProps } from '@/types/dashboard';

const IntegrationHealthPanelComponent: React.FC<IntegrationHealthPanelProps> = ({
    integrations,
    onIntegrationClick
}) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
                return 'bg-success-500';
            case 'warning':
                return 'bg-warning-500';
            case 'error':
                return 'bg-error-500';
            default:
                return 'bg-neutral-500';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'healthy':
                return 'Healthy';
            case 'warning':
                return 'Warning';
            case 'error':
                return 'Error';
            default:
                return 'Unknown';
        }
    };

    const formatLastSync = (lastSync: string) => {
        const date = new Date(lastSync);
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

    const getServiceDisplayName = (serviceName: string) => {
        switch (serviceName) {
            case 'microsoft':
                return 'Microsoft';
            case 'sonicwall':
                return 'SonicWall';
            case 'edr-antivirus':
                return 'EDR/Antivirus';
            case 'avian-agents':
                return 'AVIAN Agents';
            default:
                return serviceName;
        }
    };

    const getServiceIcon = (serviceName: string) => {
        switch (serviceName) {
            case 'microsoft':
                return '🏢';
            case 'sonicwall':
                return '🛡️';
            case 'edr-antivirus':
                return '🔍';
            case 'avian-agents':
                return '🤖';
            default:
                return '⚙️';
        }
    };

    return (
        <section
            className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
            role="region"
            aria-label="Integration health status"
        >
            <h3 className="text-white text-base sm:text-lg font-semibold mb-4">Integration Health</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {integrations.map((integration, index) => (
                    <div
                        key={integration.serviceName}
                        onClick={() => onIntegrationClick(integration.serviceName)}
                        className={cn(
                            "bg-neutral-900 border border-neutral-600 rounded-lg p-3 sm:p-4 cursor-pointer transition-all duration-200",
                            "hover:border-primary-500 hover:shadow-md hover:shadow-primary-500/10",
                            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-800",
                            "active:scale-98 active:transition-transform", // Touch feedback
                            "min-h-[80px] sm:min-h-[90px]" // Consistent height for touch targets
                        )}
                        role="button"
                        tabIndex={0}
                        aria-label={`${getServiceDisplayName(integration.serviceName)} integration: ${getStatusText(integration.status)}, last synced ${formatLastSync(integration.lastSync)}. Click to view integration settings.`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onIntegrationClick(integration.serviceName);
                            }
                        }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                                <span
                                    className="text-base sm:text-lg mr-2"
                                    aria-hidden="true"
                                >
                                    {getServiceIcon(integration.serviceName)}
                                </span>
                                <div
                                    className={cn(
                                        "w-3 h-3 rounded-full flex-shrink-0",
                                        getStatusColor(integration.status)
                                    )}
                                    role="status"
                                    aria-label={`Status: ${getStatusText(integration.status)}`}
                                />
                            </div>
                            <div className={cn(
                                "text-xs font-medium",
                                integration.status === 'healthy' && "text-success-400",
                                integration.status === 'warning' && "text-warning-400",
                                integration.status === 'error' && "text-error-400"
                            )}>
                                {getStatusText(integration.status)}
                            </div>
                        </div>
                        <div className="text-white text-sm font-medium mb-1 truncate">
                            {getServiceDisplayName(integration.serviceName)}
                        </div>
                        <div className="text-neutral-400 text-xs">
                            <time dateTime={integration.lastSync}>
                                Last sync: {formatLastSync(integration.lastSync)}
                            </time>
                        </div>
                    </div>
                ))}
            </div>
            {/* Screen reader accessible summary */}
            <div className="sr-only">
                Integration health summary:
                {integrations.map((integration, index) => (
                    <span key={integration.serviceName}>
                        {getServiceDisplayName(integration.serviceName)}: {getStatusText(integration.status)},
                        last synced {formatLastSync(integration.lastSync)}
                        {index < integrations.length - 1 ? '. ' : ''}
                    </span>
                ))}
            </div>
        </section>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const IntegrationHealthPanel = memo(IntegrationHealthPanelComponent, (prevProps, nextProps) => {
    // Compare integrations array
    if (prevProps.integrations.length !== nextProps.integrations.length) return false;

    // Deep comparison for integrations array
    for (let i = 0; i < prevProps.integrations.length; i++) {
        const prev = prevProps.integrations[i];
        const next = nextProps.integrations[i];

        if (prev.serviceName !== next.serviceName ||
            prev.status !== next.status ||
            prev.lastSync !== next.lastSync) {
            return false;
        }
    }

    // Compare callback function reference
    return prevProps.onIntegrationClick === nextProps.onIntegrationClick;
});