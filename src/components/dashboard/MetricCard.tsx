'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const colorClasses = {
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  neutral: 'bg-neutral-500',
};

const trendColors = {
  up: 'text-success-600 dark:text-success-400',
  down: 'text-error-600 dark:text-error-400',
  neutral: 'text-neutral-600 dark:text-neutral-400',
};

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  color = 'primary',
  icon,
  onClick,
  className = '',
}: MetricCardProps) {
  const CardComponent = onClick ? 'button' : 'div';

  return (
    <Card 
      className={`${className} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {title}
          </h3>
          {icon && (
            <div className={`w-4 h-4 rounded-full ${colorClasses[color]}`}>
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={`flex items-center text-xs ${trendColors[trend.direction]}`}>
              <span className="mr-1">
                {trend.direction === 'up' && '↗'}
                {trend.direction === 'down' && '↘'}
                {trend.direction === 'neutral' && '→'}
              </span>
              <span>{trend.value > 0 ? '+' : ''}{trend.value}</span>
              <span className="ml-1">{trend.label}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}