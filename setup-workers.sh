#!/bin/bash

# AVIAN Background Workers Setup Script
# Run this on the server: sudo bash setup-workers.sh

set -e  # Exit on any error

echo "=========================================="
echo "AVIAN Background Workers Setup"
echo "=========================================="
echo ""

# Check if running as root
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
echo "✓ Created /etc/systemd/system/avian-edr-worker.service"

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
echo "✓ Created /etc/systemd/system/avian-edr-worker.timer"

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
echo "✓ Created /etc/systemd/system/avian-metrics-worker.service"

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
echo "✓ Created /etc/systemd/system/avian-metrics-worker.timer"

echo ""
echo "Step 5: Reloading systemd daemon..."
systemctl daemon-reload
echo "✓ Systemd daemon reloaded"

echo ""
echo "Step 6: Enabling EDR worker timer..."
systemctl enable avian-edr-worker.timer
echo "✓ EDR worker timer enabled"

echo ""
echo "Step 7: Enabling Metrics worker timer..."
systemctl enable avian-metrics-worker.timer
echo "✓ Metrics worker timer enabled"

echo ""
echo "Step 8: Starting EDR worker timer..."
systemctl start avian-edr-worker.timer
echo "✓ EDR worker timer started"

echo ""
echo "Step 9: Starting Metrics worker timer..."
systemctl start avian-metrics-worker.timer
echo "✓ Metrics worker timer started"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Checking status..."
echo ""
echo "EDR Worker Timer:"
systemctl status avian-edr-worker.timer --no-pager | head -10
echo ""
echo "Metrics Worker Timer:"
systemctl status avian-metrics-worker.timer --no-pager | head -10
echo ""
echo "Next scheduled runs:"
systemctl list-timers | grep avian
echo ""
echo "=========================================="
echo "Testing workers..."
echo "=========================================="
echo ""
echo "Running EDR worker once to test..."
systemctl start avian-edr-worker.service
sleep 5
echo ""
echo "EDR Worker logs (last 20 lines):"
journalctl -u avian-edr-worker.service -n 20 --no-pager
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Workers are now running automatically:"
echo "  - EDR Polling: Every 15 minutes"
echo "  - Metrics Aggregation: Daily at midnight"
echo ""
echo "To check status: systemctl list-timers | grep avian"
echo "To view logs: sudo journalctl -u avian-edr-worker.service -f"
echo ""
