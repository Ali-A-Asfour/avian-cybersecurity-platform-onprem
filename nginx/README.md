# Nginx Configuration

This directory contains the Nginx configuration for the AVIAN platform production deployment.

## SSL/TLS Certificates

Before deploying to production, you need to provide SSL/TLS certificates.

### Option 1: Let's Encrypt (Recommended)

Use Certbot to obtain free SSL certificates:

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to nginx/ssl directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

### Option 2: Self-Signed Certificate (Development/Testing Only)

Generate a self-signed certificate for testing:

```bash
# Create ssl directory
mkdir -p nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

**Warning**: Self-signed certificates should NOT be used in production.

### Option 3: Commercial Certificate

If you have a commercial SSL certificate:

1. Place the certificate file in `nginx/ssl/cert.pem`
2. Place the private key file in `nginx/ssl/key.pem`
3. Ensure proper file permissions:
   ```bash
   chmod 600 nginx/ssl/key.pem
   chmod 644 nginx/ssl/cert.pem
   ```

## Certificate Renewal

### Let's Encrypt Auto-Renewal

Set up automatic renewal with a cron job:

```bash
# Add to crontab
0 0 * * * certbot renew --quiet && docker-compose -f docker-compose.production.yml restart nginx
```

## Configuration Files

- `nginx.conf` - Main Nginx configuration
  - HTTP to HTTPS redirect
  - SSL/TLS configuration (TLS 1.2+)
  - Security headers
  - Rate limiting
  - Reverse proxy to Next.js app

## Security Features

### TLS Configuration
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS with 2-year max-age
- SSL session caching

### Security Headers
- Strict-Transport-Security
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy
- Content-Security-Policy

### Rate Limiting
- General requests: 10 req/s
- API requests: 30 req/s
- Auth requests: 5 req/s

## Testing Configuration

Test Nginx configuration before deploying:

```bash
# Test configuration syntax
docker run --rm -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t

# Test with docker-compose
docker-compose -f docker-compose.production.yml config
```

## Troubleshooting

### Certificate Errors

If you see certificate errors:

1. Check certificate files exist:
   ```bash
   ls -la nginx/ssl/
   ```

2. Verify certificate validity:
   ```bash
   openssl x509 -in nginx/ssl/cert.pem -text -noout
   ```

3. Check certificate matches private key:
   ```bash
   openssl x509 -noout -modulus -in nginx/ssl/cert.pem | openssl md5
   openssl rsa -noout -modulus -in nginx/ssl/key.pem | openssl md5
   ```

### Connection Errors

If Nginx can't connect to the app:

1. Check app is running:
   ```bash
   docker-compose -f docker-compose.production.yml ps
   ```

2. Check app health:
   ```bash
   docker-compose -f docker-compose.production.yml exec app curl http://localhost:3000/api/health
   ```

3. Check Nginx logs:
   ```bash
   docker-compose -f docker-compose.production.yml logs nginx
   ```

## Performance Tuning

### Worker Processes

Adjust `worker_processes` in nginx.conf based on CPU cores:

```nginx
worker_processes auto;  # Automatically detect CPU cores
```

### Connection Limits

Adjust `worker_connections` based on expected load:

```nginx
events {
    worker_connections 1024;  # Increase for high traffic
}
```

### Rate Limits

Adjust rate limits in nginx.conf based on your needs:

```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
```

## References

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
