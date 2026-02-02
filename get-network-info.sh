#!/bin/bash

echo "🔍 Getting network configuration from server..."
echo ""

# Get network interface information
echo "📡 Getting network interface details..."
ssh avian@192.168.1.116 "
echo '=== Network Interfaces ==='
ip addr show

echo ''
echo '=== Current Route (Gateway) ==='
ip route show default

echo ''
echo '=== DNS Configuration ==='
cat /etc/resolv.conf

echo ''
echo '=== Current Netplan Configuration ==='
ls -la /etc/netplan/
echo ''
if ls /etc/netplan/*.yaml 1> /dev/null 2>&1; then
    echo 'Existing netplan files:'
    for file in /etc/netplan/*.yaml; do
        echo \"--- \$file ---\"
        cat \"\$file\"
        echo ''
    done
else
    echo 'No existing netplan configuration files found'
fi
"