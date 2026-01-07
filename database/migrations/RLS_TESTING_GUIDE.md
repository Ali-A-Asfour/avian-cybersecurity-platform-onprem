# RLS Testing Guide

## Quick Start Testing

This guide provides step-by-step instructions for testing the Row-Level Security (RLS) implementation.

## Prerequisites

- PostgreSQL database running with AVIAN schema
- Migration 0027 applied
- Test data with multiple tenants

## Setup Test Data

First, create test data with multiple tenants:

```sql
-- Create two test tenants
INSERT INTO tenants (id, name, domain, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Tenant One', 'tenant1.example.com', true),
  ('22222222-2222-2222-2222-222222222222', 'Tenant Two', 'tenant2.example.com', true);

-- Create test users in each tenant
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, password_hash, email_verified)
VALUES 
  -- Tenant 1 users
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin1@tenant1.com', 'Admin', 'One', 'tenant_admin', '$2a$12$dummy', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'user1@tenant1.com', 'User', 'One', 'user', '$2a$12$dummy', true),
  
  -- Tenant 2 users
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'admin2@tenant2.com', 'Admin', 'Two', 'tenant_admin', '$2a$12$dummy', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'user2@tenant2.com', 'User', 'Two', 'user', '$2a$12$dummy', true),
  
  -- Super admin (can access all tenants)
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'superadmin@avian.com', 'Super', 'Admin', 'super_admin', '$2a$12$dummy', true);

-- Create test tickets in each tenant
INSERT INTO tickets (id, tenant_id, requester, title, description, category, severity, priority, status)
VALUES 
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'user1@tenant1.com', 'Ticket 1', 'Test ticket for tenant 1', 'security_incident', 'high', 'high', 'new'),
  ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'user2@tenant2.com', 'Ticket 2', 'Test ticket for tenant 2', 'security_incident', 'high', 'high', 'new');

-- Create test alerts in each tenant
INSERT INTO alerts (id, tenant_id, source, title, description, severity, category, status)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'test', 'Alert 1', 'Test alert for tenant 1', 'high', 'malware', 'open'),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'test', 'Alert 2', 'Test alert for tenant 2', 'high', 'malware', 'open');
```

## Test Scenarios

### Test 1: Tenant Admin Can Only See Their Tenant

```sql
-- Set context as Tenant 1 admin
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'tenant_admin';

-- Query users - should only see Tenant 1 users
SELECT id, email, tenant_id FROM users ORDER BY email;
-- Expected: 2 users (admin1@tenant1.com, user1@tenant1.com)

-- Query tickets - should only see Tenant 1 tickets
SELECT id, title, tenant_id FROM tickets;
-- Expected: 1 ticket (Ticket 1)

-- Query alerts - should only see Tenant 1 alerts
SELECT id, title, tenant_id FROM alerts;
-- Expected: 1 alert (Alert 1)

-- Try to query Tenant 2 data explicitly (should return nothing)
SELECT id, email FROM users WHERE tenant_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0 rows (RLS blocks access)
```

### Test 2: Different Tenant Admin Sees Different Data

```sql
-- Set context as Tenant 2 admin
SET LOCAL app.current_tenant_id = '22222222-2222-2222-2222-222222222222';
SET LOCAL app.current_user_role = 'tenant_admin';

-- Query users - should only see Tenant 2 users
SELECT id, email, tenant_id FROM users ORDER BY email;
-- Expected: 2 users (admin2@tenant2.com, user2@tenant2.com)

-- Query tickets - should only see Tenant 2 tickets
SELECT id, title, tenant_id FROM tickets;
-- Expected: 1 ticket (Ticket 2)

-- Query alerts - should only see Tenant 2 alerts
SELECT id, title, tenant_id FROM alerts;
-- Expected: 1 alert (Alert 2)
```

### Test 3: Super Admin Can See All Tenants

```sql
-- Set context as super admin
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'super_admin';

-- Query users - should see ALL users across all tenants
SELECT id, email, tenant_id FROM users ORDER BY email;
-- Expected: 5 users (all users from both tenants + super admin)

-- Query tickets - should see ALL tickets
SELECT id, title, tenant_id FROM tickets;
-- Expected: 2 tickets (from both tenants)

-- Query alerts - should see ALL alerts
SELECT id, title, tenant_id FROM alerts;
-- Expected: 2 alerts (from both tenants)

-- Verify can access specific tenant data
SELECT id, email FROM users WHERE tenant_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 2 users from Tenant 2
```

### Test 4: Regular User Has Same Restrictions

```sql
-- Set context as regular user in Tenant 1
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'user';

-- Query users - should only see Tenant 1 users
SELECT id, email, tenant_id FROM users ORDER BY email;
-- Expected: 2 users (only Tenant 1 users)

-- Try to access Tenant 2 data
SELECT id, email FROM users WHERE tenant_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0 rows (RLS blocks access)
```

### Test 5: INSERT Operations Respect RLS

```sql
-- Set context as Tenant 1 admin
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'tenant_admin';

-- Try to insert user into Tenant 1 (should succeed)
INSERT INTO users (tenant_id, email, first_name, last_name, role, password_hash, email_verified)
VALUES ('11111111-1111-1111-1111-111111111111', 'newuser@tenant1.com', 'New', 'User', 'user', '$2a$12$dummy', true);
-- Expected: Success

-- Try to insert user into Tenant 2 (should fail)
INSERT INTO users (tenant_id, email, first_name, last_name, role, password_hash, email_verified)
VALUES ('22222222-2222-2222-2222-222222222222', 'hacker@tenant2.com', 'Hacker', 'User', 'user', '$2a$12$dummy', true);
-- Expected: Error - new row violates row-level security policy
```

