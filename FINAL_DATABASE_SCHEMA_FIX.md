# Database Schema Fix - Column Name Typos

## 🐛 The Problem
The database insert is failing because there are typos in the column names. The SQL query shows:
- `"ma_setup_completed"` instead of `"mfa_setup_completed"`
- `"ma_secret"` instead of `"mfa_secret"`

This means the actual database table has incorrect column names.

## 🔧 Fix Steps

### Step 1: SSH into the server
```bash
ssh avian@192.168.1.116
cd /home/avian/avian-cybersecurity-platform-onprem
```

### Step 2: Make the script executable and run it
```bash
chmod +x fix-database-schema.sh
./fix-database-schema.sh
```

### Step 3: Rebuild the Docker container
```bash
# Stop containers
sudo docker-compose -f docker-compose.prod.yml down

# Force rebuild
sudo docker rmi avian-cybersecurity-platform-onprem-app

# Build with no cache
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d
```

### Step 4: Wait and verify
```bash
# Wait for services to start
sleep 30

# Check container status
sudo docker-compose -f docker-compose.prod.yml ps
```

## 🧪 Test User Creation

After the fix:

1. Go to https://192.168.1.116
2. Login as `admin@avian.local`
3. Go to Super Admin > User Management
4. Try creating a Security Analyst or IT Helpdesk Analyst user
5. Select a tenant manually
6. The user should be created successfully without database errors

## 🔍 Manual Database Check (if needed)

If the script doesn't work, you can manually check and fix the columns:

```bash
# Check current column names
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND (column_name LIKE '%mfa%' OR column_name LIKE '%ma_%');"

# Fix column names if needed
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TABLE users RENAME COLUMN ma_secret TO mfa_secret;"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TABLE users RENAME COLUMN ma_setup_completed TO mfa_setup_completed;"
```

## ✅ Expected Result
After fixing the column names and rebuilding the container, user creation should work without any database insert errors.

The issue was that the database table had typos in the column names (`ma_secret` instead of `mfa_secret`), but the application code was trying to insert into the correctly named columns.