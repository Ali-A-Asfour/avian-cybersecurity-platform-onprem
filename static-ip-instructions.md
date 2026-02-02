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
