# Manual Ticket Assignment Fix Deployment

## Summary
The ticket assignment issue has been fixed locally and tested successfully. The problem was database schema compatibility - the code was using different column names than what exists in the database.

## Changes Made
1. **Updated database schema** (`database/schemas/tickets.ts`) to match existing database structure
2. **Fixed TicketService** (`src/services/ticket.service.ts`) to use correct column names (`assigned_to` instead of `assignee`)
3. **Fixed my-tickets API** (`src/app/api/help-desk/queue/my-tickets/route.ts`) to use email for assignment lookup

## Local Testing Results ✅
- ✅ Login works: `h@tcc.com` / `admin123`
- ✅ Ticket assignment API works: `POST /api/tickets/assign`
- ✅ Assigned tickets appear in "My Tickets" queue
- ✅ Assigned tickets removed from "Unassigned" queue
- ✅ Database properly updated with assignments

## Manual Deployment Steps

### Step 1: Copy Files to Server
```bash
# Copy updated files
scp database/schemas/tickets.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/database/schemas/
scp src/services/ticket.service.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/services/
scp src/app/api/help-desk/queue/my-tickets/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/
```

### Step 2: Restart Application on Server
```bash
ssh avian@192.168.1.116
cd /home/avian/avian-cybersecurity-platform-onprem
sudo docker-compose -f docker-compose.prod.yml restart app
```

### Step 3: Test the Fix
```bash
# Wait for app to start (15 seconds)
sleep 15

# Test login
curl -k -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"admin123"}'

# If login works, test ticket assignment in the web interface
```

## Expected Results After Deployment
1. **Login**: `h@tcc.com` / `admin123` should work
2. **Help Desk Queue**: Should show unassigned tickets
3. **"Assign to me" button**: Should work without "Failed to assign ticket" error
4. **My Tickets**: Should show tickets assigned to the user

## Files Changed
- `database/schemas/tickets.ts` - Updated to match existing database structure
- `src/services/ticket.service.ts` - Fixed column name compatibility
- `src/app/api/help-desk/queue/my-tickets/route.ts` - Fixed assignment lookup

## Database Compatibility Notes
The existing database uses:
- `assigned_to` column (not `assignee`)
- `varchar` types (not `uuid` for ticket IDs)
- `text[]` for tags (not `jsonb`)
- Check constraints instead of enum types

The schema and service have been updated to match this structure.