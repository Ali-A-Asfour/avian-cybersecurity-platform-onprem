# AVIAN Alpha Testing - Deployment Checklist

## Pre-Deployment Planning

### Hardware & Infrastructure
- [ ] **Physical server acquired** (8 cores, 16GB RAM, 500GB SSD recommended)
- [ ] **Network connectivity** (static IP preferred)
- [ ] **UPS/Power backup** configured
- [ ] **Backup storage** available (external drive or NAS)
- [ ] **Domain name** registered (optional, can use IP)

### Team Preparation
- [ ] **Technical lead** assigned for deployment
- [ ] **Client contact** identified for coordination
- [ ] **Deployment window** scheduled (2-4 hours)
- [ ] **Rollback plan** prepared
- [ ] **Support contacts** documented

---

## Phase 1: Server Setup ⏱️ 60-90 minutes

### Operating System
- [ ] **Ubuntu 22.04 LTS** installed
- [ ] **System updated** (`sudo apt update && sudo apt upgrade -y`)
- [ ] **Essential packages** installed (`curl wget git vim htop ufw fail2ban`)
- [ ] **Timezone configured** (`sudo timedatectl set-timezone`)
- [ ] **System rebooted** after updates

### Security Hardening
- [ ] **SSH hardened** (custom port, key-only auth, no root login)
- [ ] **Firewall configured** (UFW enabled, ports 80/443/custom-ssh only)
- [ ] **Fail2ban configured** (SSH protection, 3 attempts, 1-hour ban)
- [ ] **Dedicated user created** (`avian` user with sudo access)
- [ ] **SSH keys deployed** for secure access

### Docker Installation
- [ ] **Docker CE installed** (latest stable version)
- [ ] **Docker Compose installed** (latest version)
- [ ] **User added to docker group** (`avian` user)
- [ ] **Docker tested** (`docker run hello-world`)
- [ ] **System rebooted** (to apply group changes)

---

## Phase 2: Network & SSL ⏱️ 30-60 minutes

### Network Configuration
- [ ] **Static IP configured** (if required)
- [ ] **DNS configured** (domain pointing to server IP)
- [ ] **Firewall rules tested** (ports accessible)
- [ ] **Network connectivity verified** from client location

