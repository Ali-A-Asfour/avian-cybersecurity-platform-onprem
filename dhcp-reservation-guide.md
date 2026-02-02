# DHCP Reservation Guide (Easier Option)

## What is DHCP Reservation?
DHCP Reservation tells your router to always assign the same IP address (192.168.1.116) to your AVIAN server, even though it's still using DHCP.

## Advantages:
- ✅ **Easier to configure** - done through router web interface
- ✅ **No server changes needed** - server keeps current DHCP configuration
- ✅ **Automatic** - router handles everything
- ✅ **Reversible** - easy to change or remove

## How to Configure DHCP Reservation:

### Step 1: Find Server's MAC Address
```bash
ssh avian@192.168.1.116
ip addr show | grep -A 1 "state UP"
```
Look for something like: `link/ether 00:11:22:33:44:55`

### Step 2: Access Router Admin Panel
1. Open web browser
2. Go to your router's IP (usually 192.168.1.1 or 192.168.0.1)
3. Login with admin credentials

### Step 3: Find DHCP Reservation Settings
Look for sections named:
- "DHCP Reservation"
- "Static DHCP"
- "Address Reservation" 
- "Reserved IP Addresses"
- "DHCP Client List" → "Reserve"

### Step 4: Add Reservation
- **Device Name**: AVIAN-Server (or any name)
- **MAC Address**: [MAC address from Step 1]
- **Reserved IP**: 192.168.1.116
- **Save/Apply** the settings

### Step 5: Test
```bash
# Restart server to test
sudo reboot

# After reboot, check IP is still 192.168.1.116
ip addr show
```

## Common Router Interfaces:

### Netgear:
Advanced → Setup → LAN Setup → Address Reservation

### Linksys:
Smart Wi-Fi Tools → Priority → Device Prioritization → Manual

### TP-Link:
Advanced → Network → DHCP Server → Address Reservation

### ASUS:
Adaptive QoS → Traditional QoS → Bandwidth Monitor → Client Status

### D-Link:
Setup → Network Settings → DHCP Reservation

## If You Can't Find DHCP Reservation:
1. Check router manual/documentation
2. Look for "Static DHCP" or "Reserved Addresses"
3. Some older routers may not support this feature
4. Consider upgrading router firmware

## Verification:
After configuration, the server should always get 192.168.1.116 even after restarts.