# Client Selector Fix for Security Analyst Alerts

## Issue
The client selector in the security analyst view isn't working - showing the same alerts in all clients and in "My Alerts".

## Root Cause Analysis

The infrastructure is already in place:
1. ✅ `DemoTenantSwitcher` component sets `window.__SELECTED_TENANT_ID__`
2. ✅ API client reads `window.__SELECTED_TENANT_ID__` and adds `x-selected-tenant-id` header
3. ✅ Tenant middleware checks for `x-selected-tenant-id` header for cross-tenant users
4. ✅ Alerts API uses tenant from middleware

However, there are potential issues:
1. The tenant switcher might not be loading tenants properly
2. The selected tenant might not be persisting across page loads
3. The global variable might not be set before API calls are made

## Solution

### Step 1: Add Session Storage Persistence

Update `DemoContext.tsx` to persist selected tenant in sessionStorage:

```typescript
function handleSetCurrentTenant(tenant: { id: string; name: string; key: string } | null) {
  setCurrentTenant(tenant);
  
  // Set global variable for API client to use
  if (typeof window !== 'undefined') {
    if (tenant) {
      (window as any).__SELECTED_TENANT_ID__ = tenant.id;
      sessionStorage.setItem('selectedTenantId', tenant.id);
      sessionStorage.setItem('selectedTenant', JSON.stringify(tenant));
      console.log('DemoContext: Set global tenant ID:', tenant.id);
    } else {
      delete (window as any).__SELECTED_TENANT_ID__;
      sessionStorage.removeItem('selectedTenantId');
      sessionStorage.removeItem('selectedTenant');
      console.log('DemoContext: Cleared global tenant ID');
    }
  }
}
```

### Step 2: Load Persisted Tenant on Mount

Add useEffect to load persisted tenant:

```typescript
// Load persisted tenant from sessionStorage on mount
useEffect(() => {
  if (typeof window !== 'undefined') {
    const savedTenant = sessionStorage.getItem('selectedTenant');
    if (savedTenant) {
      try {
        const tenant = JSON.parse(savedTenant);
        setCurrentTenant(tenant);
        (window as any).__SELECTED_TENANT_ID__ = tenant.id;
        console.log('DemoContext: Restored tenant from session:', tenant.id);
      } catch (error) {
        console.error('DemoContext: Failed to parse saved tenant:', error);
      }
    }
  }
}, []);
```

### Step 3: Ensure API Client Waits for Tenant

Update `api-client.ts` to ensure tenant ID is available:

```typescript
/**
 * Get the selected tenant ID from DemoContext (for cross-tenant users)
 */
function getSelectedTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try multiple sources in order of preference
  // 1. Global variable (set by DemoContext)
  const globalTenant = (window as any).__SELECTED_TENANT_ID__;
  if (globalTenant) {
    console.log('🌐 API Client: Found selected tenant ID from global:', globalTenant);
    return globalTenant;
  }
  
  // 2. Session storage (fallback)
  const sessionTenant = sessionStorage.getItem('selectedTenantId');
  if (sessionTenant) {
    console.log('🌐 API Client: Found selected tenant ID from session:', sessionTenant);
    return sessionTenant;
  }
  
  console.log('🌐 API Client: No selected tenant ID found');
  return null;
}
```

### Step 4: Add Debug Logging to Tenant Middleware

The tenant middleware already has good logging. Verify it's working by checking browser console for:
- `🏢 Tenant middleware: User role: security_analyst`
- `🏢 Tenant middleware: Selected tenant header: <tenant-id>`

### Step 5: Verify Tenant Switcher Loads Tenants

Check that `DemoTenantSwitcher` is loading tenants properly:
1. Open browser console
2. Look for "TenantSwitcher: Loading tenants for role: security_analyst"
3. Look for "TenantSwitcher: Mapped tenant options: [...]"

## Testing Steps

1. **Login as Security Analyst**
   - Email: `analyst@avian.local`
   - Password: `analyst123`

2. **Check Tenant Switcher**
   - Look for 🏢 icon in header
   - Click it to see available tenants
   - Verify multiple tenants are listed

3. **Switch Tenants**
   - Select different tenant from dropdown
   - Check browser console for:
     - "TenantSwitcher: Switching to tenant: ..."
     - "DemoContext: Set global tenant ID: ..."
     - "🌐 API Client: Found selected tenant ID: ..."
     - "🏢 Tenant middleware: Selected tenant header: ..."

4. **Verify Alerts Filter**
   - Go to Alerts & Incidents page
   - Check "All Alerts" tab
   - Switch tenants using 🏢 selector
   - Verify alerts change based on selected tenant

5. **Check My Alerts**
   - Investigate an alert (moves to My Alerts)
   - Switch tenants
   - Verify My Alerts only shows alerts for selected tenant

## Expected Behavior

- **All Alerts Tab**: Shows unassigned alerts for selected tenant only
- **My Alerts Tab**: Shows alerts assigned to current user for selected tenant only
- **Tenant Switcher**: Shows all tenants the security analyst has access to
- **Persistence**: Selected tenant persists across page refreshes

## Debugging

If alerts still show for all tenants:

1. **Check Browser Console**
   ```
   Look for these log messages:
   - "TenantSwitcher: Switching to tenant: ..."
   - "DemoContext: Set global tenant ID: ..."
   - "🌐 API Client: Found selected tenant ID: ..."
   - "🏢 Tenant middleware: Selected tenant header: ..."
   ```

2. **Check Network Tab**
   - Open DevTools → Network
   - Filter for "alerts" requests
   - Check Request Headers for `x-selected-tenant-id`

3. **Check Database**
   ```sql
   -- Verify alerts have different tenant_id values
   SELECT id, title, tenant_id, status FROM security_alerts LIMIT 10;
   
   -- Check tenant distribution
   SELECT tenant_id, COUNT(*) FROM security_alerts GROUP BY tenant_id;
   ```

4. **Check User Role**
   ```sql
   -- Verify user is security_analyst
   SELECT id, email, role, tenant_id FROM users WHERE email = 'analyst@avian.local';
   ```

## Files to Modify

1. `src/contexts/DemoContext.tsx` - Add sessionStorage persistence
2. `src/lib/api-client.ts` - Add fallback to sessionStorage
3. Test and verify the fix works

## Rollback Plan

If the fix causes issues:
1. Remove sessionStorage code from DemoContext
2. Remove sessionStorage fallback from api-client
3. The system will fall back to using user's default tenant
