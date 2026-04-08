# AVIAN Platform - Beta Testing Setup Guide

**Date**: February 2, 2026  
**Server**: 192.168.1.116 (Ubuntu 24.04.03)  
**Status**: Preparing for Beta Testing

---

## Current Status Overview

### ✅ Completed Components

1. **Core Platform Deployment**
   - Docker containers running (web, postgres, redis)
   - HTTPS enabled with self-signed certificates
   - Database schema fully deployed
   - Authentication system working
   - Multi-tenant architecture functional

2. **Working Features**
   - User authentication (login/logout)
   - User management (create, edit, delete users)
   - Tenant management (create, switch tenants)
   - Role-based access control (Super Admin, Tenant Admin, Security Analyst, IT Helpdesk)
   - Dashboard with metrics
   - Help desk ticketing system
   - Client/tenant selector (fixed and working)
   - Incident resolution modal (fixed)

3. **Remote Access**
   - SSH access configured: `ssh avian@209.227.150.115`
   - SSH tunneling for HTTPS: `ssh -L 8443:localhost:443 avian@209.227.150.115`
   - Access platform at: `https://localhost:8443`

4. **Demo Data**
   - 3 tenants configured: ESR, Test/Default Organization, Third tenant
   - Demo alerts distributed across tenants
   - Demo users for testing

---

## ❌ Missing/Incomplete Components for Beta

### 1. Microsoft Intune/Defender Integration (CRITICAL)

**Current State**: Placeholder credentials, not connected to real Microsoft services

**What's Needed**:
- [ ] Azure AD App Registration
- [ ] API permissions granted
- [ ] Client credentials configured
- [ ] Test connection to Microsoft Graph API
- [ ] Verify data collection from real tenant

**Impact**: Asset inventory showing mock data instead of real devices

**Priority**: HIGH - Core feature for cybersecurity platform

---

### 2. Email Alert Integration ⏭️ SKIPPED FOR BETA

**Current State**: Code implemented but not configured

**Decision**: SKIPPED - Not needed for beta testing

**Reason**: 
- Adds complexity without immediate value
- Microsoft Defender alerts work via EDR integration
- API/webhook alerts still functional
- Can be added post-beta if needed

**Impact**: 
- ✅ No impact on core functionality
- ❌ Cannot receive SonicWall alerts via email

**Priority**: LOW - Deferred to post-beta

---

### 3. Background Workers (IMPORTANT)

**Current State**: Code exists but not running as scheduled tasks

**What's Needed**:
- [ ] Set up systemd timers for workers
- [ ] Configure EDR polling worker (every 15 minutes)
- [ ] Configure metrics aggregation worker (daily)
- [ ] ~~Configure email alert worker~~ - SKIPPED FOR BETA
- [ ] Test worker execution and logging

**See**: `BACKGROUND_WORKERS_SETUP.md` for detailed setup guide

**Priority**: HIGH - Required for automated data collection

---

### 4. SSL/TLS Certificates (IMPORTANT)

**Current State**: Self-signed certificates (browser warnings)

