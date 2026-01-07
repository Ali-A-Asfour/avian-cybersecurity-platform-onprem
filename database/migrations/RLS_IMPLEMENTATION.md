# Row-Level Security (RLS) Implementation

## Overview

This document describes the PostgreSQL Row-Level Security (RLS) implementation for tenant isolation in the AVIAN Cybersecurity Platform. RLS provides database-level enforcement of tenant isolation, ensuring that users can only access data belonging to their tenant.

## What is Row-Level Security?

Row-Level Security (RLS) is a PostgreSQL feature that allows you to define policies that restrict which rows can be accessed or modified by different users. In our implementation, RLS enforces tenant isolation at the database level, providing an additional security layer beyond application-level checks.

## Implementation Details

### Migration Files

- **0027_tenant_row_level_security.sql**: Enables RLS and creates policies
- **0027_tenant_row_level_security_rollback.sql**: Disables RLS and removes policies

### Tables with RLS Enabled

The following tables have RLS policies enabled:

**Core Tables:**
- `users` - User accounts
- `audit_logs` - Audit log entries
- `sessions` - User sessions
- `password_history` - Password history for reuse prevention
- `auth_audit_logs` - Authentication event logs
- `email_verification_tokens` - Email verification tokens
- `password_reset_tokens` - Password reset tokens

**Ticket System:**
- `tickets` - Support tickets
- `ticket_comments` - Ticket comments
- `ticket_attachments` - Ticket file attachments

**Alerts & Compliance:**
- `alerts` - Security alerts
- `compliance_frameworks` - Compliance frameworks
- `compliance_controls` - Compliance controls
- `compliance_evidence` - Compliance evidence files

**Notifications:**
- `notifications` - User notifications

### RLS Helper Functions

Three helper functions are used by RLS policies:

1. **`get_current_tenant_id()`**: Returns the tenant_id from session variable `app.current_tenant_id`
2. **`get_current_user_role()`**: Returns the user role from session variable `app.current_user_role`
3. **`is_super_admin()`**: Returns true if the current user has the `super_admin` role

### Policy Structure

Each table has two policies:

1. **Super Admin Policy** (`{table}_super_admin_all`):
   - Allows super_admin users to access ALL rows in the table
   - Applies to SELECT, INSERT, UPDATE, DELETE operations

2. **Tenant Isolation Policy** (`{table}_tenant_isolation`):
   - Restricts non-super_admin users to rows matching their tenant_id
   - Applies to SELECT, INSERT, UPDATE, DELETE operations

### Policy Logic

**For tables with direct `tenant_id` column:**
```sql
-- Super admin can access all rows
USING (is_super_admin())

-- Non-super_admin can only access rows in their tenant
USING (
    NOT is_super_admin() 
    AND tenant_id = get_current_tenant_id()
)
```

**For tables without direct `tenant_id` (linked via foreign key):**
```sql
-- Example: sessions table (linked to users)
USING (
    NOT is_super_admin() 
    AND user_id IN (
        SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
    )
)
```

## Application Integration

### Setting Session Variables

Before executing any database queries, the application MUST set the session variables:

```typescript
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// Set session variables for the current request
async function setRLSContext(user: { tenantId: string; role: string }) {
  await db.execute(sql`SET LOCAL app.current_tenant_id = ${user.tenantId}`);
  await db.execute(sql`SET LOCAL app.current_user_role = ${user.role}`);
}

// Example usage in API route
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  
  // Set RLS context
  await setRLSContext(user);
  
  // Now all queries are automatically filtered by RLS
  const users = await db.select().from(usersTable);
  
  return NextResponse.json({ users });
}
```

### Middleware Integration

The recommended approach is to set RLS context in authentication middleware:

```typescript
// src/middleware/auth.middleware.ts
export async function withRLSContext(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = await getAuthenticatedUser(req);
    
    if (user) {
      // Set RLS context for this request
      await db.execute(sql`SET LOCAL app.current_tenant_id = ${user.tenantId}`);
      await db.execute(sql`SET LOCAL app.current_user_role = ${user.role}`);
    }
    
    return handler(req);
  };
}
```

### Session Variable Lifecycle

- Session variables are set with `SET LOCAL`, which means they are automatically cleared at the end of the transaction
- Each HTTP request should set the session variables at the beginning
- Variables are scoped to the current database connection/transaction

## Testing RLS Policies

### Manual Testing

You can test RLS policies directly in PostgreSQL:

```sql
-- Test as super_admin
SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000001';
SET LOCAL app.current_user_role = 'super_admin';
SELECT COUNT(*) FROM users; -- Should return all users

-- Test as tenant_admin
SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000001';
SET LOCAL app.current_user_role = 'tenant_admin';
SELECT COUNT(*) FROM users; -- Should return only users in tenant 1

-- Test as different tenant
SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000002';
SET LOCAL app.current_user_role = 'tenant_admin';
SELECT COUNT(*) FROM users; -- Should return only users in tenant 2
```

### Automated Testing

Property-based tests validate RLS behavior:

