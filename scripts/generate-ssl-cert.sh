#!/bin/bash

# AVIAN Platform - SSL Certificate Generator
# Generates self-signed SSL certificate for production deployment

set -e

echo "🔐 Generating SSL certificate for AVIAN Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create SSL directory
mkdir -p nginx/ssl

# Get server information
echo -e "${BLUE}📝 SSL Certificate Configuration${NC}"
echo "Please provide the following information for your SSL certificate:"
echo ""

read -p "Server domain name or IP address: " SERVER_NAME
read -p "Organization name: " ORG_NAME
read -p "Country code (2 letters, e.g., US): " COUNTRY
read -p "State/Province: " STATE
read -p "City: " CITY

echo ""
echo -e "${YELLOW}🔑 Generating SSL certificate...${NC}"

# Generate private key
openssl genrsa -out nginx/ssl/server.key 2048

# Generate certificate signing request
openssl req -new -key nginx/ssl/server.key -out nginx/ssl/server.csr -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG_NAME/CN=$SERVER_NAME"

# Generate self-signed certificate (valid for 1 year)
openssl x509 -req -days 365 -in nginx/ssl/server.csr -signkey nginx/ssl/server.key -out nginx/ssl/server.crt

# Set proper permissions
chmod 600 nginx/ssl/server.key
chmod 644 nginx/ssl/server.crt

# Clean up CSR file
rm nginx/ssl/server.csr

echo -e "${GREEN}✅ SSL certificate generated successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Certificate Information:${NC}"
echo "Certificate: nginx/ssl/server.crt"
echo "Private Key: nginx/ssl/server.key"
echo "Valid for: 365 days"
echo "Server Name: $SERVER_NAME"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT NOTES:${NC}"
echo "1. This is a self-signed certificate - browsers will show a security warning"
echo "2. For production, consider using Let's Encrypt or a commercial certificate"
echo "3. Update your .env.production file with the correct domain: $SERVER_NAME"
echo "4. The certificate is valid for 1 year from today"
echo ""
echo -e "${GREEN}🚀 SSL certificate ready for deployment!${NC}"

# Update .env.production with the server name if it exists
if [ -f ".env.production" ]; then
    echo -e "${BLUE}📝 Updating .env.production with server domain...${NC}"
    sed -i.bak "s/your-server-domain\.com/$SERVER_NAME/g" .env.production
    rm .env.production.bak
    echo -e "${GREEN}✅ .env.production updated with domain: $SERVER_NAME${NC}"
fi