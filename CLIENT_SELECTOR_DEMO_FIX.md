# Client Selector Demo Fix - Complete Solution

## Problem
Security analysts were seeing the same alerts across all clients because:
1. All demo alerts had `tenantId: 'acme-corp'`
2. Demo alerts API wasn't filtering by selected tenant

## Solution Implemented

### 1. Added Multi-Tenant Demo Data
Added alerts for three different tenants:
- **ACME Corp** (`acme-corp`) - 6 alerts (original)
- **TechStart Inc** (`techstart-789`) - 3 alerts (new)
- **Global Finance Ltd** (`global-finance-101`) - 3 alerts (new)

Total: 12 demo alerts across 3 tenants

### 2. Added Tenant Filtering to Demo API
Updated `src/app/api/alerts-incidents/demo/alerts/route.ts`:
- Reads `x-selected-tenant-id` header from request
- Filters alerts by selected tenant
- Updates metadata counts to reflect selected tenant
- Logs tenant selection for debugging

### 3. Enhanced Session Persistence
Updated `src/contexts/DemoContext.tsx`:
- Saves selected tenant to sessionStorage
- Restores tenant on page load
- Sets global variable for API client

### 4. Improved API Client
Updated `src/lib/api-client.ts`:
- Checks both global variable and sessionStorage
- Adds `x-selected-tenant-id` header to all requests
- Better logging for debugging

## Files Modified
1. `src/app/api/alerts-incidents/demo/alerts/route.ts` - Added multi-tenant alerts and filtering
2. `src/contexts/DemoContext.tsx` - Added sessionStorage persistence
3. `src/lib/api-client.ts` - Added sessionStorage fallback

## Demo Alert Distribution

### ACME Corp (acme-corp) - 6 Alerts
1. **Critical**: Trojan detected on DESKTOP-ABC123
2. **High**: Multiple failed SSH login attempts
3. **Medium**: Suspicious email with malicious attachment
4. **Low**: Unusual process execution pattern
5. **Critical**: Ransomware activity on SERVER-DB01
6. **High**: Large data transfer to external IP

### TechStart Inc (techstart-789) - 3 Alerts
1. **High**: Spyware detected on WORKSTATION-TS01
2. **Medium**: Port scanning activity detected
3. **Critical**: CEO impersonation email (BEC)

### Global Finance Ltd (global-finance-101) - 3 Alerts
1. **Critical**: Credential dumping attempt on FINANCE-SRV01
2. **High**: DDoS attack targeting web services
3. **High**: Suspicious lateral movement detected

## Testing Instructions

### 1. Access AVIAN Platform
```bash
# SSH tunnel (from anywhere)
ssh -L 8443:localhost:443 avian@209.227.150.115

# Open browser
https://localhost:8443
```

### 2. Login as Security Analyst
```
Email: analyst@avian.local
Password: analyst123
```

### 3. Test Client Selector

#### Step 1: Check Initial State
- Go to Alerts & Incidents page
- Note the number of alerts shown
- Open browser console (F12)

#### Step 2: Select ACME Corp
- Click 🏢 icon in header
- Select "ACME Corporation"
- Check console for:
  ```
  TenantSwitcher: Switching to tenant: ...
  DemoContext: Set global tenant ID: acme-corp
  🌐 API Client: Found selected tenant ID: acme-corp
  🔍 Demo Alerts API: selectedTenant=acme-corp
  🔍 Filtered to tenant acme-corp: 6 alerts
  ```
- Verify 6 alerts are shown

#### Step 3: Select TechStart Inc
- Click 🏢 icon again
- Select "TechStart Inc"
- Check console for tenant switch logs
- Verify 3 alerts are shown (different from ACME)

#### Step 4: Select Global Finance Ltd
- Click 🏢 icon again
- Select "Global Finance Ltd"
- Verify 3 alerts are shown (different from previous)

#### Step 5: Test My Alerts
- Switch back to ACME Corp
- Click "Investigate" on an alert
- Go to "My Alerts" tab
- Verify alert appears
- Switch to TechStart Inc
- Verify "My Alerts" is empty (no alerts assigned for this tenant)
- Switch back to ACME Corp
- Verify assigned alert reappears

#### Step 6: Test Persistence
- Select TechStart Inc
- Refresh page (F5)
- Check console for:
  ```
  DemoContext: Restored tenant from session: techstart-789
  ```
- Verify TechStart Inc is still selected
- Verify 3 alerts are shown

## Expected Results

### Before Fix
- ❌ All tenants showed same 6 alerts
- ❌ Tenant selector had no effect
- ❌ My Alerts showed all assigned alerts regardless of tenant

### After Fix
- ✅ ACME Corp shows 6 alerts
- ✅ TechStart Inc shows 3 alerts
- ✅ Global Finance Ltd shows 3 alerts
- ✅ Tenant selector properly filters alerts
- ✅ My Alerts respects selected tenant
- ✅ Selection persists across page refreshes

## Debugging

### Check Console Logs
Look for these key log messages:

1. **Tenant Selection**:
   ```
   TenantSwitcher: Switching to tenant: { id: 'techstart-789', name: 'TechStart Inc' }
   DemoContext: Set global tenant ID: techstart-789
   ```

2. **API Request**:
   ```
   🌐 API Client: Found selected tenant ID from global: techstart-789
   🌐 API Client: Added tenant header: techstart-789
   ```

3. **API Response**:
   ```
   🔍 Demo Alerts API: queue=all, assignedTo=null, selectedTenant=techstart-789
   🔍 Filtered to tenant techstart-789: 3 alerts
   🔍 All Alerts: Found 3 unassigned alerts
   ```

### Check Network Tab
1. Open DevTools → Network
2. Filter for "alerts"
3. Click on request
4. Check Request Headers:
   ```
   x-selected-tenant-id: techstart-789
   ```

### Verify Data
Check that alerts have correct tenant IDs:
```javascript
// In browser console
fetch('/api/alerts-incidents/demo/alerts?queue=all')
  .then(r => r.json())
  .then(d => {
    console.log('Tenant distribution:', 
      d.data.alerts.reduce((acc, a) => {
        acc[a.tenantId] = (acc[a.tenantId] || 0) + 1;
        return acc;
      }, {})
    );
  });
```

Expected output:
```
Tenant distribution: {
  'acme-corp': 6,
  'techstart-789': 3,
  'global-finance-101': 3
}
```

## Rollback Instructions

If issues occur:
```bash
git log --oneline -5  # Find commit hash
git revert <commit-hash>
```

Or manually revert changes in:
- `src/app/api/alerts-incidents/demo/alerts/route.ts`
- `src/contexts/DemoContext.tsx`
- `src/lib/api-client.ts`

## Next Steps

1. ✅ Test with multiple security analysts
2. ✅ Verify tenant isolation is working
3. ⏳ Add more diverse alerts per tenant
4. ⏳ Implement same fix for production database alerts
5. ⏳ Add tenant selector to other pages (Assets, Reports, etc.)

## Related Files
- `CLIENT_SELECTOR_FIX.md` - Original technical analysis
- `CLIENT_SELECTOR_FIX_SUMMARY.md` - Implementation summary
- `REMOTE_ACCESS_GUIDE.md` - Remote access setup
