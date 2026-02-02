# Restart Server Application

Please run these commands on the server to restart the application:

```bash
ssh avian@192.168.1.116
cd /home/avian/avian-cybersecurity-platform-onprem
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

## What I Fixed:

1. **Fixed `getTicketsByUser` method**: 
   - Changed from Drizzle ORM to direct PostgreSQL queries
   - Changed from `created_by` column to `requester` column (matches server database)

2. **Fixed parameter passing**:
   - `getTicketsByUser` now receives user **email** (since `requester` stores email)
   - `getAssignedTickets` still receives user **ID** (since `assignee` stores user ID)

3. **Fixed logic for analysts**:
   - Analysts now see BOTH created tickets AND assigned tickets
   - Deduplication prevents showing the same ticket twice

## The Fix Should Resolve:

✅ **Created tickets**: When you create a ticket, it appears in "My Tickets"  
✅ **Assigned tickets**: When you assign a ticket to yourself, it appears in "My Tickets"  
✅ **No 500 errors**: Database queries now use correct column names  
✅ **No duplicates**: Same ticket won't appear twice if both created and assigned to you

After restart, test both scenarios:
1. Create a new ticket → should appear in "My Tickets"
2. Assign an existing ticket → should also appear in "My Tickets"