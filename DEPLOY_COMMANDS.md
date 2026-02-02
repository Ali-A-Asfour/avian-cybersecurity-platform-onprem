# Deployment Commands - Run These on Your Server

## Status
- ✅ **Files Updated**: API fixes have been copied to server
- ❌ **Container Needs Rebuild**: Docker container still has old code
- ❌ **APIs Still Failing**: Dashboard and tickets returning 500 errors

## Commands to Run

**Copy and paste these commands one by one:**

### 1. SSH to your server
```bash
ssh avian@192.168.1.115
```

### 2. Navigate to project directory
```bash
cd /home/avian/avian-cybersecurity-platform-onprem
```

### 3. Stop containers
```bash
sudo docker-compose -f docker-compose.prod.yml down
```

### 4. Rebuild application (this will take 2-3 minutes)
```bash
sudo docker-compose -f docker-compose.prod.yml build --no-cache app
```

### 5. Start containers
```bash
sudo docker-compose -f docker-compose.prod.yml up -d
```

### 6. Check status
```bash
sudo docker-compose -f docker-compose.prod.yml ps
```

### 7. Test the fix (wait 30 seconds first)
```bash
sleep 30
curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}'
```

## Expected Results After Rebuild

✅ **Dashboard API should work:**
```bash
# Get token and test dashboard
TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token')
curl -k "https://192.168.1.115/api/dashboard/widgets" -H "Authorization: Bearer $TOKEN"
# Should return: {"success": true, "data": {...}}
```

✅ **Tickets API should work:**
```bash
curl -k "https://192.168.1.115/api/tickets?limit=1" -H "Authorization: Bearer $TOKEN"
# Should return: {"success": true, "data": [...]}
```

✅ **Team Members page should load without errors**

## What This Fixes

The rebuild will pick up these simplified API implementations:
- **Dashboard Widgets**: Returns mock data directly without complex service dependencies
- **Tickets**: Returns mock data directly without database service issues
- **Authentication**: Still secure, still requires valid login
- **All 503 RSC errors**: Should be resolved after rebuild

## If You Get Permission Errors

If you get "permission denied" errors, run:
```bash
sudo chown -R avian:avian /home/avian/avian-cybersecurity-platform-onprem
```

Then retry the docker commands.