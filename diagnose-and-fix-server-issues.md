# Server Issues Diagnosis and Fix Guide

## Current Status
- **Authentication**: ✅ Working (login, /api/auth/me, /api/users endpoints work)
- **Dashboard API**: ❌ 500 errors (/api/dashboard/widgets fails)
- **Tickets API**: ❌ 500 errors (/api/tickets fails)
- **RSC Requests**: ❌ 503 errors (all ?_rsc= requests fail)
- **Team Members Page**: ❌ Cannot access due to RSC failures

## Root Cause Analysis
The issue appears to be **database-related**:
1. **Basic auth endpoints work** (users table accessible)
2. **Complex endpoints fail** (dashboard widgets, tickets)
3. **RSC requests fail** (server-side rendering issues)

## Likely Causes
1. **Missing database tables** for dashboard widgets or tickets
2. **Database connection pool exhaustion**
3. **Server memory/resource issues**
4. **Incomplete database migration**

## Manual Fix Steps

### Step 1: Check Server Status
```bash
ssh avian@192.168.1.115
cd /home/avian/avian-cybersecurity-platform-onprem
sudo docker-compose -f docker-compose.prod.yml ps
```

### Step 2: Check Application Logs
```bash
sudo docker-compose -f docker-compose.prod.yml logs --tail=50 app
```

### Step 3: Check Database Logs
```bash
sudo docker-compose -f docker-compose.prod.yml logs --tail=20 postgres
```

### Step 4: Restart Services (if needed)
```bash
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml up -d
```

### Step 5: Check Database Tables
```bash
sudo docker-compose -f docker-compose.prod.yml exec postgres psql -U avian -d avian -c "\dt"
```

### Step 6: Test API Endpoints
```bash
# Get fresh token
TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token')

# Test working endpoint
curl -k "https://192.168.1.115/api/users" -H "Authorization: Bearer $TOKEN"

# Test failing endpoints
curl -k "https://192.168.1.115/api/dashboard/widgets" -H "Authorization: Bearer $TOKEN"
curl -k "https://192.168.1.115/api/tickets?limit=1" -H "Authorization: Bearer $TOKEN"
```

## Expected Resolution
Once the database issues are resolved:
- ✅ Dashboard widgets API should return 200
- ✅ Tickets API should return 200  
- ✅ RSC requests should return 200
- ✅ Team members page should load properly
- ✅ All navigation should work without 503 errors

## Next Steps
1. **Run the manual steps above** to identify the specific database issue
2. **Check for missing tables** that dashboard/tickets endpoints need
3. **Verify database migrations** completed successfully
4. **Restart services** if needed to clear connection issues
5. **Test team members page** after API endpoints are working

The team members page issue is a **symptom** of the larger server-side database connectivity problem. Once the API endpoints return 200 status codes, the RSC requests should also start working properly.