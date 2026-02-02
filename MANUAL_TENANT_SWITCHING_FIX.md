# Manual Tenant Switching and Ticket Visibility Fix

## Status: Files Copied ✅, Container Rebuild Required

The updated files have been successfully copied to the server. You now need to manually rebuild the Docker container to apply the fixes.

## Manual Steps Required

SSH into the server and run these commands:

```bash
ssh avian@192.168.1.116
cd /home/avian/avian-cybersecurity-platform-onprem

# Stop containers
sudo docker-compose -f docker-compose.prod.yml down

# Rebuild with no cache to ensure changes are applied
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d

# Check container status
sudo docker-compose -f docker-compose.prod.yml ps
```

## Issues Fixed

### ✅ **Issue 1: Tenant Switching Not Working**
- **Problem**: Selecting different tenants caused page refresh and reverted to "esr"
- **Root Cause**: `switchTenant` function was calling API that didn't persist changes
- **Solution**: Updated to use local context state without page refresh

### ✅ **Issue 2: Tickets Not Visible**
- **Problem**: Tickets created in one tenant weren't visible when switching tenants
- **Root Cause**: API calls weren't sending selected tenant ID to backend
- **Solution**: Added tenant ID headers to API requests for cross-tenant users

## Technical Changes Applied

1. **DemoTenantSwitcher**: Removed page refresh, uses context state
2. **Tenant Middleware**: Checks for `x-selected-tenant-id` header for cross-tenant users
3. **API Client**: Automatically adds selected tenant ID to request headers
4. **DemoContext**: Sets global tenant ID for API client to use

## Expected Behavior After Rebuild

### **Tenant Switching**:
- ✅ No page refresh when switching tenants
- ✅ Immediate context update
- ✅ Both helpdesk and assets pages reflect selected tenant
- ✅ Tenant selection persists during navigation

### **Ticket Visibility**:
- ✅ Tickets visible based on selected tenant
- ✅ Can create tickets in one tenant and see them when switching back
- ✅ Cross-tenant users see appropriate tickets for selected tenant

## Testing Instructions

After completing the manual rebuild:

1. **Login as helpdesk analyst**: `helpdesk.analyst@company.com` / `admin123`

2. **Test Tenant Switching**:
   - Click tenant selector in header (🏢 esr)
   - Select "test" - should switch without page refresh
   - Select "Default Organization" - should switch smoothly
   - Select "esr" - should return to original

3. **Test Ticket Visibility**:
   - Switch to "Default Organization" tenant
   - Go to helpdesk → My Tickets tab
   - Should see the existing ticket: "Persistent Ticket Test"
   - Switch to "esr" tenant - ticket should disappear
   - Switch back to "Default Organization" - ticket should reappear

4. **Test Ticket Creation**:
   - Switch to "esr" tenant
   - Create a new ticket
   - Switch to "test" tenant - new ticket should not be visible
   - Switch back to "esr" - new ticket should be visible

## Troubleshooting

If issues persist after rebuild:

1. **Clear browser cache**: Ctrl+F5 or Cmd+Shift+R
2. **Check browser console**: Look for tenant switching logs
3. **Verify API headers**: Check Network tab for `x-selected-tenant-id` header
4. **Check container logs**: `sudo docker-compose -f docker-compose.prod.yml logs app`

## Debug Information

The following console logs should appear when working correctly:

```
TenantSwitcher: Switching to tenant: {id: "...", name: "..."}
DemoContext: Set global tenant ID: ...
Tenant middleware: Using selected tenant ... for it_helpdesk_analyst
```

## Verification Commands

```bash
# Check if container was rebuilt (look at creation time)
sudo docker-compose -f docker-compose.prod.yml ps

# Test API with tenant header
curl -k "https://192.168.1.116/api/tickets" \
  -H "Authorization: Bearer <token>" \
  -H "x-selected-tenant-id: 1f9656a9-1d4a-4ebf-94db-45427789ba24"
```