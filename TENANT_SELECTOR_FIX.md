# Tenant Selector Fix - Show All Tenants for Cross-Tenant Users

## 🐛 The Problem
Security Analysts and IT Helpdesk Analysts couldn't see all tenants in the "Select Client Tenant" page because:
- The TenantSelector component was calling `/api/tenants` 
- This endpoint returns "Insufficient permissions" for cross-tenant users
- Only Super Admins can access `/api/tenants`
- Cross-tenant users need `/api/super-admin/tenants` to see all tenants

## ✅ The Fix
Updated TenantSelector component to:
1. **Try super-admin endpoint first** - `/api/super-admin/tenants` for cross-tenant users
2. **Fallback to regular endpoint** - `/api/tenants` if super-admin fails
3. **Handle both response formats** - super-admin returns `data.data.tenants`, regular returns `data.data`
4. **Maintain authentication** - includes Bearer token in all requests

## 🚀 Deploy to Server

```bash
ssh avian@192.168.1.116
cd /home/avian/avian-cybersecurity-platform-onprem

# Rebuild container
sudo docker-compose -f docker-compose.prod.yml down
sudo docker rmi avian-cybersecurity-platform-onprem-app
sudo docker-compose -f docker-compose.prod.yml build --no-cache app
sudo docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Test the Fix

1. **Login as Security Analyst**: `security.analyst@company.com` / `admin123`
2. **Go to Help Desk page**: Should show tenant selector
3. **Verify all tenants visible**: Should see both "esr" and "test" tenants
4. **Select a tenant**: Should work without errors
5. **Access help desk features**: Should work for selected tenant

## ✅ Expected Results
- ✅ Security Analysts can see all available tenants
- ✅ IT Helpdesk Analysts can see all available tenants  
- ✅ Tenant selection works properly
- ✅ Help desk functionality works for selected tenant
- ✅ No more "Insufficient permissions" errors

The fix ensures cross-tenant users can access all tenants they need to manage while maintaining proper authentication and fallback behavior.