```typescript
// src/lib/__tests__/rls.property.test.ts
describe('RLS Tenant Isolation', () => {
  it('should enforce tenant isolation for non-super_admin users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.uuid(),
          role: fc.constantFrom('tenant_admin', 'security_analyst', 'user')
        }),
        async ({ tenantId, role }) => {
          // Set RLS context
          await db.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}`);
          await db.execute(sql`SET LOCAL app.current_user_role = ${role}`);
          
          // Query users
          const users = await db.select().from(usersTable);
          
          // All returned users should belong to the tenant
          expect(users.every(u => u.tenant_id === tenantId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Performance Considerations

### Indexes for RLS Performance

The migration creates indexes to optimize RLS policy lookups:

```sql
CREATE INDEX idx_users_tenant_id_id ON users(tenant_id, id);
CREATE INDEX idx_tickets_tenant_id_id ON tickets(tenant_id, id);
CREATE INDEX idx_compliance_frameworks_tenant_id_id ON compliance_frameworks(tenant_id, id);
```

These indexes improve performance of subquery lookups in RLS policies.

### Query Performance

- RLS policies add a WHERE clause to every query automatically
- For tables with direct `tenant_id`, performance impact is minimal (simple equality check)
- For tables with foreign key relationships, subqueries may impact performance
- Use EXPLAIN ANALYZE to verify query plans include proper index usage

### Monitoring

Monitor slow queries that may be affected by RLS:

```sql
-- Enable slow query logging
ALTER DATABASE avian SET log_min_duration_statement = 1000; -- Log queries > 1s

-- Check query plans
EXPLAIN ANALYZE SELECT * FROM users;
```

## Security Benefits

### Defense in Depth

RLS provides multiple security benefits:

1. **Database-Level Enforcement**: Even if application code has bugs, the database enforces tenant isolation
2. **Protection Against SQL Injection**: Even successful SQL injection cannot bypass RLS policies
3. **Audit Trail**: RLS policies are logged in PostgreSQL audit logs
4. **Consistent Enforcement**: All queries (including raw SQL) are subject to RLS policies

### Attack Scenarios Prevented

**Scenario 1: Application Bug**
- Bug in application code forgets to add tenant_id filter
- RLS automatically filters results to current tenant
- Cross-tenant data leak prevented

**Scenario 2: SQL Injection**
- Attacker injects SQL to bypass application filters
- RLS policies still enforce tenant isolation
- Attacker can only access their own tenant's data

**Scenario 3: Direct Database Access**
- Developer connects directly to database for debugging
- RLS policies still apply (unless using superuser account)
- Accidental cross-tenant queries prevented

## Troubleshooting

### Common Issues

**Issue: No rows returned when expected**
- **Cause**: Session variables not set
- **Solution**: Ensure `app.current_tenant_id` and `app.current_user_role` are set before queries

**Issue: Super admin cannot access all tenants**
- **Cause**: Role not set to 'super_admin' exactly
- **Solution**: Verify `app.current_user_role` is set to 'super_admin' (case-sensitive)

**Issue: Slow queries after enabling RLS**
- **Cause**: Missing indexes for RLS policy lookups
- **Solution**: Ensure RLS performance indexes are created (see migration)

### Debugging RLS

Check if RLS is enabled on a table:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';
```

View RLS policies for a table:

```sql
SELECT * FROM pg_policies WHERE tablename = 'users';
```

Check current session variables:

```sql
SELECT current_setting('app.current_tenant_id', true);
SELECT current_setting('app.current_user_role', true);
```

## Migration Instructions

### Applying the Migration

```bash
# Using psql
psql -U avian -d avian -f database/migrations/0027_tenant_row_level_security.sql

# Using Docker
docker exec -i avian-postgres psql -U avian -d avian < database/migrations/0027_tenant_row_level_security.sql

# Using npm script (if configured)
npm run db:migrate
```

### Rolling Back the Migration

```bash
# Using psql
psql -U avian -d avian -f database/migrations/0027_tenant_row_level_security_rollback.sql

# Using Docker
docker exec -i avian-postgres psql -U avian -d avian < database/migrations/0027_tenant_row_level_security_rollback.sql
```

## Validation

After applying the migration, validate RLS is working:

```sql
-- 1. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;
-- Should return all tenant-scoped tables

-- 2. Verify policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public';
-- Should return 2 policies per table (super_admin and tenant_isolation)

-- 3. Test tenant isolation
SET LOCAL app.current_tenant_id = '<tenant-1-uuid>';
SET LOCAL app.current_user_role = 'tenant_admin';
SELECT COUNT(*) FROM users;
-- Should return only users in tenant 1

-- 4. Test super admin access
SET LOCAL app.current_tenant_id = '<tenant-1-uuid>';
SET LOCAL app.current_user_role = 'super_admin';
SELECT COUNT(*) FROM users;
-- Should return all users across all tenants
```

## Requirements Validation

This implementation validates **Requirement 16.6**:

> THE System SHALL implement database row-level security policies

**Validation Evidence:**
- ✅ RLS enabled on all tenant-scoped tables
- ✅ Policies enforce tenant isolation for non-super_admin users
- ✅ Super admin can access all tenants
- ✅ Policies apply to SELECT, INSERT, UPDATE, DELETE operations
- ✅ Session variables control policy behavior
- ✅ Performance indexes created for policy efficiency

## References

- [PostgreSQL Row Security Policies Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [AWS Multi-tenant Data Isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- AVIAN Requirements Document: Requirement 16.6
- AVIAN Design Document: Tenant Isolation section
