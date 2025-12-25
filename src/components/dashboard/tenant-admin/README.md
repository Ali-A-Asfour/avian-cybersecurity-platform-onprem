# Tenant Admin Dashboard Components

This directory contains the React components for the Tenant Admin Dashboard MVP, following the design specifications in `.kiro/specs/tenant-admin-dashboard/`.

## Components

### Core Components
- **KPICard**: Displays key performance indicators with click-to-navigate functionality
- **AlertsTrendGraph**: 7-day security alert trends with interactive data points
- **DeviceCoverageChart**: Donut chart showing endpoint protection coverage distribution
- **TicketBreakdownChart**: Security vs helpdesk ticket metrics (donut or bar chart)
- **IntegrationHealthPanel**: Status indicators for all integrated services
- **RecentActivityFeed**: Three most recent system events with navigation
- **DashboardLayout**: Grid container organizing all components

### Supporting Infrastructure
- **Types**: TypeScript interfaces in `src/types/dashboard.ts`
- **Hooks**: Data fetching and auto-refresh in `src/hooks/useDashboardData.ts`
- **Services**: API integration in `src/services/dashboardApi.ts`
- **Navigation**: Deep linking utilities in `src/services/navigationService.ts`

## Features

### Dark Theme SOC Design
- Optimized for Security Operations Center environments
- Low-light friendly color scheme
- Consistent spacing and visual hierarchy

### Property-Based Testing
- Uses @fast-check/jest for comprehensive correctness validation
- Each component includes property tests for universal behaviors
- Minimum 100 iterations per property test

### Auto-Refresh
- 60-second automatic data refresh
- Pauses during modal interactions
- Reduced frequency when tab is inactive

### Deep Linking Navigation
- Click any metric, chart, or activity item
- Navigate directly to filtered detail pages
- Preserves query parameters and scroll position

## Usage

```tsx
import {
  KPICard,
  AlertsTrendGraph,
  DeviceCoverageChart,
  TicketBreakdownChart,
  IntegrationHealthPanel,
  RecentActivityFeed,
  DashboardLayout
} from '@/components/dashboard/tenant-admin';

// Use in main dashboard component
```

## Testing

Run property-based tests:
```bash
npm test -- --testPathPatterns="tenant-admin"
```

## Requirements Compliance

This implementation follows the requirements specified in:
- `.kiro/specs/tenant-admin-dashboard/requirements.md`
- `.kiro/specs/tenant-admin-dashboard/design.md`

All components implement the specified TypeScript interfaces and support the required navigation patterns.