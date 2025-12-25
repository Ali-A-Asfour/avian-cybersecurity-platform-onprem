'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { SLASummary } from '@/services/dashboard.service';

interface SLAMetricsProps {
  data: SLASummary;
  onClick?: () => void;
}

export function SLAMetrics({ data, onClick }: SLAMetricsProps) {
  const metrics = [
    {
      label: 'Response Rate',
      value: data.response_rate,
      target: 95,
      unit: '%',
      color: data.response_rate >= 95 ? 'success' : data.response_rate >= 85 ? 'warning' : 'error',
    },
    {
      label: 'Resolution Rate',
      value: data.resolution_rate,
      target: 90,
      unit: '%',
      color: data.resolution_rate >= 90 ? 'success' : data.resolution_rate >= 80 ? 'warning' : 'error',
    },
    {
      label: 'Avg Response Time',
      value: data.average_response_time,
      target: 4,
      unit: 'h',
      color: data.average_response_time <= 4 ? 'success' : data.average_response_time <= 8 ? 'warning' : 'error',
    },
    {
      label: 'Avg Resolution Time',
      value: data.average_resolution_time,
      target: 24,
      unit: 'h',
      color: data.average_resolution_time <= 24 ? 'success' : data.average_resolution_time <= 48 ? 'warning' : 'error',
    },
  ];

  const colorClasses = {
    success: {
      bg: 'bg-success-500',
      text: 'text-success-600 dark:text-success-400',
      bar: 'bg-success-200 dark:bg-success-800',
    },
    warning: {
      bg: 'bg-warning-500',
      text: 'text-warning-600 dark:text-warning-400',
      bar: 'bg-warning-200 dark:bg-warning-800',
    },
    error: {
      bg: 'bg-error-500',
      text: 'text-error-600 dark:text-error-400',
      bar: 'bg-error-200 dark:bg-error-800',
    },
  };

  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} onClick={onClick}>
      <CardHeader>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          SLA Performance
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric) => {
            const isPercentage = metric.unit === '%';
            const isTime = metric.unit === 'h';
            const progress = isPercentage 
              ? metric.value 
              : isTime 
                ? Math.max(0, 100 - (metric.value / metric.target) * 100)
                : (metric.value / metric.target) * 100;

            return (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {metric.label}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-bold ${colorClasses[metric.color as keyof typeof colorClasses].text}`}>
                      {(metric.value || 0).toFixed(1)}{metric.unit}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${colorClasses[metric.color as keyof typeof colorClasses].bg}`}></div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${colorClasses[metric.color as keyof typeof colorClasses].bg}`}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>Target: {metric.target}{metric.unit}</span>
                  <span>
                    {isTime && metric.value > metric.target && '⚠️ Over target'}
                    {isPercentage && metric.value >= metric.target && '✅ Meeting target'}
                    {isPercentage && metric.value < metric.target && '⚠️ Below target'}
                    {isTime && metric.value <= metric.target && '✅ Meeting target'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Alert Summary */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-error-600 dark:text-error-400">
                {data.breached_tickets}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                SLA Breached
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-warning-600 dark:text-warning-400">
                {data.at_risk_tickets}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                At Risk
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}