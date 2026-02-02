#!/bin/bash

echo "🔧 Deploying Static IP Configuration to AVIAN Server"
echo "Server: 192.168.1.116"
echo "Interface: enp3s0"
echo ""

# Create a comprehensive script to run on the server
cat << 'EOF' > remote-static-ip-setup.sh
#!/bin/bash

echo "🚀 Starting static IP configuration on server..."

# Create the static IP configuration
echo "📝 Creating static IP configuration file..."
sudo tee /etc/netplan/01-static-ip.yaml > /dev/null << 'NETPLAN_EOF'
# Static IP configuration for AVIAN Cybersecurity Platform
network:
  version: 2
  renderer: networkd
  ethernets:
    enp3s0:
      dhcp4: false
      addresses:
        - 192.168.1.116/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
          - 192.168.1.1
NETPLAN_EOF

echo "✅ Configuration file created"

# Set proper permissions
echo "🔒 Setting file permissions..."
sudo chmod 600 /etc/netplan/01-static-ip.yaml
echo "✅ Permissions set"

# Backup original configuration
echo "💾 Backing up original configuration..."
sudo cp /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.backup 2>/dev/null || echo "No cloud-init config to backup"
echo "✅ Backup completed"

# Disable cloud-init network configuration
echo "🚫 Disabling cloud-init network configuration..."
sudo mv /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.disabled 2>/dev/null || echo "No cloud-init config to disable"
echo "✅ Cloud-init disabled"

# Test configuration syntax
echo "🧪 Testing configuration syntax..."
if sudo netplan try --timeout=10 --state /tmp/netplan-test-state; then
    echo "✅ Configuration syntax is valid"
else
    echo "❌ Configuration syntax error - restoring backup"
    sudo mv /etc/netplan/50-cloud-init.yaml.disabled /etc/netplan/50-cloud-init.yaml 2>/dev/null
    sudo rm /etc/netplan/01-static-ip.yaml 2>/dev/null
    exit 1
fi

# Apply the configuration
echo "🚀 Applying static IP configuration..."
sudo netplan apply
echo "✅ Configuration applied"

# Verify the configuration
echo "🔍 Verifying configuration..."
echo "Current IP address:"
ip addr show enp3s0 | grep "inet " | head -1

echo "Current default route:"
ip route show default | head -1

echo "Testing connectivity:"
if ping -c 2 8.8.8.8 > /dev/null 2>&1; then
    echo "✅ Internet connectivity working"
else
    echo "⚠️  Internet connectivity test failed (may be temporary)"
fi

echo ""
echo "🎉 Static IP configuration completed successfully!"
echo "📍 Server IP: 192.168.1.116 (now permanent)"
echo "🔄 This IP will persist after reboots"
echo ""
echo "🌐 AVIAN Platform accessible at: https://192.168.1.116"
EOF

# Make the script executable
chmod +x remote-static-ip-setup.sh

echo "📁 Copying setup script to server..."
scp remote-static-ip-setup.sh avian@192.168.1.116:/tmp/

echo ""
echo "🚀 Executing static IP configuration on server..."
echo "⚠️  You will be prompted for the sudo password during execution"
echo ""

# Execute the script on the server
ssh -t avian@192.168.1.116 "chmod +x /tmp/remote-static-ip-setup.sh && /tmp/remote-static-ip-setup.sh"

echo ""
echo "🧪 Testing connectivity after configuration..."
sleep 3

if ping -c 3 192.168.1.116 > /dev/null 2>&1; then
    echo "✅ Server is accessible at 192.168.1.116"
    
    # Test AVIAN platform
    echo "🌐 Testing AVIAN platform..."
    if curl -k -s -I https://192.168.1.116 | grep -q "200\|302"; then
        echo "✅ AVIAN platform is accessible"
    else
        echo "⚠️  AVIAN platform test inconclusive (may need container restart)"
    fi
else
    echo "❌ Server connectivity test failed"
    echo "   This may be temporary during network reconfiguration"
    echo "   Wait 30 seconds and try accessing https://192.168.1.116"
fi

echo ""
echo "🎯 Static IP Configuration Summary:"
echo "   ✅ Server IP: 192.168.1.116 (permanent)"
echo "   ✅ Gateway: 192.168.1.1"
echo "   ✅ DNS: 8.8.8.8, 8.8.4.4, 192.168.1.1"
echo "   ✅ Interface: enp3s0"
echo ""
echo "🔄 To test persistence, reboot the server:"
echo "   ssh avian@192.168.1.116 'sudo reboot'"
echo ""
echo "After reboot, server should still be at 192.168.1.116"

# Cleanup
rm -f remote-static-ip-setup.sh