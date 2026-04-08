# AVIAN Background Workers Setup Guide

**Date**: February 2, 2026  
**Server**: 192.168.1.116 (Ubuntu 24.04.03)

---

## Overview

Setting up 2 background workers for AVIAN:
1. ✅ **EDR Polling Worker** - Runs every 15 minutes
2. ✅ **Metrics Aggregation Worker** - Runs daily at midnight
3. ⏭️ **Email Alert Worker** - SKIPPED (not needed for beta)

---

## Worker 1: EDR Polling Worker

**Purpose**: Automatically polls Microsoft Graph API every 15 minutes to collect:
- Device inventory from Intune/Defender
- Security alerts
- Vulnerabilities (CVEs)
- Compliance status
- Security posture scores

**Schedule**: Every 15 minutes

### Step 1: Create the Service File

```bash
# SSH to server
ssh avian@209.227.150.115

# Create service file
sudo nano /etc/systemd/system/avian-edr-worker.service
```

**Paste this content:**
```ini
[Unit]
Description=AVIAN EDR Polling Worker
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/home/avian/avian-cybersecurity-platform-onprem
ExecStart=/usr/bin/docker exec avian-web node dist/workers/index.js
Environment="WORKER_TYPE=edr-polling"
Environment="NODE_ENV=production"
User=avian
StandardOutput=journal
StandardError=journal
SyslogIdentifier=avian-edr-worker

[Install]
WantedBy=multi-user.target
```

**Save and exit**: `Ctrl+X`, then `Y`, then `Enter`

### Step 2: Create the Timer File

```bash
sudo nano /etc/systemd/system/avian-edr-worker.timer
```

**Paste this content:**
```ini
[Unit]
Description=Run AVIAN EDR Polling Worker every 15 minutes
Requires=avian-edr-worker.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Unit=avian-edr-worker.service

[Install]
WantedBy=timers.target
```

**Save and exit**: `Ctrl+X`, then `Y`, then `Enter`

### Step 3: Enable and Start the Timer

```bash
# Reload systemd to recognize new files
sudo systemctl daemon-reload

# Enable timer to start on boot
sudo systemctl enable avian-edr-worker.timer

# Start the timer now
sudo systemctl start avian-edr-worker.timer

# Check status
sudo systemctl status avian-edr-worker.timer
```

**Expected output:**
```
● avian-edr-worker.timer - Run AVIAN EDR Polling Worker every 15 minutes
     Loaded: loaded (/etc/systemd/system/avian-edr-worker.timer; enabled)
     Active: active (waiting)
```

### Step 4: Test the Worker Manually

```bash
# Run the worker once manually to test
sudo systemctl start avian-edr-worker.service

# Check the logs
sudo journalctl -u avian-edr-worker.service -n 50 --no-pager
```