### SSL Certificate
- [ ] **Certificate method chosen** (Let's Encrypt or self-signed)
- [ ] **SSL certificate generated** and installed
- [ ] **Certificate auto-renewal configured** (if Let's Encrypt)
- [ ] **HTTPS access verified** (`curl -k https://your-server`)

---

## Phase 3: Application Deployment ⏱️ 45-60 minutes

### Code Deployment
- [ ] **Repository cloned** to `/home/avian/avian-platform`
- [ ] **Scripts made executable** (`chmod +x scripts/*.sh`)
- [ ] **Environment configured** (`.env.production` created)
- [ ] **Secrets generated** (`./scripts/generate-secrets.sh`)

### Configuration
- [ ] **Database passwords** set (strong, unique)
- [ ] **JWT secrets** generated (32+ characters)
- [ ] **Domain/IP addresses** updated in config
- [ ] **Email service** configured (Gmail app password)
- [ ] **SMS service** configured (Twilio - optional)
- [ ] **Client information** added to config

### Application Launch
- [ ] **Docker containers built** (`./scripts/alpha-deploy.sh`)
- [ ] **All services started** (nginx, app, postgres, redis)
- [ ] **Database migrations** completed
- [ ] **Initial admin user** created (optional seeding)
- [ ] **Health checks passed** (all services healthy)

---

## Phase 4: Testing & Verification ⏱️ 30-45 minutes

### System Health
- [ ] **All containers running** (`docker-compose ps`)
- [ ] **Application accessible** (HTTPS working)
- [ ] **Health endpoint responding** (`/api/health/live`)
- [ ] **Database connectivity** verified
- [ ] **Redis connectivity** verified

### Feature Testing
- [ ] **Login/logout** working
- [ ] **Password reset** flow tested (email sent)
- [ ] **Session timeout** warning tested
- [ ] **Alert creation** tested
- [ ] **Alert acknowledgment** tested
- [ ] **Ticket creation** tested
- [ ] **Admin functions** tested (user management)
- [ ] **Email notifications** tested
- [ ] **SMS notifications** tested (if configured)

### Security Testing
- [ ] **HTTPS enforced** (HTTP redirects to HTTPS)
- [ ] **Authentication required** (no bypass)
- [ ] **Session management** working
- [ ] **Account lockout** tested (5 failed attempts)
- [ ] **Password policies** enforced
- [ ] **Admin access** restricted

---

## Phase 5: Client Preparation ⏱️ 15-30 minutes

### User Management
- [ ] **Client admin user** created
- [ ] **Client regular users** created (as needed)
- [ ] **User roles** assigned correctly
- [ ] **Login credentials** generated securely
- [ ] **Password reset** tested for client users

### Documentation
- [ ] **Access instructions** prepared for client
- [ ] **Login credentials** shared securely
- [ ] **Basic user guide** provided
- [ ] **Support contact info** shared
- [ ] **Feature overview** documented

---

## Phase 6: Go-Live ⏱️ 15 minutes

### Final Checks
- [ ] **All services stable** (no errors in logs)
- [ ] **Performance acceptable** (response times < 2s)
- [ ] **Backup system** configured and tested
- [ ] **Monitoring** configured (log rotation, disk space)
- [ ] **Emergency procedures** documented

### Client Handoff
- [ ] **Client access** provided
- [ ] **Initial walkthrough** completed
- [ ] **Key features** demonstrated
- [ ] **Support channels** established
- [ ] **Feedback process** explained

---

## Post-Deployment Monitoring

### Daily Checks (First Week)
- [ ] **System health** (`docker-compose ps`)
- [ ] **Disk space** (`df -h`)
- [ ] **Application logs** (check for errors)
- [ ] **Client feedback** collection
- [ ] **Performance monitoring** (response times)

### Weekly Checks
- [ ] **Security updates** (`sudo apt update && sudo apt upgrade`)
- [ ] **Backup verification** (test restore process)
- [ ] **SSL certificate** status (expiration check)
- [ ] **User activity** review
- [ ] **Feature usage** analysis

---

## Emergency Procedures

### Service Down
```bash
# Check service status
docker-compose -f docker-compose.alpha.yml ps

# Restart all services
docker-compose -f docker-compose.alpha.yml restart

# Check logs
docker-compose -f docker-compose.alpha.yml logs -f
```

### Database Issues
```bash
# Check database health
docker-compose -f docker-compose.alpha.yml exec postgres pg_isready

# Restore from backup
./scripts/restore.sh /path/to/backup.tar.gz
```

### Complete System Recovery
```bash
# Stop all services
docker-compose -f docker-compose.alpha.yml down

# Restore from backup
./scripts/restore.sh /path/to/backup.tar.gz

# Restart services
./scripts/alpha-deploy.sh
```

---

## Success Criteria

### Technical Success
- ✅ All services running without errors
- ✅ Application accessible via HTTPS
- ✅ All core features functional
- ✅ Email/SMS notifications working
- ✅ Database backups configured
- ✅ Security measures active

### Client Success
- ✅ Client can access the system
- ✅ Client can perform key workflows
- ✅ Client receives notifications
- ✅ Client can create and manage tickets
- ✅ Client feedback is positive
- ✅ No blocking issues reported

---

## Rollback Plan

If deployment fails or critical issues arise:

1. **Stop services**: `docker-compose -f docker-compose.alpha.yml down`
2. **Restore backup**: `./scripts/restore.sh /path/to/backup.tar.gz`
3. **Notify client**: Inform of temporary downtime
4. **Investigate issues**: Review logs and fix problems
5. **Retry deployment**: Once issues resolved
6. **Document lessons**: Update procedures

---

## Contact Information

### Technical Team
- **Deployment Lead**: [Name, Phone, Email]
- **Database Admin**: [Name, Phone, Email]
- **Security Lead**: [Name, Phone, Email]

### Client Contacts
- **Primary Contact**: [Name, Phone, Email]
- **Technical Contact**: [Name, Phone, Email]
- **Decision Maker**: [Name, Phone, Email]

### Emergency Contacts
- **24/7 Support**: [Phone Number]
- **Escalation**: [Manager Contact]
- **Vendor Support**: [If applicable]

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Client Sign-off**: _______________
**Go-Live Status**: _______________