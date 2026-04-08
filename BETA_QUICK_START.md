# AVIAN Beta Testing - Quick Start Action Plan

**Goal**: Get AVIAN ready for beta testing as quickly as possible

---

## Decision Point: Microsoft Integration

You need to decide NOW:

### Option A: Full Beta (With Real Asset Data)
**Timeline**: 2-3 days  
**Effort**: Medium  
**Result**: Real asset inventory from Microsoft Intune/Defender

**Required**:
- Set up Azure AD app registration
- Configure Microsoft Graph API access
- Test with real tenant data

### Option B: Limited Beta (Mock Data Only)
**Timeline**: 1 day  
**Effort**: Low  
**Result**: Demo/mock asset inventory only

**Required**:
- Document that asset data is mock/demo
- Focus on other features (alerts, help desk, user management)

**Which option do you want?** (This determines the rest of the plan)

---

## Today's Tasks (Regardless of Option)

### Task 1: Set Up Background Workers (2-3 hours)

The EDR polling worker and metrics aggregation worker need to run automatically.

**Note**: Email alert worker is SKIPPED for beta testing.

**See detailed guide**: `BACKGROUND_WORKERS_SETUP.md`

**Quick setup:**

```bash
# SSH to server
ssh avian@209.227.150.115

# Create worker service file
sudo nano /etc/systemd/system/avian-edr-worker.service
```

**File content:**
```ini
[Unit]
Description=AVIAN EDR Polling Worker
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/home/avian/avian-cybersecurity-platform-onprem
ExecStart=/usr/bin/docker exec avian-web node -r ts-node/register src/workers/index.ts
Environment="WORKER_TYPE=edr-polling"
User=avian
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Create timer file:**
```bash
sudo nano /etc/systemd/system/avian-edr-worker.timer
```

**File content:**
```ini
[Unit]
Description=Run AVIAN EDR Worker every 15 minutes
Requires=avian-edr-worker.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Unit=avian-edr-worker.service

[Install]
WantedBy=timers.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable avian-edr-worker.timer
sudo systemctl start avian-edr-worker.timer
sudo systemctl status avian-edr-worker.timer
```

---

### Task 2: Security Hardening (2-3 hours)

**Install and configure fail2ban:**
```bash
sudo apt update
sudo apt install fail2ban -y

# Configure fail2ban for SSH
sudo nano /etc/fail2ban/jail.local
```

**Add this content:**
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
```

**Start fail2ban:**
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo systemctl status fail2ban
```

**Review firewall rules:**
```bash
sudo ufw status
# Should show:
# - 22/tcp (SSH) - ALLOW
# - 80/tcp (HTTP) - ALLOW  
# - 443/tcp (HTTPS) - ALLOW
```

**Set up automatic security updates:**
```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

### Task 3: Set Up Log Rotation (30 minutes)

**Create log rotation config:**
```bash
sudo nano /etc/logrotate.d/avian
```

**Content:**
```
/home/avian/avian-cybersecurity-platform-onprem/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 avian avian
    sharedscripts
    postrotate
        docker exec avian-web kill -USR1 1
    endscript
}
```

**Test log rotation:**
```bash
sudo logrotate -d /etc/logrotate.d/avian
```

---

### Task 4: Set Up Automated Backups (1 hour)

**Create backup script:**
```bash
nano /home/avian/backup-avian.sh
```

**Script content:**
```bash
#!/bin/bash

# AVIAN Database Backup Script
BACKUP_DIR="/home/avian/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/avian_backup_$DATE.sql"
RETENTION_DAYS=14

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
echo "Starting backup at $(date)"
docker exec avian-postgres pg_dump -U avian avian > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove old backups
find $BACKUP_DIR -name "avian_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
echo "Backup size: $(du -h ${BACKUP_FILE}.gz | cut -f1)"
```

**Make executable:**
```bash
chmod +x /home/avian/backup-avian.sh
```

**Add to crontab (daily at 2 AM):**
```bash
crontab -e
```

**Add this line:**
```
0 2 * * * /home/avian/backup-avian.sh >> /home/avian/backup.log 2>&1
```

**Test backup:**
```bash
/home/avian/backup-avian.sh
ls -lh /home/avian/backups/
```

---

### Task 5: Create Beta Tester Documentation (2-3 hours)

I'll create this for you - see next file.

---

## If You Choose Option A (Microsoft Integration)

### Additional Task: Azure AD Setup (2-3 hours)

**Step 1: Create Azure AD App Registration**

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: Azure Active Directory → App registrations → New registration
3. Name: "AVIAN Cybersecurity Platform"
4. Supported account types: "Accounts in this organizational directory only"
5. Click "Register"

**Step 2: Grant API Permissions**

1. In your app, go to: API permissions → Add a permission
2. Select "Microsoft Graph" → Application permissions
3. Add these permissions:
   - `DeviceManagementManagedDevices.Read.All`
   - `DeviceManagementConfiguration.Read.All`
   - `Device.Read.All`
   - `SecurityEvents.Read.All`
   - `SecurityAlert.Read.All`
4. Click "Grant admin consent" (requires admin)

**Step 3: Create Client Secret**

