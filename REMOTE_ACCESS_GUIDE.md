# AVIAN Platform Remote Access Guide

## Quick Access Instructions

### Step 1: Connect via SSH Tunnel
From your Mac (on any network - hotspot, coffee shop, etc.):

```bash
ssh -L 8443:localhost:443 avian@209.227.150.115
```

**Keep this terminal window open** - it maintains the tunnel.

### Step 2: Access AVIAN Platform
Open your web browser and go to:
```
https://localhost:8443
```

**Note:** You'll see a certificate warning - click "Advanced" → "Proceed to localhost" (safe to ignore)

### Step 3: Login
- **Email:** `admin@avian.local`
- **Password:** `admin123`

---

## Server Details
- **Server IP (Internal):** 192.168.1.116
- **Public IP:** 209.227.150.115
- **SSH Port:** 22 (default)
- **AVIAN Ports:** 80 (HTTP), 443 (HTTPS)
- **SSH User:** avian

---

## Alternative Access Methods

### Option 1: Both HTTP and HTTPS Tunnels
```bash
ssh -L 8080:localhost:80 -L 8443:localhost:443 avian@209.227.150.115
```
- HTTP: `http://localhost:8080` (redirects to HTTPS)
- HTTPS: `https://localhost:8443`

### Option 2: SSH Config Shortcut
Add this to `~/.ssh/config` on your Mac:

```bash
Host avian-tunnel
    HostName 209.227.150.115
    User avian
    LocalForward 8443 localhost:443
    LocalForward 8080 localhost:80
```

Then just run:
```bash
ssh avian-tunnel
```

---

## Troubleshooting

### Connection Issues
1. **SSH fails:** Check internet connection, try different network
2. **Tunnel hangs:** Make sure you're using port 22 for SSH (not 51820)
3. **Browser won't load:** Ensure SSH tunnel is still active

### Test SSH Connection
```bash
ssh avian@209.227.150.115
```
Should connect without issues.

### Test Tunnel
```bash
curl -I http://localhost:8080
```
Should return HTTP 301 redirect.

---

## Security Notes
- SSH tunnel encrypts all traffic between your Mac and server
- Only you can access localhost:8443 on your Mac
- Works from any network (home, mobile hotspot, public WiFi)
- No router configuration needed
- No VPN setup required

---

## WireGuard Alternative (If Needed Later)
WireGuard is configured but requires router port forwarding:
- **Server Config:** `/etc/wireguard/wg0.conf`
- **Client Config:** `~/wg0-client.conf`
- **Port:** 8443 (needs router forwarding)

For now, SSH tunneling is the easiest and most reliable method.

---

## Quick Reference Commands

**Connect:**
```bash
ssh -L 8443:localhost:443 avian@209.227.150.115
```

**Access:**
```
https://localhost:8443
```

**Login:**
- admin@avian.local / admin123

**Disconnect:**
- Close SSH terminal or press Ctrl+C