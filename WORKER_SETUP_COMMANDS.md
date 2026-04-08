# Background Workers Setup - Commands to Run

**You are SSH'd into the server. Copy and paste these commands one at a time.**

---

## Step 1: Download the setup script

```bash
cd ~
curl -o setup-workers.sh https://raw.githubusercontent.com/yourusername/avian-cybersecurity-platform-onprem/main/setup-workers.sh
```

**OR** if that doesn't work, create it manually:

```bash
cat > setup-workers.sh << 'SCRIPT_END'
#!/bin/bash
set -e
echo "=========================================="
echo "AVIAN Background Workers Setup"
echo "=========================================="
echo ""
if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: Please run as root (use: sudo bash setup-workers.sh)"
    exit 1
fi
echo "Step 1: Creating EDR Polling Worker service file..."
cat > /etc/systemd/system/avian-edr-worker.service << 'EOF'
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
EOF
echo "✓ Created EDR worker service"
echo ""
echo "Step 2: Creating EDR Polling Worker timer file..."
cat > /etc/systemd/system/avian-edr-worker.timer << 'EOF'
[Unit]
Description=Run AVIAN EDR Polling Worker every 15 minutes
Requires=avian-edr-worker.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Unit=avian-edr-worker.service

[Install]
WantedBy=timers.target
EOF
echo "✓ Created EDR worker timer"
echo ""
echo "Step 3: Creating Metrics Aggregation Worker service file..."
cat > /etc/systemd/system/avian-metrics-worker.service << 'EOF'
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
EOF
echo "✓ Created Metrics worker service"
echo ""
echo "Step 4: Creating Metrics Aggregation Worker timer file..."
cat > /etc/systemd/system/avian-metrics-worker.timer << 'EOF'
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
EOF
echo "✓ Created Metrics worker timer"
echo ""
echo "Step 5: Reloading systemd daemon..."
systemctl daemon-reload
echo "✓ Systemd daemon reloaded"
echo ""
echo "Step 6: Enabling and starting timers..."
systemctl enable avian-edr-worker.timer
systemctl enable avian-metrics-worker.timer
systemctl start avian-edr-worker.timer
systemctl start avian-metrics-worker.timer
echo "✓ Timers enabled and started"
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
systemctl list-timers | grep avian
echo ""
echo "Testing EDR worker..."
systemctl start avian-edr-worker.service
sleep 3
journalctl -u avian-edr-worker.service -n 20 --no-pager
echo ""
echo "Workers are now running!"
SCRIPT_END
```

---

## Step 2: Make the script executable

```bash
chmod +x setup-workers.sh
```

---

## Step 3: Run the setup script

```bash
sudo bash setup-workers.sh
```

**This will:**
- Create all 4 systemd files (2 services + 2 timers)
- Enable the timers to start on boot
- Start the timers immediately
- Test the EDR worker
- Show you the status

---

## Step 4: Verify everything is working

After the script completes, check the status:

```bash
systemctl list-timers | grep avian
```

**You should see:**
```
NEXT                        LEFT          LAST    PASSED  UNIT                        ACTIVATES
[time in ~15 min]          [countdown]    n/a     n/a     avian-edr-worker.timer      avian-edr-worker.service
[time at midnight]         [countdown]    n/a     n/a     avian-metrics-worker.timer  avian-metrics-worker.service
```

---

## Step 5: Check the logs

```bash
# View EDR worker logs
sudo journalctl -u avian-edr-worker.service -n 50 --no-pager

# Follow EDR worker logs in real-time
sudo journalctl -u avian-edr-worker.service -f
```

**Press Ctrl+C to stop following logs**

---

## Troubleshooting

### If you see errors about "dist/workers/index.js not found"

The TypeScript code needs to be compiled. Run:

```bash
cd ~/avian-cybersecurity-platform-onprem
docker exec avian-web npm run build
```

Then test the worker again:

```bash
sudo systemctl start avian-edr-worker.service
sudo journalctl -u avian-edr-worker.service -n 50 --no-pager
```

### If Docker container is not running

Check Docker status:

```bash
docker ps
```

If containers aren't running:

```bash
cd ~/avian-cybersecurity-platform-onprem
docker-compose -f docker-compose.prod.yml up -d
```

---

## Success Checklist

After running the setup script, verify:

- [ ] Script completed without errors
- [ ] `systemctl list-timers | grep avian` shows 2 timers
- [ ] Both timers show as "active (waiting)"
- [ ] EDR worker test ran successfully (check logs)
- [ ] No error messages in logs

---

## What's Next?

Once workers are set up:
1. ✅ Background workers running automatically
2. ⏭️ Decide on Microsoft Integration (real data vs mock data)
3. ⏭️ Security hardening
4. ⏭️ Automated backups
5. ⏭️ Beta documentation

---

**Need help?** If you see any errors, copy and paste them and I'll help troubleshoot!
