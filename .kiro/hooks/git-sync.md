# Git Sync Hook

**Trigger**: On file save
**Purpose**: Automatically sync changes and notify team members

## Hook Configuration
- **Event**: File Save
- **Files**: `src/**/*`, `database/**/*`, `.kiro/specs/**/*`
- **Actions**:
  1. Run linting and type checking
  2. Update related documentation
  3. Sync with team members via git status
  4. Notify of breaking changes

## Team Notification
When significant changes are detected:
- API route modifications
- Database schema changes  
- Type definition updates
- Security-related changes

The hook will suggest creating a team notification or updating the changelog.