**What's Needed**:
- [ ] Decide: Use Let's Encrypt or purchase commercial certificate
- [ ] Configure domain name (if using Let's Encrypt)
- [ ] Install proper SSL certificate
- [ ] Update nginx configuration
- [ ] Test HTTPS without browser warnings

**Priority**: MEDIUM - Better for beta testers, not blocking

---

### 5. Monitoring and Logging (RECOMMENDED)

**Current State**: Basic logging to console/files

**What's Needed**:
- [ ] Set up log rotation
- [ ] Configure log aggregation (optional)
- [ ] Set up basic health monitoring
- [ ] Create alerting for critical errors
- [ ] Document log locations

**Priority**: MEDIUM - Helpful for troubleshooting during beta

---

### 6. Backup and Recovery (RECOMMENDED)

**Current State**: No automated backups

**What's Needed**:
- [ ] Set up automated database backups
- [ ] Configure backup retention policy
- [ ] Test database restore procedure
- [ ] Document backup/restore process
- [ ] Set up backup monitoring

**Priority**: MEDIUM - Important for data protection

---

### 7. Performance Optimization (OPTIONAL)

**Current State**: Default configuration

**What's Needed**:
- [ ] Optimize PostgreSQL configuration for workload
- [ ] Configure Redis memory limits
- [ ] Set up connection pooling
- [ ] Enable query caching where appropriate
- [ ] Load testing

**Priority**: LOW - Can optimize based on beta feedback

---

### 8. Documentation (IMPORTANT)

**Current State**: Technical docs exist, user docs minimal

**What's Needed**:
- [ ] Beta tester onboarding guide
- [ ] User manual for each role
- [ ] Known issues/limitations document
- [ ] Feedback collection process
- [ ] FAQ document

**Priority**: HIGH - Critical for beta testers

---

### 9. Security Hardening (IMPORTANT)

**Current State**: Basic security in place

**What's Needed**:
- [ ] Review and harden firewall rules
- [ ] Disable unnecessary services
- [ ] Configure fail2ban for SSH protection
- [ ] Set up security update automation
- [ ] Review Docker security settings
- [ ] Implement rate limiting on API endpoints
- [ ] Security audit

**Priority**: HIGH - Important before external access

---

### 10. Testing and QA (CRITICAL)

**Current State**: Basic manual testing done

**What's Needed**:
- [ ] End-to-end testing of all workflows
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] Load testing with multiple users
- [ ] Security testing
- [ ] Create test scenarios for beta testers

**Priority**: HIGH - Must verify before beta

---

## Recommended Beta Testing Phases

### Phase 1: Internal Testing (1-2 weeks)
**Goal**: Verify core functionality with controlled users

**Participants**: 2-3 internal users
**Focus Areas**:
- Authentication and user management
- Tenant switching
- Alert viewing and management
- Help desk ticketing
- Basic workflows

**Success Criteria**:
- No critical bugs
- All core features functional
- Performance acceptable

---

### Phase 2: Limited Beta (2-4 weeks)
**Goal**: Test with real users and real data

**Participants**: 5-10 external beta testers
**Focus Areas**:
- Real Microsoft Intune/Defender integration
- Real alert data
- Multi-tenant scenarios
- User experience feedback
- Performance under load

**Success Criteria**:
- Positive user feedback
- No data loss incidents
- Acceptable performance
- Clear improvement roadmap

---

### Phase 3: Extended Beta (4-8 weeks)
**Goal**: Prepare for production release

**Participants**: 20-50 beta testers
**Focus Areas**:
- Scale testing
- Edge cases
- Integration scenarios
- Documentation completeness
- Support process

**Success Criteria**:
- <5 critical bugs
- >80% user satisfaction
- Documentation complete
- Support process validated

---

## Quick Start: Minimum Viable Beta

If you want to start beta testing ASAP with minimal setup:

### Must-Have (Blocking)
1. ✅ Platform deployed and accessible
2. ✅ Authentication working
3. ✅ Core features functional
4. ❌ **Microsoft Intune/Defender connected** (if asset management is core feature)
5. ❌ **Background workers running**
6. ❌ **Beta tester documentation**

### Nice-to-Have (Non-blocking)
- Proper SSL certificate
- Email alert integration
- Automated backups
- Advanced monitoring

### Estimated Time to Beta-Ready
- **With Microsoft Integration**: 2-3 days
- **Without Microsoft Integration** (mock data only): 1 day

---

## Next Steps - Priority Order

### Immediate (Today/Tomorrow)
1. **Decide on Microsoft Integration**
   - If YES: Set up Azure AD app registration (2-3 hours)
   - If NO: Document that beta uses mock data

2. **Set Up Background Workers** (2-3 hours)
   - Create systemd services or cron jobs
   - Test worker execution
   - Verify logging

