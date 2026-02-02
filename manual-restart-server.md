# Manual Server Restart Instructions

The code files have been successfully deployed to your server, but the Docker container needs to be restarted to pick up the changes.

## Files Successfully Deployed ✅
- `src/components/help-desk/ClosedTicketsQueue.tsx` - Fixed routing
- `src/app/help-desk/tickets/[id]/page.tsx` - Read-only ticket details  
- `src/components/help-desk/TicketTimeline.tsx` - Read-only timeline

## Manual Restart Required

**SSH to your server and run these commands:**

```bash
ssh avian@192.168.1.116

cd /home/avian/avian-cybersecurity-platform-onprem

# Stop containers
sudo docker-compose -f docker-compose.prod.yml down

# Rebuild app container
sudo docker-compose -f docker-compose.prod.yml build app

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d

# Check status
sudo docker-compose -f docker-compose.prod.yml ps
```

## Test After Restart

1. Login to https://192.168.1.116 with h@tcc.com / 12345678
2. Go to Help Desk → Closed Tickets tab
3. You should see closed tickets (if any exist from our earlier fix)
4. Click "View" on any ticket
5. **Expected Result**: Ticket details should open in new tab without 404 error
6. **Expected Result**: Ticket should be read-only (no actions, no comment form)

## What Was Fixed

- **Routing**: Changed from `/tickets/[id]` to `/help-desk/tickets/[id]`
- **Read-Only Mode**: Closed tickets now show read-only interface
- **No Editing**: Hidden actions and comment forms for resolved/closed tickets
- **Clear Status**: Added "Ticket Resolved" notice banner