**What to look for:**
- ✅ "Starting EDR polling execution"
- ✅ "Retrieved active tenants"
- ✅ "EDR polling execution completed"
- ❌ Any error messages (we'll troubleshoot if needed)

---

## Worker 2: Metrics Aggregation Worker

**Purpose**: Runs once per day at midnight to:
- Calculate daily rollup metrics
- Aggregate firewall statistics
- Generate summary reports
- Clean up old data

**Schedule**: Daily at 12:00 AM (midnight)

### Step 1: Create the Service File

```bash
sudo nano /etc/systemd/system/avian-metrics-worker.service
```

**Paste this content:**
```ini
[Unit]
Description=AVIAN Metrics Aggregation Worker
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/home/avian/avian-cybersecurity-platform-onprem
ExecStart=/usr/bin/docker exec avian-web node dist/workers/index.js
Environment="WORKER_TYPE=metrics-aggregation"
Environment="NODE_ENV=production"
User=avian
StandardOutput=journal
StandardError=journal
SyslogIdentifier=avian-metrics-worker

[Install]
WantedBy=multi-user.target
```

**Save and exit**: `Ctrl+X`, then `Y`, then `Enter`

### Step 2: Create the Timer File

```bash
sudo nano /etc/systemd/system/avian-metrics-worker.timer
```

**Paste this content:**
```ini
[Unit]
Description=Run AVIAN Metrics Aggregation Worker daily at midnight
Requires=avian-metrics-worker.service

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 00:00:00
Persistent=true
Unit=avian-metrics-worker.service

[Install]
WantedBy=timers.target
```

**Save and exit**: `Ctrl+X`, then `Y`, then `Enter`

### Step 3: Enable and Start the Timer

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable timer
sudo systemctl enable avian-metrics-worker.timer

# Start timer
sudo systemctl start avian-metrics-worker.timer

# Check status
sudo systemctl status avian-metrics-worker.timer
```

**Expected output:**
```
● avian-metrics-worker.timer - Run AVIAN Metrics Aggregation Worker daily at midnight
     Loaded: loaded (/etc/systemd/system/avian-metrics-worker.timer; enabled)
     Active: active (waiting)
     Trigger: [Next run time will be shown here]
```

### Step 4: Test the Worker Manually

```bash
# Run the worker once manually to test
sudo systemctl start avian-metrics-worker.service

# Check the logs
sudo journalctl -u avian-metrics-worker.service -n 50 --no-pager
```

**What to look for:**
- ✅ "Running metrics aggregation worker"
- ✅ "Metrics aggregation completed"
- ❌ Any error messages

---

## Verification Commands

### Check All Timers Status
```bash
# List all AVIAN timers
systemctl list-timers | grep avian
```

**Expected output:**
```
NEXT                        LEFT          LAST                        PASSED       UNIT                        ACTIVATES
[time]                      [countdown]   [time]                      [ago]        avian-edr-worker.timer      avian-edr-worker.service
[time]                      [countdown]   n/a                         n/a          avian-metrics-worker.timer  avian-metrics-worker.service
```

### Check Individual Timer Status
```bash
# EDR worker
sudo systemctl status avian-edr-worker.timer

# Metrics worker
sudo systemctl status avian-metrics-worker.timer
```

### View Worker Logs
```bash
# EDR worker logs (last 50 lines)
sudo journalctl -u avian-edr-worker.service -n 50 --no-pager

# EDR worker logs (follow in real-time)
sudo journalctl -u avian-edr-worker.service -f

# Metrics worker logs
sudo journalctl -u avian-metrics-worker.service -n 50 --no-pager

# All AVIAN worker logs
sudo journalctl -u avian-*.service -n 100 --no-pager
```

### Check When Workers Last Ran
```bash
# Show last run times
systemctl list-timers --all | grep avian
```

---

## Troubleshooting

### Worker Not Running

**Check if timer is active:**
```bash
sudo systemctl status avian-edr-worker.timer
```

**If inactive, start it:**
```bash
sudo systemctl start avian-edr-worker.timer
```

### Worker Failing

**Check logs for errors:**
```bash
sudo journalctl -u avian-edr-worker.service -n 100 --no-pager
```

**Common issues:**
1. **Docker container not running**: Check `docker ps`
2. **Worker script not compiled**: Check if `dist/workers/index.js` exists
3. **Environment variables missing**: Check `.env.production`
4. **Database connection failed**: Check PostgreSQL is running

### Manually Run Worker

**To test without waiting for timer:**
```bash
# Run EDR worker
sudo systemctl start avian-edr-worker.service

# Run metrics worker
sudo systemctl start avian-metrics-worker.service
```

### Stop/Disable Workers

**If you need to stop workers:**
```bash
# Stop timers
sudo systemctl stop avian-edr-worker.timer
sudo systemctl stop avian-metrics-worker.timer

# Disable from starting on boot
sudo systemctl disable avian-edr-worker.timer
sudo systemctl disable avian-metrics-worker.timer
```

### Restart After Changes

**If you modify service/timer files:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart avian-edr-worker.timer
sudo systemctl restart avian-metrics-worker.timer
```

---

## Worker Compilation Check

The workers need to be compiled from TypeScript to JavaScript. Let's verify:

```bash
# SSH to server
ssh avian@209.227.150.115

# Check if compiled worker exists
docker exec avian-web ls -la dist/workers/

# If dist/workers/index.js doesn't exist, compile it:
docker exec avian-web npm run build
```

**Expected output:**
```
-rw-r--r-- 1 node node [size] [date] index.js
```

---

## Monitoring Worker Health

### Create a Simple Monitoring Script

```bash
nano /home/avian/check-workers.sh
```

**Paste this content:**
```bash
#!/bin/bash

echo "=== AVIAN Background Workers Status ==="
echo ""
echo "EDR Polling Worker:"
systemctl is-active avian-edr-worker.timer
systemctl status avian-edr-worker.timer | grep "Trigger:"
echo ""
echo "Metrics Aggregation Worker:"
systemctl is-active avian-metrics-worker.timer
systemctl status avian-metrics-worker.timer | grep "Trigger:"
echo ""
echo "Last 5 EDR worker runs:"
journalctl -u avian-edr-worker.service --since "24 hours ago" | grep "completed" | tail -5
echo ""
echo "Last metrics worker run:"
journalctl -u avian-metrics-worker.service --since "7 days ago" | grep "completed" | tail -1
```

**Make executable:**
```bash
chmod +x /home/avian/check-workers.sh
```

**Run it:**
```bash
/home/avian/check-workers.sh
```

---

## Expected Behavior

### EDR Polling Worker
- **First run**: 5 minutes after system boot
- **Subsequent runs**: Every 15 minutes after previous run completes
- **Duration**: 30 seconds to 5 minutes (depends on data volume)
- **Logs**: Check with `sudo journalctl -u avian-edr-worker.service -f`

### Metrics Aggregation Worker
- **First run**: Next midnight (00:00:00)
- **Subsequent runs**: Daily at midnight
- **Duration**: 1-5 minutes
- **Logs**: Check with `sudo journalctl -u avian-metrics-worker.service -f`

---

## What About Email Alerts?

**Status**: ⏭️ **SKIPPED FOR BETA**

**Reason**: Email alert integration requires:
- IMAP email account configuration
- Email parsing setup
- Additional testing

**Impact**: 
- ✅ Platform fully functional without it
- ✅ Alerts can still be created via API/webhooks
- ✅ Microsoft Defender alerts still work via EDR worker
- ❌ Cannot receive alerts via email (SonicWall email alerts)

**Future**: Can be added later if needed for production

---

## Success Checklist

After completing this setup, verify:

- [ ] EDR worker timer is active: `sudo systemctl status avian-edr-worker.timer`
- [ ] Metrics worker timer is active: `sudo systemctl status avian-metrics-worker.timer`
- [ ] EDR worker ran successfully at least once: `sudo journalctl -u avian-edr-worker.service`
- [ ] Metrics worker ran successfully at least once: `sudo journalctl -u avian-metrics-worker.service`
- [ ] No errors in worker logs
- [ ] Workers will start automatically on reboot (enabled)
- [ ] Monitoring script created and working

---

## Quick Reference

```bash
# Check status
systemctl list-timers | grep avian

# View logs
sudo journalctl -u avian-edr-worker.service -f
sudo journalctl -u avian-metrics-worker.service -f

# Manual run
sudo systemctl start avian-edr-worker.service
sudo systemctl start avian-metrics-worker.service

# Restart timers
sudo systemctl restart avian-edr-worker.timer
sudo systemctl restart avian-metrics-worker.timer

# Check health
/home/avian/check-workers.sh
```

---

## Next Steps

After setting up background workers:

1. ✅ Workers are running automatically
2. ⏭️ Set up Microsoft Integration (if you want real data)
3. ⏭️ Security hardening (fail2ban, firewall)
4. ⏭️ Automated backups
5. ⏭️ Beta tester documentation

---

**Last Updated**: February 2, 2026  
**Status**: Ready for implementation
