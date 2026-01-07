# React Hooks and Monitoring Database Fix - Complete

## Summary

Fixed React hooks rule violations and monitoring service database query errors that were causing application crashes.

## Date

January 7, 2026

## Issues Fixed

### 1. React Hooks Rule Violations ✅

**Problem:** React hooks were being called after conditional return statements, violating the Rules of Hooks.

**Error:** 
```
useEffect cannot be called after a conditional return
```

**Files Fixed:**
1. `src/app/threat-lake/page.tsx` - Moved `useEffect` before conditional return
2. `src/app/help-desk/page.tsx` - Moved all hooks before conditional returns, removed stray closing brace
3. `src/app/notifications/test/page.tsx` - Moved `useState` calls before conditional return

**Solution:**
All hooks must be called at the top level of the component, before any conditional returns:

```typescript
// ❌ WRONG
if (loading) {
  return null;
}
useEffect(() => { ... }, []); // Hook after return!

// ✅ CORRECT
useEffect(() => { ... }, []); // Hook before return
if (loading) {
  return null;
}
```

### 2. Monitoring Service Database Query Errors ✅

**Problem:** The monitoring service was using incorrect syntax for postgres.js queries, causing `client.query is not a function` errors.

**Error:**
```
Failed to flush metrics: TypeError: client.query is not a function
```

**Root Cause:**
The `postgres.js` library uses tagged template literals for queries, not a `.query()` method like `pg` does.

**Files Fixed:**
- `src/lib/monitoring.ts`

**Changes Made:**

1. **flushMetrics() method:**
```typescript
// ❌ WRONG (pg syntax)
await client.query(
  `INSERT INTO metrics (...) VALUES ($1, $2, $3)`,
  [value1, value2, value3]
);

// ✅ CORRECT (postgres.js syntax)
await client`
  INSERT INTO metrics (...)
  VALUES (${value1}, ${value2}, ${value3})
`;
```

2. **trackError() method:**
```typescript
// ❌ WRONG
await client.query(
  `INSERT INTO error_tracking (...) VALUES ($1, $2, $3)`,
  [error.name, error.message, error.stack]
);

// ✅ CORRECT
await client`
  INSERT INTO error_tracking (...)
  VALUES (${error.name}, ${error.message}, ${error.stack})
`;
```

3. **getMetricsSummary() method:**
```typescript
// ❌ WRONG
const result = await client.query(`SELECT COUNT(*) ...`);
const count = result.rows[0].count;

// ✅ CORRECT
const result = await client`SELECT COUNT(*) ...`;
const count = result[0]?.count || '0';
```

**Additional Improvements:**
- Added client validation before queries
- Improved error handling (silent in production, verbose in development)
- Added fallback values for failed database operations
- Prevented error tracking from breaking the application

## Technical Details

### postgres.js vs pg

The codebase uses `postgres.js` (imported as `postgres`), not `pg`. The key differences:

| Feature | pg | postgres.js |
|---------|-----|-------------|
| Query syntax | `client.query(sql, params)` | `` client`sql ${param}` `` |
| Result format | `result.rows[0]` | `result[0]` |
| Type | Callback/Promise | Tagged template |

### Error Handling Strategy

**Before:**
```typescript
catch (error) {
  console.error('Failed:', error); // Always logs
}
```

**After:**
```typescript
catch (error) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Failed:', error); // Only in dev
  }
  // Graceful degradation
}
```

This prevents log spam in production while maintaining debugging capability in development.

## Verification

### React Hooks
```bash
# No more hooks after conditional returns
grep -r "return null" src/app --include="*.tsx" -A 5 | grep -B 5 "useEffect\|useState"
# Result: Only hooks in separate components (which is fine)
```

### Monitoring Service
```bash
# Check for old .query() syntax
grep "client.query" src/lib/monitoring.ts
# Result: No matches (all converted to tagged templates)
```

## Impact

**Before:**
- Application crashed with React hooks violations
- Monitoring service flooded logs with database errors every 60 seconds
- Metrics and error tracking failed silently

**After:**
- All React components follow Rules of Hooks correctly
- Monitoring service uses correct postgres.js syntax
- Graceful error handling prevents application crashes
- Metrics and error tracking work correctly when database is available

## Files Modified

1. `src/lib/monitoring.ts` - Fixed all database queries to use postgres.js syntax
2. `src/app/threat-lake/page.tsx` - Fixed hooks order
3. `src/app/help-desk/page.tsx` - Fixed hooks order and removed syntax error
4. `src/app/notifications/test/page.tsx` - Fixed hooks order

## Status

✅ **COMPLETE** - All React hooks violations fixed, monitoring service database queries corrected.

## Next Steps

The application should now:
1. Render without React hooks errors
2. Store metrics and errors in the database correctly
3. Not flood logs with database query errors
4. Gracefully handle database unavailability

If the database tables don't exist yet, run the migration:
```bash
psql $DATABASE_URL -f database/migrations/0029_monitoring_tables.sql
```