### Test 6: UPDATE Operations Respect RLS

```sql
-- Set context as Tenant 1 admin
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'tenant_admin';

-- Try to update user in Tenant 1 (should succeed)
UPDATE users 
SET first_name = 'Updated' 
WHERE email = 'user1@tenant1.com';
-- Expected: 1 row updated

-- Try to update user in Tenant 2 (should fail silently - 0 rows affected)
UPDATE users 
SET first_name = 'Hacked' 
WHERE email = 'user2@tenant2.com';
-- Expected: 0 rows updated (RLS prevents seeing the row)
```

### Test 7: DELETE Operations Respect RLS

```sql
-- Set context as Tenant 1 admin
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'tenant_admin';

-- Try to delete user in Tenant 2 (should fail silently - 0 rows affected)
DELETE FROM users WHERE email = 'user2@tenant2.com';
-- Expected: 0 rows deleted (RLS prevents seeing the row)

-- Verify user still exists (as super admin)
SET LOCAL app.current_user_role = 'super_admin';
SELECT email FROM users WHERE email = 'user2@tenant2.com';
-- Expected: 1 row (user still exists)
```

### Test 8: Tables with Foreign Key Relationships

```sql
-- Set context as Tenant 1 admin
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'tenant_admin';

-- Query sessions (linked to users via foreign key)
SELECT s.id, s.user_id, u.email, u.tenant_id
FROM sessions s
JOIN users u ON s.user_id = u.id;
-- Expected: Only sessions for Tenant 1 users

-- Query password_history (linked to users via foreign key)
SELECT ph.id, ph.user_id, u.email, u.tenant_id
FROM password_history ph
JOIN users u ON ph.user_id = u.id;
-- Expected: Only password history for Tenant 1 users
```

### Test 9: No Session Variables Set (Should Deny Access)

```sql
-- Clear session variables
RESET app.current_tenant_id;
RESET app.current_user_role;

-- Try to query users (should return 0 rows)
SELECT id, email FROM users;
-- Expected: 0 rows (no tenant context = no access)

-- Try to query tickets (should return 0 rows)
SELECT id, title FROM tickets;
-- Expected: 0 rows (no tenant context = no access)
```

### Test 10: Performance Check

```sql
-- Set context
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_user_role = 'tenant_admin';

-- Check query plan for users table
EXPLAIN ANALYZE SELECT * FROM users;
-- Expected: Should use index on tenant_id, execution time < 1ms

-- Check query plan for tickets table
EXPLAIN ANALYZE SELECT * FROM tickets;
-- Expected: Should use index on tenant_id, execution time < 1ms

-- Check query plan for sessions (with subquery)
EXPLAIN ANALYZE SELECT * FROM sessions;
-- Expected: Should use indexes efficiently, execution time < 5ms
```

## Validation Checklist

After running all tests, verify:

- [ ] Tenant admins can only see data from their tenant
- [ ] Different tenant admins see different data
- [ ] Super admin can see data from all tenants
- [ ] Regular users have same restrictions as tenant admins
- [ ] INSERT operations are restricted by tenant
- [ ] UPDATE operations are restricted by tenant
- [ ] DELETE operations are restricted by tenant
- [ ] Foreign key relationships respect RLS
- [ ] Queries without session variables return no data
- [ ] Query performance is acceptable (< 5ms for simple queries)

## Automated Testing

Run the automated property-based tests:

```bash
# Run RLS property tests (when implemented)
npm test -- --testPathPattern="rls.property.test"
```

## Cleanup Test Data

After testing, clean up test data:

```sql
-- Delete test data
DELETE FROM alerts WHERE id IN ('a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222');
DELETE FROM tickets WHERE id IN ('f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222');
DELETE FROM users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);
DELETE FROM tenants WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
```

## Troubleshooting

### Issue: All queries return 0 rows

**Cause**: Session variables not set

**Solution**:
```sql
-- Check current session variables
SELECT current_setting('app.current_tenant_id', true);
SELECT current_setting('app.current_user_role', true);

-- Set them if missing
SET LOCAL app.current_tenant_id = '<your-tenant-id>';
SET LOCAL app.current_user_role = '<your-role>';
```

### Issue: Super admin sees only one tenant

**Cause**: Role not set correctly (case-sensitive)

**Solution**:
```sql
-- Must be exactly 'super_admin' (lowercase with underscore)
SET LOCAL app.current_user_role = 'super_admin';
```

### Issue: Slow query performance

**Cause**: Missing indexes or inefficient RLS policies

**Solution**:
```sql
-- Check if indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'users';

-- Verify RLS performance indexes are present
-- idx_users_tenant_id_id
-- idx_tickets_tenant_id_id
-- idx_compliance_frameworks_tenant_id_id
```

## Next Steps

After validating RLS implementation:

1. Integrate RLS context setting into authentication middleware
2. Update all API routes to set session variables
3. Add RLS context to database connection pool
4. Implement property-based tests for RLS
5. Monitor query performance in production
6. Set up alerts for RLS policy violations

## References

- [RLS_IMPLEMENTATION.md](./RLS_IMPLEMENTATION.md) - Complete implementation documentation
- [0027_tenant_row_level_security.sql](./0027_tenant_row_level_security.sql) - Migration file
- PostgreSQL RLS Documentation: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