1. Go to: Certificates & secrets → New client secret
2. Description: "AVIAN Platform Production"
3. Expires: 24 months
4. Click "Add"
5. **COPY THE SECRET VALUE IMMEDIATELY** (you can't see it again)

**Step 4: Get Your IDs**

- **Tenant ID**: Overview page → Directory (tenant) ID
- **Client ID**: Overview page → Application (client) ID
- **Client Secret**: The value you just copied

**Step 5: Update Environment Variables**

```bash
ssh avian@209.227.150.115
cd avian-cybersecurity-platform-onprem
nano .env.production
```

**Update these lines:**
```bash
MICROSOFT_CLIENT_ID=<your-client-id>
MICROSOFT_CLIENT_SECRET=<your-client-secret>
MICROSOFT_TENANT_ID=<your-tenant-id>
```

**Restart platform:**
```bash
docker-compose -f docker-compose.prod.yml restart
```

**Step 6: Test Connection**

```bash
# Check logs for successful connection
docker logs -f avian-web

# Look for messages like:
# "Successfully authenticated with Microsoft Graph"
# "Retrieved X devices from Intune"
```

---

## Tomorrow's Tasks

### Task 6: End-to-End Testing (4-6 hours)

**Test all workflows:**
- [ ] User login/logout
- [ ] Create new user
- [ ] Switch tenants
- [ ] View alerts
- [ ] Create help desk ticket
- [ ] Resolve incident
- [ ] View asset inventory
- [ ] Check dashboard metrics

**Test with different roles:**
- [ ] Super Admin
- [ ] Tenant Admin
- [ ] Security Analyst
- [ ] IT Helpdesk

**Test edge cases:**
- [ ] Invalid login attempts
- [ ] Expired sessions
- [ ] Concurrent users
- [ ] Large data sets

---

### Task 7: Create Test Scenarios for Beta Testers (2 hours)

Document specific scenarios for beta testers to try:
- Onboarding new tenant
- Managing security alerts
- Creating and resolving tickets
- Generating reports
- etc.

---

### Task 8: Set Up Monitoring (2 hours)

**Create health check script:**
```bash
nano /home/avian/health-check.sh
```

**Script content:**
```bash
#!/bin/bash

# Check if containers are running
if ! docker ps | grep -q avian-web; then
    echo "ERROR: Web container not running"
    exit 1
fi

if ! docker ps | grep -q avian-postgres; then
    echo "ERROR: Database container not running"
    exit 1
fi

if ! docker ps | grep -q avian-redis; then
    echo "ERROR: Redis container not running"
    exit 1
fi

# Check if web app is responding
if ! curl -k -s https://localhost > /dev/null; then
    echo "ERROR: Web app not responding"
    exit 1
fi

echo "All systems operational"
exit 0
```

**Make executable and add to cron (every 5 minutes):**
```bash
chmod +x /home/avian/health-check.sh
crontab -e
```

**Add:**
```
*/5 * * * * /home/avian/health-check.sh >> /home/avian/health-check.log 2>&1
```

---

## Beta Launch Checklist

Before inviting beta testers:

### Technical
- [ ] Platform accessible remotely
- [ ] All core features tested and working
- [ ] Background workers running
- [ ] Logs rotating properly
- [ ] Backups running daily
- [ ] Security hardening complete
- [ ] Monitoring in place
- [ ] Microsoft integration working (if Option A)

### Documentation
- [ ] Beta tester onboarding guide created
- [ ] User manual for each role created
- [ ] Known issues documented
- [ ] Feedback process defined
- [ ] Support contact provided

### Process
- [ ] Beta testers identified
- [ ] NDA/agreement prepared (if needed)
- [ ] Communication plan ready
- [ ] Feedback collection method set up
- [ ] Bug tracking system ready

---

## Estimated Timeline

### Option A (With Microsoft Integration)
- **Day 1**: Tasks 1-4 (workers, security, logs, backups)
- **Day 2**: Task 5 (Azure AD setup) + Task 6 (documentation)
- **Day 3**: Tasks 7-8 (testing, monitoring) + final checks
- **Day 4**: Beta launch

### Option B (Mock Data Only)
- **Day 1**: Tasks 1-5 (workers, security, logs, backups, docs)
- **Day 2**: Tasks 6-8 (testing, monitoring) + final checks
- **Day 3**: Beta launch

---

## Quick Commands Reference

```bash
# SSH to server
ssh avian@209.227.150.115

# Access platform (from your Mac)
ssh -L 8443:localhost:443 avian@209.227.150.115
# Then: https://localhost:8443

# Check status
docker ps
docker logs avian-web
systemctl status avian-edr-worker.timer

# Restart platform
cd avian-cybersecurity-platform-onprem
docker-compose -f docker-compose.prod.yml restart

# Manual backup
/home/avian/backup-avian.sh

# View logs
tail -f /home/avian/backup.log
tail -f /home/avian/health-check.log
docker logs -f avian-web
```

---

## What Do You Want to Do First?

1. **Set up Microsoft Integration** (Option A) - Full beta with real data
2. **Skip Microsoft for now** (Option B) - Quick beta with mock data
3. **Start with Task 1** (Background Workers) - Works for both options

Let me know and I'll guide you through the specific steps!
