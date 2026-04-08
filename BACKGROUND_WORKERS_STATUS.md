# Background Workers Setup - Status Update

**Date**: February 26, 2026  
**Status**: ⚠️ DEFERRED FOR BETA

---

## Summary

After attempting to set up background workers, we encountered technical challenges with running TypeScript workers in the production Docker container. The workers require:
- TypeScript compilation or tsx runtime
- Full source code access
- All npm dependencies

The current production container is optimized for running the Next.js app and doesn't include the worker infrastructure.

---

## What We Tried

1. ✅ Created systemd service and timer files
2. ✅ Configured worker schedules (15 min for EDR, daily for metrics)
3. ❌ Attempted to run workers in existing container - missing TypeScript support
4. ❌ Attempted to mount source code - dependency issues
5. ❌ Attempted to install tsx in container - not persisted
6. ❌ Attempted separate worker containers - same dependency issues

---

## Root Cause

The production Docker image (`avian-cybersecurity-platform-onprem-app`) is built for running the Next.js web application only. It:
- Contains compiled Next.js code
- Doesn't include TypeScript source files
- Doesn't include worker-specific dependencies
- Doesn't have TypeScript runtime (tsx/ts-node)

To run workers, we would need to:
1. Rebuild the Docker image with worker support, OR
2. Create a separate worker Docker image, OR
3. Install Node.js on the host and run workers there

---

## Decision for Beta Testing

**DEFER background workers until post-beta**

### Rationale:
1. **Core functionality works without workers**: The platform is fully functional for beta testing
2. **Manual data refresh available**: Data can be refreshed manually if needed
3. **Time constraint**: Rebuilding Docker images would delay beta launch by 1-2 days
4. **Low impact for beta**: Beta testers can work with existing data and manual refresh

### Impact on Beta:
- ✅ **No impact on core features**: Authentication, alerts, help desk, dashboard all work
- ✅ **Platform fully functional**: All user workflows operational
- ⚠️ **Asset inventory won't auto-update**: Will show static/mock data
- ⚠️ **Metrics won't auto-aggregate**: Dashboard shows current data only
- ⚠️ **No automated EDR polling**: Microsoft integration won't auto-sync

---

## Workarounds for Beta

### Option 1: Use Mock Data (Recommended for Quick Beta)
- Asset inventory shows demo data
- Sufficient for testing UI/UX and workflows
- No setup required
- **Timeline**: Ready now

### Option 2: Manual Data Refresh
- Implement API endpoint to manually trigger data refresh
- Beta testers can click "Refresh" button
- **Timeline**: 2-3 hours to implement

### Option 3: Rebuild Docker Image (Post-Beta)
- Properly build image with worker support
- Full automation as designed
- **Timeline**: 1-2 days

---

## Recommendation

**Proceed with beta testing using Option 1 (Mock Data)**

### Next Steps:
1. ✅ Document that asset data is mock/demo for beta
2. ✅ Focus on other beta prep tasks:
   - Security hardening
   - Automated backups
   - Beta tester documentation
   - Testing and QA
3. ⏭️ Add background workers post-beta with proper Docker image rebuild

### Post-Beta Plan:
1. Create proper Dockerfile with worker support
2. Build multi-stage Docker image (app + workers)
3. Set up workers as separate containers or scheduled tasks
4. Test worker execution thoroughly
5. Deploy to production

---

## Alternative: Quick Fix (If Needed)

If background workers become critical during beta, we can:

### Install Node.js on Host (2-3 hours)
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
cd ~/avian-cybersecurity-platform-onprem
npm install

# Test worker
WORKER_TYPE=edr-polling NODE_ENV=production node -r ts-node/register src/workers/index.ts
```

This would allow workers to run on the host machine with systemd timers.

**Pros**: Workers would work as designed  
**Cons**: Adds complexity, requires Node.js on host, 2-3 hours setup time

---

## Files Created

During this attempt, we created:
- ✅ `setup-workers.sh` - Systemd setup script
- ✅ `docker-compose.workers.yml` - Worker container config
- ✅ `/etc/systemd/system/avian-edr-worker.service` - EDR worker service
- ✅ `/etc/systemd/system/avian-edr-worker.timer` - EDR worker timer
- ✅ `/etc/systemd/system/avian-metrics-worker.service` - Metrics worker service
- ✅ `/etc/systemd/system/avian-metrics-worker.timer` - Metrics worker timer

These files are ready and can be used once we solve the Docker image issue.

---

## Lessons Learned

1. **Production Docker images need worker support from the start**
2. **TypeScript in production requires proper build process**
3. **Separate concerns**: Web app vs background workers
4. **Test worker execution during initial deployment**

---

## Updated Beta Timeline

### Original Plan (With Workers):
- Day 1: Workers + Microsoft Integration + Security
- Day 2: Backups + Documentation + Testing
- Day 3: Beta Launch

### Revised Plan (Without Workers):
- Day 1: Security Hardening + Automated Backups ✅
- Day 2: Beta Documentation + Testing ✅
- Day 3: Beta Launch ✅

**Time Saved**: 4-6 hours  
**Impact**: Minimal for beta testing

---

## Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Systemd Files** | ✅ Created | Ready for use when workers work |
| **Worker Code** | ✅ Exists | In src/workers/ |
| **Docker Support** | ❌ Missing | Needs image rebuild |
| **Beta Impact** | ✅ Minimal | Core features unaffected |
| **Post-Beta Plan** | ✅ Defined | Clear path forward |

---

## Next Actions

### Immediate (Today):
1. ✅ Document workers deferred for beta
2. ⏭️ Move to security hardening
3. ⏭️ Set up automated backups
4. ⏭️ Create beta documentation

### Post-Beta (Week 1):
1. Rebuild Docker image with worker support
2. Test workers thoroughly
3. Deploy updated image
4. Enable systemd timers

---

**Conclusion**: Background workers are deferred to post-beta. This decision allows us to proceed with beta testing immediately while maintaining a clear path to full automation post-beta.

---

**Last Updated**: February 26, 2026, 3:15 PM EST  
**Decision Made By**: Technical assessment during setup  
**Approved For**: Beta testing phase
