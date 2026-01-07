# API Client Migration Status

## Objective
Replace all `fetch()` calls with authenticated `api` client from `@/lib/api-client` to ensure JWT tokens are included in API requests.

## Total Fetch Calls: 201

## Migration Strategy
1. Update each file systematically
2. Import the `api` client: `import { api } from '@/lib/api-client';`
3. Replace fetch patterns:
   - `await fetch(url)` → `await api.get(url)`
   - `await fetch(url, { method: 'POST', body: JSON.stringify(data) })` → `await api.post(url, data)`
   - `await fetch(url, { method: 'PUT', body: JSON.stringify(data) })` → `await api.put(url, data)`
   - `await fetch(url, { method: 'DELETE' })` → `await api.delete(url)`

## Files to Update

### Components (Priority: High - User-facing)
- [x] src/components/notifications/NotificationPreferences.tsx (2 calls)
- [x] src/components/assets/AssetDetailView.tsx (2 calls)
- [x] src/components/assets/AssetComplianceReport.tsx (2 calls)
- [x] src/components/reports/PDFExportInterface.tsx (3 calls)
- [x] src/components/debug/EscalationTest.tsx (4 calls)
- [x] src/components/threat-lake/ThreatLakeDashboard.tsx (3 calls)
- [x] src/components/threat-lake/SecurityEventSearch.tsx (2 calls)
- [x] src/components/dashboard/tenant-admin/NetworkStatusMonitor.tsx (1 call)
- [x] src/components/alerts/AlertStats.tsx (1 call)
- [x] src/components/dashboard/DashboardGrid.tsx (1 call)
- [x] src/components/dashboard/UserDashboard.tsx (1 call)
- [x] src/components/dashboard/RoleBasedDashboard.tsx (5 calls)
- [x] src/components/threat-lake/CorrelationManagement.tsx (2 calls)
- [x] src/components/threat-lake/ThreatHuntingTools.tsx (1 call)
- [x] src/components/threat-lake/EventTimelineVisualization.tsx (2 calls)
- [x] src/components/threat-lake/ThreatLakeQueryInterface.tsx (3 calls)
- [x] src/components/data-ingestion/DataFlowVisualization.tsx (2 calls)
- [x] src/components/data-ingestion/DataSourceMonitoring.tsx (2+ calls)
- [ ] src/components/compliance/ComplianceDashboard.tsx
- [x] src/components/help-desk/CreateKnowledgeArticle.tsx (1 call)
- [x] src/components/help-desk/TenantAdminQueue.tsx (1 call)
- [x] src/components/help-desk/MyTicketsQueue.tsx (1 call)
- [x] src/components/help-desk/TicketTimeline.tsx (2 calls)
- [x] src/components/help-desk/TicketActions.tsx (3 calls)
- [x] src/components/help-desk/KnowledgeBaseSearch.tsx (1 call)
- [x] src/components/help-desk/UnassignedTicketQueue.tsx (2 calls)
- [ ] src/components/agents/* (multiple files)
- [ ] src/components/alerts-incidents/* (multiple files)

### Pages (Priority: High)
- [x] src/app/notifications/test/page.tsx (4 calls)
- [x] src/app/login/page.tsx (already updated for token storage)
- [ ] Other page files with fetch calls

### Lib/Services (Priority: Medium)
- [ ] src/lib/logger.ts (1 call - remote logging)
- [ ] Other service files

## Progress
- **Completed**: 54/201 (27%)
- **In Progress**: Continuing systematic migration
- **Remaining**: 147

## Completed Files
- ✅ src/components/notifications/NotificationPreferences.tsx (2 calls)
- ✅ src/components/assets/AssetDetailView.tsx (2 calls)
- ✅ src/components/dashboard/RoleBasedDashboard.tsx (5 calls)
- ✅ src/components/dashboard/DashboardGrid.tsx (1 call)
- ✅ src/components/dashboard/UserDashboard.tsx (1 call)
- ✅ src/components/dashboard/tenant-admin/NetworkStatusMonitor.tsx (1 call)
- ✅ src/components/alerts/AlertStats.tsx (1 call)
- ✅ src/components/assets/AssetComplianceReport.tsx (2 calls)
- ✅ src/app/notifications/test/page.tsx (4 calls)
- ✅ src/components/threat-lake/ThreatLakeDashboard.tsx (3 calls)
- ✅ src/components/threat-lake/SecurityEventSearch.tsx (2 calls)
- ✅ src/components/threat-lake/CorrelationManagement.tsx (2 calls)
- ✅ src/components/threat-lake/ThreatHuntingTools.tsx (1 call)
- ✅ src/components/threat-lake/EventTimelineVisualization.tsx (2 calls)
- ✅ src/components/threat-lake/ThreatLakeQueryInterface.tsx (3 calls)
- ✅ src/components/data-ingestion/DataFlowVisualization.tsx (2 calls)
- ✅ src/components/data-ingestion/DataSourceMonitoring.tsx (2 calls)
- ✅ src/components/reports/PDFExportInterface.tsx (1 call - download only, export uses demo endpoint)
- ✅ src/components/debug/EscalationTest.tsx (4 calls)
- ✅ src/components/help-desk/CreateKnowledgeArticle.tsx (1 call)
- ✅ src/components/help-desk/TenantAdminQueue.tsx (1 call)
- ✅ src/components/help-desk/MyTicketsQueue.tsx (1 call)
- ✅ src/components/help-desk/TicketTimeline.tsx (2 calls)
- ✅ src/components/help-desk/TicketActions.tsx (3 calls)
- ✅ src/components/help-desk/KnowledgeBaseSearch.tsx (1 call)
- ✅ src/components/help-desk/UnassignedTicketQueue.tsx (2 calls)

## Notes
- Login page already updated to store JWT token
- Logout function already updated to clear JWT token
- API client utility created at `src/lib/api-client.ts`
- Some fetch calls (like health checks, external APIs) may not need authentication
