# Manual Tenant Switcher Fix Deployment

## Status: Files Copied ✅, Container Rebuild Required

The updated files have been successfully copied to the server. You now need to manually rebuild the Docker container to apply the changes.

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

## Changes Applied

✅ **Files Updated:**
- `src/components/layout/Header.tsx` - Shows tenant switcher for helpdesk analysts
- `src/app/help-desk/page.tsx` - Removed local tenant switcher, uses global selection
- `src/app/assets/page.tsx` - Consistent with global tenant selection
- `src/contexts/DemoContext.tsx` - Added currentTenant property
- `src/components/demo/TenantSwitcher.tsx` - Updates global tenant state

## Expected Behavior After Rebuild

1. **Header Tenant Switcher**: 
   - Shows for Super Admin, Security Analyst, and IT Helpdesk Analyst roles
   - Hidden for regular User and Tenant Admin roles

2. **Helpdesk Page**:
   - No longer has its own "Switch Tenant" button
   - Uses the tenant selected in the global header switcher
   - Shows message to select tenant if none selected

3. **Assets Page**:
   - Uses the same global tenant selection
   - Consistent behavior with helpdesk page

4. **Global Tenant Selection**:
   - Selecting a tenant in the header affects both helpdesk and assets pages
   - Tenant selection persists across page navigation

## Testing Instructions

After completing the manual rebuild:

1. **Login as helpdesk analyst**: `helpdesk.analyst@company.com` / `admin123`
2. **Check header**: Should see tenant selector in top right (🏢 Select Tenant)
3. **Select a tenant**: Choose "esr" or "test" from the dropdown
4. **Navigate to helpdesk**: Should show selected tenant, no local switcher
5. **Navigate to assets**: Should use the same selected tenant
6. **Switch tenants**: Use header selector, both pages should update

## Troubleshooting

If the changes don't appear after rebuild:
- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
- Check browser console for any JavaScript errors
- Verify container was actually rebuilt (check creation time)

## Verification Commands

```bash
# Check if container was rebuilt (look at creation time)
sudo docker-compose -f docker-compose.prod.yml ps

# Check container logs for any errors
sudo docker-compose -f docker-compose.prod.yml logs app

# Test API endpoints
curl -k "https://192.168.1.116/api/auth/me" -H "Authorization: Bearer <token>"
```