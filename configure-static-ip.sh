#!/bin/bash

echo "🔧 Configuring Static IP Address for AVIAN Server"
echo "Current IP: 192.168.1.116"
echo "Target Static IP: 192.168.1.116 (keeping current IP)"
echo ""

# Create netplan configuration for static IP
cat << 'EOF' > static-ip-config.yaml
# Static IP configuration for AVIAN Cybersecurity Platform
# This file should be placed at /etc/netplan/01-netcfg.yaml

network:
  version: 2
  renderer: networkd
  ethernets:
    # Replace 'ens33' with your actual network interface name
    # Common names: eth0, ens33, enp0s3, etc.
    ens33:
      dhcp4: false
      addresses:
        - 192.168.1.116/24
      gateway4: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
          - 192.168.1.1
EOF

echo "📝 Created static IP configuration file: static-ip-config.yaml"
echo ""
echo "🔍 To apply this configuration, run these commands on your server:"
echo ""
echo "# 1. SSH to server"
echo "ssh avian@192.168.1.116"
echo ""
echo "# 2. Find your network interface name"
echo "ip addr show"
echo ""
echo "# 3. Copy the configuration file"
echo "# (You'll need to transfer static-ip-config.yaml to the server first)"
echo ""
echo "# 4. Edit the configuration with correct interface name"
echo "sudo nano /etc/netplan/01-netcfg.yaml"
echo ""
echo "# 5. Apply the configuration"
echo "sudo netplan apply"
echo ""
echo "# 6. Verify the configuration"
echo "ip addr show"
echo ""

# Create step-by-step instructions
cat << 'EOF' > static-ip-instructions.md
# Static IP Configuration Instructions

## Step 1: Find Network Interface Name
```bash
ssh avian@192.168.1.116
ip addr show
```
Look for the interface name (usually eth0, ens33, enp0s3, etc.)

## Step 2: Create Netplan Configuration
```bash
sudo nano /etc/netplan/01-netcfg.yaml
```

Paste this content (replace `ens33` with your actual interface name):
```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens33:  # Replace with your interface name
      dhcp4: false
      addresses:
        - 192.168.1.116/24
      gateway4: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
          - 192.168.1.1
```

## Step 3: Apply Configuration
```bash
sudo netplan apply
```

## Step 4: Verify Configuration
```bash
ip addr show
ping google.com
```

## Step 5: Test Persistence
```bash
sudo reboot
```
After reboot, check that IP is still 192.168.1.116

## Important Notes:
- Replace `192.168.1.1` with your actual router IP if different
- Replace `ens33` with your actual network interface name
- The `/24` means subnet mask 255.255.255.0
- DNS servers: 8.8.8.8 (Google), 8.8.4.4 (Google), and your router
EOF

echo "📋 Created detailed instructions: static-ip-instructions.md"
echo ""
echo "⚠️  IMPORTANT: You need to find your network interface name first!"
echo "   Run 'ip addr show' on the server to see interface names like eth0, ens33, etc."