# Auto-Sync Hook

**Trigger**: On workspace open, file save, git operations
**Purpose**: Automatically sync and update team members without manual intervention

## Auto-Sync Configuration
- **Events**: 
  - Workspace startup
  - File save (critical files only)
  - Git push/pull operations
  - Every 30 minutes (background)

- **Critical Files**:
  - `database/migrations/*.sql`
  - `src/app/api/**/*.ts`
  - `src/types/index.ts`
  - `package.json`
  - `.env.example`

## Automated Actions
1. **Background Git Fetch**: Automatically fetch latest changes every 30 minutes
2. **Conflict Detection**: Alert if local changes conflict with remote
3. **Dependency Updates**: Auto-install new dependencies when package.json changes
4. **Migration Alerts**: Notify when new database migrations are available
5. **Type Sync**: Update TypeScript types when shared interfaces change

## Team Notifications
- Slack/Discord webhooks for breaking changes
- Email notifications for critical updates
- In-IDE notifications for immediate attention items