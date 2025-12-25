'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ActivityFeedItem } from '@/services/dashboard.service';

interface ActivityFeedProps {
  data: ActivityFeedItem[];
  onClick?: () => void;
}

export function ActivityFeed({ data, onClick }: ActivityFeedProps) {
  const getActivityIcon = (type: ActivityFeedItem['type']) => {
    switch (type) {
      case 'ticket':
        return '🎫';
      case 'alert':
        return '🚨';
      case 'compliance':
        return '📋';
      case 'user':
        return '👤';
      case 'system':
        return '⚙️';
      default:
        return '📄';
    }
  };

  const getSeverityColor = (severity?: ActivityFeedItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-error-600 dark:text-error-400';
      case 'high':
        return 'text-warning-600 dark:text-warning-400';
      case 'medium':
        return 'text-primary-600 dark:text-primary-400';
      case 'low':
        return 'text-success-600 dark:text-success-400';
      default:
        return 'text-neutral-600 dark:text-neutral-400';
    }
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const diffInMinutes = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} onClick={onClick}>
      <CardHeader>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Recent Activity
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {data.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              No recent activity
            </div>
          ) : (
            data.map((item) => (
              <div key={item.id} className="flex items-start space-x-3 group">
                {/* Timeline dot and line */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm">
                    {getActivityIcon(item.type)}
                  </div>
                  {/* Connecting line (except for last item) */}
                  <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mt-2 group-last:hidden"></div>
                </div>

                {/* Activity content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {item.title}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                        {item.description}
                      </p>
                      {item.user && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                          by {item.user}
                        </p>
                      )}
                    </div>
                    
                    {/* Severity indicator and timestamp */}
                    <div className="flex flex-col items-end ml-4">
                      {item.severity && (
                        <div className={`text-xs font-medium ${getSeverityColor(item.severity)} mb-1`}>
                          {item.severity.toUpperCase()}
                        </div>
                      )}
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatTimeAgo(item.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* View All Button */}
        {data.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <button className="w-full text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
              View All Activity →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}