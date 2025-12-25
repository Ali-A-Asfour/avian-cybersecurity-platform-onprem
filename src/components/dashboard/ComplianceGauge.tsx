'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ComplianceSummary } from '@/services/dashboard.service';

interface ComplianceGaugeProps {
  data: ComplianceSummary;
  onClick?: () => void;
}

export function ComplianceGauge({ data, onClick }: ComplianceGaugeProps) {
  const score = data.overall_score;
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - ((score || 0) / 100) * circumference;

  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success-500';
    if (score >= 75) return 'text-primary-500';
    if (score >= 60) return 'text-warning-500';
    return 'text-error-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-success-500';
    if (score >= 75) return 'bg-primary-500';
    if (score >= 60) return 'bg-warning-500';
    return 'bg-error-500';
  };

  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} onClick={onClick}>
      <CardHeader>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Compliance Score
        </h3>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {/* Gauge Chart */}
          <div className="relative">
            <svg
              height={radius * 2}
              width={radius * 2}
              className="transform -rotate-90"
            >
              {/* Background circle */}
              <circle
                stroke="currentColor"
                fill="transparent"
                strokeWidth={strokeWidth}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="text-neutral-200 dark:text-neutral-700"
              />
              {/* Progress circle */}
              <circle
                stroke="currentColor"
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className={getScoreColor(score)}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 0.5s ease-in-out',
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {(score || 0).toFixed(1)}%
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Overall
                </div>
              </div>
            </div>
          </div>

          {/* Framework Breakdown */}
          <div className="space-y-3 ml-6 flex-1">
            {(data.frameworks || []).map((framework) => (
              <div key={framework.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {framework.name}
                  </span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {framework.score.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getScoreBgColor(framework.score)}`}
                    style={{ width: `${framework.score}%` }}
                  ></div>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {framework.controls_completed}/{framework.controls_total} controls
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-success-600 dark:text-success-400">
                {data.controls_completed}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                Completed
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-warning-600 dark:text-warning-400">
                {data.controls_in_progress}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                In Progress
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-neutral-600 dark:text-neutral-400">
                {data.controls_not_started}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                Not Started
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}