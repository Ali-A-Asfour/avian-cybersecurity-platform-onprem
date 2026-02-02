# Manual Tenant Selector Fix Deployment

## Files Updated
✅ `src/services/tenant.service.ts` - Updated permissions to allow Security Analysts and IT Helpdesk Analysts to list tenants
✅ `src/app/api/super-admin/tenants/route.ts` - Updated permissions to allow cross-tenant users

## Manual Deployment Steps

SSH into the server and run these commands:

```bash
# Navigate to project directory
cd /home/avian/avian-cybersecurity-platform-onprem

# Stop containers
sudo docker-compose -f docker-compose.prod.yml down

# Remove old image to force rebuild
sudo docker rmi avian-cybersecurity-platform-onprem-app || true

# Rebuild with no cache
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d

# Check container status
sudo docker-compose -f docker-compose.prod.yml ps
```

## Testing the Fix

1. **Login as Security Analyst**: `security.analyst@company.com` / `admin123`
2. **Login as IT Helpdesk Analyst**: `helpdesk.analyst@company.com` / `admin123`

3. **Test Tenant Selector in Help Desk**:
   - Go to Help Desk page
   - Should see tenant selector showing all available tenants
   - Should be able to select different tenants

4. **Test Header Tenant Switcher**:
   - Look for "Switch Tenant (Dev Mode)" dropdown in header
   - Should show all tenants instead of just "ACME Corp"
   - Should be able to switch between tenants

## Expected Results

- **Before Fix**: Only saw "ACME Corporation" or got 401 errors
- **After Fix**: Should see all tenants: "esr", "test", "Default Organization"

## API Testing

You can also test the API directly:

```bash
# Login as Security Analyst
curl -X POST "https://192.168.1.116/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "security.analyst@company.com", "password": "admin123"}' \
  -k

# Use the returned token to test tenant API
curl -X GET "https://192.168.1.116/api/super-admin/tenants" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -k
```

Should return all tenants instead of permission error.

## Root Cause Fixed

The issue was that `TenantService.listTenants()` and `/api/super-admin/tenants` only allowed `super_admin` role to list tenants. Cross-tenant users (Security Analysts and IT Helpdesk Analysts) need to see all tenants to select which one to work with.

**Fix Applied**: Updated permission checks to allow `security_analyst` and `it_helpdesk_analyst` roles to access tenant listing APIs.