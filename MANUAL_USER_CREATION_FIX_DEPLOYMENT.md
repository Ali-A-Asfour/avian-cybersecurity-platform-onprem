# Manual User Creation Fix Deployment Guide

## Issue Fixed
Security Analyst and IT Helpdesk Analyst user creation was failing with "invalid data entry" because:
1. The form required tenant assignment but these are cross-tenant roles
2. The database enum was missing `security_analyst` and `it_helpdesk_analyst` values

## Files Updated
- `src/components/admin/users/UserManagement.tsx` - Auto-assigns cross-tenant roles to default tenant
- `src/app/api/users/route.ts` - Updated validation to allow cross-tenant roles
- `src/services/user.service.ts` - Auto-assigns tenant for cross-tenant roles

## Manual Deployment Steps

### Step 1: Update Database Enum (Already Done)
The database enum has been updated with the missing values. You can verify with:
```bash
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT unnest(enum_range(NULL::user_role));"
```

### Step 2: Rebuild Docker Container
Run these commands on the server:

```bash
cd /home/avian/avian-cybersecurity-platform-onprem

# Stop containers
sudo docker-compose -f docker-compose.prod.yml down

# Rebuild app container with no cache
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
sleep 30

# Check status
sudo docker-compose -f docker-compose.prod.yml ps
```

### Step 3: Test User Creation
1. Login to https://192.168.1.116
2. Go to Super Admin > User Management  
3. Click "Create New User"
4. Try creating a Security Analyst:
   - Email: `security.analyst@test.com`
   - First Name: `Security`
   - Last Name: `Analyst`
   - Role: `Security Analyst`
   - Password: `admin123`
   - The tenant field should be auto-filled and disabled
5. Try creating an IT Helpdesk Analyst:
   - Email: `helpdesk.analyst@test.com`
   - First Name: `Helpdesk`
   - Last Name: `Analyst`
   - Role: `IT Helpdesk Analyst`
   - Password: `admin123`
   - The tenant field should be auto-filled and disabled

## Expected Results
- ✅ Security Analyst and IT Helpdesk Analyst users can be created successfully
- ✅ These roles are automatically assigned to the default tenant
- ✅ The tenant field shows as disabled with explanatory text for cross-tenant roles
- ✅ No more "invalid data entry" errors

## Verification
After creating the users, verify they exist in the database:
```bash
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT email, first_name, last_name, role FROM users WHERE role IN ('security_analyst', 'it_helpdesk_analyst');"
```