3. **Create Beta Tester Documentation** (3-4 hours)
   - Onboarding guide
   - Feature overview
   - Known limitations
   - How to provide feedback

### Short-term (This Week)
4. **Security Hardening** (4-6 hours)
   - Firewall review
   - fail2ban setup
   - Security audit

5. **Testing and QA** (1-2 days)
   - End-to-end testing
   - Create test scenarios
   - Document bugs

6. **Set Up Monitoring** (2-3 hours)
   - Log rotation
   - Basic health checks
   - Error alerting

### Medium-term (Next Week)
7. **SSL Certificate** (2-4 hours)
   - Decide on approach
   - Implement
   - Test

8. **Backup System** (3-4 hours)
   - Automated backups
   - Test restore
   - Document process

9. **Email Integration** (if needed) (2-3 hours)
   - Configure IMAP
   - Test alert parsing

---

## Beta Testing Checklist

Use this checklist to track readiness:

### Technical Readiness
- [ ] Platform accessible remotely
- [ ] All core features working
- [ ] Microsoft integration configured (or documented as mock)
- [ ] Background workers running
- [ ] Logs accessible and rotating
- [ ] Basic monitoring in place
- [ ] Backup system configured
- [ ] Security hardening complete

### Documentation Readiness
- [ ] Beta tester onboarding guide
- [ ] User manual for each role
- [ ] Known issues document
- [ ] Feedback collection process
- [ ] Support contact information

### Process Readiness
- [ ] Beta tester selection criteria
- [ ] Onboarding process defined
- [ ] Feedback collection method
- [ ] Bug reporting process
- [ ] Communication plan
- [ ] Exit criteria defined

---

## Contact and Support

**Platform Access**:
- External: SSH tunnel to `209.227.150.115`
- Internal: `https://192.168.1.116`

**Credentials**:
- Super Admin: `admin@avian.local` / `admin123`
- Security Analyst: `analyst@avian.local` / `analyst123`

**Support**:
- Technical issues: [Your contact]
- Feature requests: [Your contact]
- Security concerns: [Your contact]

---

## Risk Assessment

### High Risk Items
1. **No Microsoft Integration**: Asset inventory will be mock data only
2. **Self-signed SSL**: Browser warnings may confuse users
3. **No automated backups**: Risk of data loss
4. **Limited testing**: May have undiscovered bugs

### Mitigation Strategies
1. Clearly document mock data limitations
2. Provide SSL certificate installation instructions
3. Implement manual backup process initially
4. Start with small beta group, expand gradually

---

## Success Metrics for Beta

### Technical Metrics
- Uptime: >99%
- Response time: <2 seconds for most operations
- Error rate: <1% of requests
- Zero data loss incidents

### User Metrics
- User satisfaction: >70%
- Feature completion rate: >80%
- Support tickets: <5 per user per week
- User retention: >80% through beta period

### Business Metrics
- Feedback quality: Actionable insights collected
- Bug discovery: Critical bugs identified and fixed
- Feature validation: Core features validated by users
- Readiness assessment: Clear go/no-go for production

---

## Appendix: Quick Reference Commands

### Check Platform Status
```bash
ssh avian@209.227.150.115
docker ps
docker logs avian-web
docker logs avian-postgres
docker logs avian-redis
```

### Access Platform
```bash
# From your Mac
ssh -L 8443:localhost:443 avian@209.227.150.115
# Then open: https://localhost:8443
```

### View Logs
```bash
docker logs -f avian-web
docker logs -f avian-postgres
docker logs -f avian-redis
```

### Restart Services
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Database Backup (Manual)
```bash
docker exec avian-postgres pg_dump -U avian avian > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore
```bash
docker exec -i avian-postgres psql -U avian avian < backup_file.sql
```

---

**Last Updated**: February 2, 2026  
**Next Review**: After completing immediate priorities
