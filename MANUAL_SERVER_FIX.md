# Manual Server Fix for User Creation

## The Problem
The user creation is still failing with a database insert error. This suggests either:
1. The Docker container wasn't rebuilt with the new code
2. There's a database schema issue
3. The audit logging is causing the failure

## Manual Fix Steps

### Step 1: SSH into the server
```bash
ssh avian@192.168.1.116
cd /home/avian/avian-cybersecurity-platform-onprem
```

### Step 2: Check current container status
```bash
sudo docker-compose -f docker-compose.prod.yml ps
```

### Step 3: Force complete rebuild
```bash
# Stop all containers
sudo docker-compose -f docker-compose.prod.yml down

# Remove the app image to force rebuild
sudo docker rmi avian-cybersecurity-platform-onprem-app

# Rebuild with no cache
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d
```

### Step 4: Wait and check status
```bash
# Wait for containers to start
sleep 30

# Check status
sudo docker-compose -f docker-compose.prod.yml ps

# Check logs if there are issues
sudo docker-compose -f docker-compose.prod.yml logs app
```

### Step 5: Verify database enum
```bash
# Check if the enum values exist
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT unnest(enum_range(NULL::user_role));"
```

### Step 6: Test user creation
After the rebuild, try creating a user through the web interface:
1. Go to https://192.168.1.116
2. Login as admin@avian.local
3. Go to Super Admin > User Management
4. Try creating a Security Analyst user with manual tenant selection

## Alternative: Disable Audit Logging Temporarily

If the issue persists, it might be the audit logging causing the failure. You can temporarily disable it by editing the UserService:

```bash
# Edit the user service file
nano src/services/user.service.ts
```

Find the line with `await this.logAuditEvent` and comment it out:
```typescript
// await this.logAuditEvent({
//   tenant_id: data.tenant_id,
//   user_id: createdBy,
//   action: 'user.created',
//   resource_type: 'user',
//   resource_id: newUser.id,
//   details: {
//     email: data.email,
//     role: data.role,
//     tenant_id: data.tenant_id,
//   },
// });
```

Then rebuild the container again.

## Expected Result
After the rebuild, user creation should work for all roles including Security Analyst and IT Helpdesk Analyst, with manual tenant selection required for all roles.