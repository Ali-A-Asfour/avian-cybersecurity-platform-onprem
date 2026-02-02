# Manual Static IP Setup Guide

The automated script had issues with sudo passwords. Here's how to set it up manually:

## Step 1: SSH to Your Server
```bash
ssh avian@192.168.1.116
```

## Step 2: Create the Static IP Configuration
```bash
# Create the configuration file
sudo nano /etc/netplan/01-static-ip.yaml
```

**Paste this content into the file:**
```yaml
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
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

## Step 3: Backup and Disable Cloud-Init Network Config
```bash
# Backup the original configuration
sudo cp /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.backup

# Disable cloud-init network configuration
sudo mv /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.disabled
```

## Step 4: Set Proper Permissions
```bash
sudo chmod 600 /etc/netplan/01-static-ip.yaml
```

## Step 5: Test the Configuration
```bash
# Test the configuration (will automatically revert after 30 seconds if there's an issue)
sudo netplan try --timeout=30
```

**If prompted, press Enter to accept the configuration**

## Step 6: Apply the Configuration Permanently
```bash
sudo netplan apply
```

## Step 7: Verify the Configuration
```bash
# Check that the IP is still 192.168.1.116
ip addr show enp3s0

# Test internet connectivity
ping -c 3 google.com

# Check that the gateway is correct
ip route show default
```

## Step 8: Test Persistence (Optional)
```bash
# Reboot to test that the IP persists
sudo reboot
```

After reboot, the server should still be accessible at `192.168.1.116`

## Expected Results:
- ✅ Server keeps IP address 192.168.1.116 after reboots
- ✅ Internet connectivity works
- ✅ AVIAN platform accessible at https://192.168.1.116
- ✅ No more IP address changes

## If Something Goes Wrong:
```bash
# Restore the original configuration
sudo mv /etc/netplan/50-cloud-init.yaml.disabled /etc/netplan/50-cloud-init.yaml
sudo rm /etc/netplan/01-static-ip.yaml
sudo netplan apply
```

## Verification Commands:
```bash
# Check current IP
ip addr show enp3s0 | grep "inet "

# Check gateway
ip route show default

# Test DNS resolution
nslookup google.com

# Test AVIAN platform
curl -k -I https://192.168.1.116
```

---

**After completing these steps, your server will maintain the IP address 192.168.1.116 permanently, even after restarts!**