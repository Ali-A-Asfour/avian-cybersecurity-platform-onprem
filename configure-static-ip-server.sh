#!/bin/bash

echo "🔧 Configuring Static IP on AVIAN Server"
echo "Interface: enp3s0"
echo "Static IP: 192.168.1.116/24"
echo "Gateway: 192.168.1.1"
echo ""

# Create the static IP netplan configuration
cat << 'EOF' > avian-static-ip.yaml
# Static IP configuration for AVIAN Cybersecurity Platform
# This replaces DHCP with a fixed IP address
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
EOF

echo "✅ Created static IP configuration: avian-static-ip.yaml"
echo ""

# Create the deployment script
cat << 'EOF' > deploy-static-ip.sh
#!/bin/bash

echo "🚀 Deploying static IP configuration..."

# Copy the configuration file to server
echo "📁 Copying configuration to server..."
scp avian-static-ip.yaml avian@192.168.1.116:/tmp/

# Apply the configuration on server
echo "🔧 Applying static IP configuration..."
ssh avian@192.168.1.116 "
echo '=== Backing up existing configuration ==='
sudo cp /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.backup

echo '=== Installing new static IP configuration ==='
sudo cp /tmp/avian-static-ip.yaml /etc/netplan/01-static-ip.yaml
sudo chmod 600 /etc/netplan/01-static-ip.yaml

echo '=== Disabling cloud-init network configuration ==='
sudo mv /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.disabled

echo '=== Testing configuration syntax ==='
sudo netplan try --timeout=30

echo '=== Configuration applied successfully! ==='
echo 'The server should maintain IP 192.168.1.116 after reboots.'
"

echo "✅ Static IP configuration deployed!"
echo ""
echo "🧪 Testing connectivity..."
sleep 5
ping -c 3 192.168.1.116

echo ""
echo "🔄 To test persistence, you can reboot the server:"
echo "ssh avian@192.168.1.116 'sudo reboot'"
echo ""
echo "After reboot, the server should still be accessible at 192.168.1.116"
EOF

chmod +x deploy-static-ip.sh

echo "📋 Created deployment script: deploy-static-ip.sh"
echo ""
echo "🚀 Ready to deploy! Run: ./deploy-static-ip.sh"
echo ""
echo "⚠️  IMPORTANT NOTES:"
echo "   - This will replace DHCP with static IP configuration"
echo "   - The server will keep IP 192.168.1.116 permanently"
echo "   - Original configuration will be backed up"
echo "   - If something goes wrong, you can restore the backup"
echo ""
echo "🔄 After deployment, test by rebooting the server to ensure IP persists"