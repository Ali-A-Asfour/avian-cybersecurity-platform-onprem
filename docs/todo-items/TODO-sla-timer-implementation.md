# TODO: Implement StateManagementService for SLA Timer

## Issue
The `StateManagementService` file exists but is empty, causing ticket creation to fail when trying to initialize SLA timers.

## Current State
- **File**: `src/services/help-desk/StateManagementService.ts` (empty)
- **Workaround**: Wrapped `initializeSLATimer()` call in try-catch to make it non-blocking
- **Impact**: 
  - ✅ Tickets can be created successfully
  - ✅ SLA deadlines are stored in database
  - ❌ No real-time SLA monitoring/alerts
  - ❌ No background timers for approaching deadlines

## What Needs to Be Implemented

### StateManagementService Class
The service should provide:

1. **`initializeSLATimer(ticketId: string, slaDeadline: Date, status: TicketStatus): void`**
   - Set up background timer for SLA deadline
   - Track when deadline is approaching (e.g., 1 hour before, 30 minutes before)
   - Store timer state in Redis or memory

2. **SLA Monitoring Features**
   - Monitor all active tickets with SLA deadlines
   - Send notifications when deadlines are approaching
   - Alert help desk staff when SLA is breached
   - Update ticket status/priority when SLA is at risk

3. **Timer Management**
   - Start timers when tickets are created
   - Pause timers when tickets are resolved/closed
   - Resume timers if tickets are reopened
   - Cancel timers when tickets are deleted

4. **Integration Points**
   - Notification system (email/in-app alerts)
   - Ticket status updates
   - Help desk queue prioritization
   - Reporting/metrics for SLA compliance

## Implementation Approach

### Option 1: Redis-based Timers
- Use Redis pub/sub for timer events
- Store timer state in Redis with TTL
- Scalable across multiple server instances

### Option 2: In-Memory Timers
- Use Node.js `setTimeout` for timers
- Store in memory Map/Set
- Simpler but not scalable across instances

### Option 3: Database Polling
- Background job that polls database for approaching deadlines
- Check every 5-10 minutes
- Most reliable but higher database load

## Recommended Approach
Start with **Option 2 (In-Memory)** for MVP, then migrate to **Option 1 (Redis)** for production scalability.

## Files to Create/Modify
- `src/services/help-desk/StateManagementService.ts` - Main implementation
- `src/services/help-desk/__tests__/StateManagementService.test.ts` - Update tests
- `src/services/ticket.service.ts` - Remove try-catch workaround once implemented

## Priority
**Medium** - System works without it, but SLA monitoring is important for help desk operations

## Related Files
- `src/services/ticket.service.ts` (line 124-133) - Current workaround location
- `database/schemas/tenant.ts` (line 119) - SLA deadline field definition

## Notes
- SLA deadlines are calculated based on severity (see `TicketService.SLA_HOURS_BY_SEVERITY`)
- Current SLA hours: critical=4h, high=8h, medium=24h, low=48h
- Consider timezone handling for SLA calculations
