'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { AlertSummary } from '@/services/dashboard.service';

interface AlertSeverityChartProps {
  data: AlertSummary;
  onClick?: () => void;
}

export function AlertSeverityChart({ data, onClick }: AlertSeverityChartProps) {
  const total = data.critical + data.high + data.medium + data.low + data.info;
  
  const segments = [
    { label: 'Critical', value: data.critical, color: 'bg-error-500', percentage: (data.critical / total) * 100 },
    { label: 'High', value: data.high, color: 'bg-warning-500', percentage: (data.high / total) * 100 },
    { label: 'Medium', value: data.medium, color: 'bg-primary-500', percentage: (data.medium / total) * 100 },
    { label: 'Low', value: data.low, color: 'bg-success-500', percentage: (data.low / total) * 100 },
    { label: 'Info', value: data.info, color: 'bg-neutral-400', percentage: (data.info / total) * 100 },
  ].filter(segment => segment.value > 0);

  const radius = 60;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  let cumulativePercentage = 0;

  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} onClick={onClick}>
      <CardHeader>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Alert Severity Distribution
        </h3>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {/* Donut Chart */}
          <div className="relative">
            <svg
              height={radius * 2}
              width={radius * 2}
              className="transform -rotate-90"
            >
              <circle
                stroke="currentColor"
                fill="transparent"
                strokeWidth={strokeWidth}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="text-neutral-200 dark:text-neutral-700"
              />
              {segments.map((segment, index) => {
                const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -(cumulativePercentage || 0) * circumference / 100;
                cumulativePercentage += segment.percentage;

                return (
                  <circle
                    key={segment.label}
                    stroke="currentColor"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    className={segment.color.replace('bg-', 'text-')}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {data.unresolved}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Unresolved
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2 ml-6">
            {segments.map((segment) => (
              <div key={segment.label} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${segment.color}`}></div>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {segment.label}
                </span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {segment.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-600 dark:text-neutral-400">Total Alerts:</span>
              <span className="ml-2 font-medium text-neutral-900 dark:text-neutral-100">
                {data.total}
              </span>
            </div>
            <div>
              <span className="text-neutral-600 dark:text-neutral-400">Unresolved:</span>
              <span className="ml-2 font-medium text-neutral-900 dark:text-neutral-100">
                {data.unresolved}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}