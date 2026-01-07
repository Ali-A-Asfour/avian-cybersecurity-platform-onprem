# TLS Configuration Guide

## Overview

This document provides guidance for configuring TLS 1.2+ for the AVIAN platform in production environments.

**Requirement:** 13.3 - Configure TLS 1.2+ only

## Application-Level Configuration

The AVIAN Next.js application includes the following HTTPS enforcement mechanisms:

### 1. Middleware HTTPS Redirect (Production Only)

Location: `src/middleware.ts`

```typescript
// Automatically redirects HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  if (protocol === 'http') {
    return NextResponse.redirect(httpsUrl, 301);
  }
}
```

### 2. HSTS Header

Location: `next.config.ts`

```typescript
{
  key: 'Strict-Transport-Security',
  value: 'max-age=63072000; includeSubDomains; preload'
}
```

- **max-age**: 2 years (63072000 seconds)
- **includeSubDomains**: Applies to all subdomains
- **preload**: Eligible for browser HSTS preload lists

### 3. Secure Cookies

Location: `src/lib/jwt.ts`

```typescript
secure: process.env.NODE_ENV === 'production'
```

All session cookies are marked as `Secure` in production, ensuring they're only transmitted over HTTPS.

## Infrastructure-Level TLS Configuration

TLS protocol versions and cipher suites must be configured at the infrastructure level. Below are recommended configurations for common deployment scenarios.

### Nginx Configuration

If using Nginx as a reverse proxy, add the following to your server block:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # TLS Configuration - Require TLS 1.2 and 1.3 only
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Strong cipher suites (Mozilla Modern configuration)
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    
    # Prefer server ciphers
    ssl_prefer_server_ciphers off;
    
    # SSL session configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # SSL certificate paths
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_trusted_certificate /path/to/chain.pem;
    
    # Proxy to Next.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### AWS Application Load Balancer (ALB)

If deploying on AWS with an Application Load Balancer:

1. **Create/Update Security Policy:**
   - Use `ELBSecurityPolicy-TLS-1-2-2017-01` or newer
   - This policy supports TLS 1.2 and TLS 1.3 only

2. **Configure HTTPS Listener:**
   ```bash
   aws elbv2 create-listener \
     --load-balancer-arn <your-alb-arn> \
     --protocol HTTPS \
     --port 443 \
     --certificates CertificateArn=<your-cert-arn> \
     --ssl-policy ELBSecurityPolicy-TLS-1-2-2017-01 \
     --default-actions Type=forward,TargetGroupArn=<your-target-group-arn>
   ```

3. **Configure HTTP to HTTPS Redirect:**
   ```bash
   aws elbv2 create-listener \
     --load-balancer-arn <your-alb-arn> \
     --protocol HTTP \
     --port 80 \
     --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
   ```

### Docker with Nginx

If using Docker Compose with Nginx:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

  app:
    build: .
    environment:
      - NODE_ENV=production
    expose:
      - "3000"
    restart: unless-stopped
```

## SSL Certificate Management

### Let's Encrypt (Recommended for Production)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

### Self-Signed Certificate (Development/Testing Only)

```bash
# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/selfsigned.key \
  -out /etc/ssl/certs/selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## Verification

### Test TLS Configuration

Use SSL Labs to test your TLS configuration:
```
https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

Target grade: **A or A+**

### Command-Line Testing

```bash
# Test TLS 1.2 (should succeed)
openssl s_client -connect your-domain.com:443 -tls1_2

# Test TLS 1.1 (should fail)
openssl s_client -connect your-domain.com:443 -tls1_1

# Test TLS 1.0 (should fail)
openssl s_client -connect your-domain.com:443 -tls1
```

### Check HSTS Header

```bash
curl -I https://your-domain.com | grep -i strict-transport-security
```

Expected output:
```
strict-transport-security: max-age=63072000; includeSubDomains; preload
```

## Security Checklist

- [ ] TLS 1.2 and 1.3 enabled
- [ ] TLS 1.0 and 1.1 disabled
- [ ] Strong cipher suites configured
- [ ] HSTS header enabled with long max-age
- [ ] HTTP to HTTPS redirect configured
- [ ] SSL certificate valid and not expired
- [ ] OCSP stapling enabled (if using Nginx)
- [ ] SSL Labs grade A or A+

## Troubleshooting

### Issue: Mixed Content Warnings

**Cause:** Loading HTTP resources on HTTPS pages

**Solution:** Ensure all resources (images, scripts, stylesheets) use HTTPS or protocol-relative URLs

### Issue: Certificate Errors

**Cause:** Expired or invalid SSL certificate

**Solution:** 
```bash
# Check certificate expiration
openssl x509 -in /path/to/cert.pem -noout -dates

# Renew Let's Encrypt certificate
sudo certbot renew
```

### Issue: HSTS Not Working

**Cause:** Header not being sent or cached incorrectly

**Solution:**
1. Clear browser HSTS cache (chrome://net-internals/#hsts)
2. Verify header is present: `curl -I https://your-domain.com`
3. Restart web server

## References

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
