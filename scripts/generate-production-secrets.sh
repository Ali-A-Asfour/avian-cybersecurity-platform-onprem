#!/bin/bash

# AVIAN Platform - Production Secrets Generator
# This script generates secure secrets for production deployment

set -e

echo "🔐 Generating production secrets for AVIAN Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to generate random string
generate_secret() {
    local length=${1:-32}
    openssl rand -hex $length
}

# Function to generate password
generate_password() {
    local length=${1:-16}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production file not found!${NC}"
    echo "Please create .env.production from .env.production.template first"
    exit 1
fi

echo -e "${BLUE}📝 Backing up current .env.production...${NC}"
cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)

echo -e "${YELLOW}🔑 Generating secrets...${NC}"

# Generate secrets
JWT_SECRET=$(generate_secret 32)
JWT_REFRESH_SECRET=$(generate_secret 32)
NEXTAUTH_SECRET=$(generate_secret 32)
SESSION_SECRET=$(generate_secret 32)
POSTGRES_PASSWORD=$(generate_password 20)
REDIS_PASSWORD=$(generate_password 16)
FIREWALL_ENCRYPTION_KEY=$(generate_secret 32)

echo -e "${GREEN}✅ Secrets generated successfully!${NC}"

# Update .env.production file
echo -e "${BLUE}📝 Updating .env.production with new secrets...${NC}"

# Use sed to replace placeholder values
sed -i.bak \
    -e "s/CHANGE_THIS_JWT_SECRET_32_CHARS_MIN/$JWT_SECRET/g" \
    -e "s/CHANGE_THIS_REFRESH_SECRET_32_CHARS_MIN/$JWT_REFRESH_SECRET/g" \
    -e "s/CHANGE_THIS_NEXTAUTH_SECRET_32_CHARS_MIN/$NEXTAUTH_SECRET/g" \
    -e "s/CHANGE_THIS_SESSION_SECRET_32_CHARS_MIN/$SESSION_SECRET/g" \
    -e "s/CHANGE_THIS_PASSWORD/$POSTGRES_PASSWORD/g" \
    -e "s/CHANGE_THIS_REDIS_PASSWORD/$REDIS_PASSWORD/g" \
    -e "s/CHANGE_THIS_64_CHAR_HEX_KEY_FOR_FIREWALL_CREDENTIALS/$FIREWALL_ENCRYPTION_KEY/g" \
    .env.production

# Remove backup file created by sed
rm .env.production.bak

echo -e "${GREEN}✅ Production secrets configured!${NC}"
echo ""
echo -e "${YELLOW}📋 IMPORTANT: Save these credentials securely:${NC}"
echo -e "${BLUE}Database Password:${NC} $POSTGRES_PASSWORD"
echo -e "${BLUE}Redis Password:${NC} $REDIS_PASSWORD"
echo ""
echo -e "${YELLOW}⚠️  SECURITY REMINDERS:${NC}"
echo "1. Update your-server-domain.com in .env.production with your actual domain/IP"
echo "2. Configure SMTP settings with your email provider"
echo "3. Set proper file permissions: chmod 600 .env.production"
echo "4. Never commit .env.production to version control"
echo ""
echo -e "${GREEN}🚀 Ready for deployment!${NC}"