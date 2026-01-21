#!/bin/bash

# AVIAN Platform - Quick Setup Script
# One-command setup for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    AVIAN Platform                            ║"
echo "║              Production Quick Setup                          ║"
echo "║                                                              ║"
echo "║  This script will prepare your system for deployment        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Please don't run this script as root${NC}"
    echo "Run as a regular user with sudo privileges"
    exit 1
fi

# System requirements check
echo -e "${BLUE}🔍 Checking system requirements...${NC}"

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "${GREEN}✅ OS: $PRETTY_NAME${NC}"
else
    echo -e "${YELLOW}⚠️  Could not detect OS version${NC}"
fi

# Check available memory
MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
if [ "$MEMORY_GB" -lt 8 ]; then
    echo -e "${YELLOW}⚠️  Warning: Only ${MEMORY_GB}GB RAM detected. 16GB+ recommended${NC}"
else
    echo -e "${GREEN}✅ Memory: ${MEMORY_GB}GB${NC}"
fi

# Check available disk space
DISK_GB=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
if [ "$DISK_GB" -lt 100 ]; then
    echo -e "${YELLOW}⚠️  Warning: Only ${DISK_GB}GB disk space available. 500GB+ recommended${NC}"
else
    echo -e "${GREEN}✅ Disk space: ${DISK_GB}GB available${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Starting AVIAN Platform setup...${NC}"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# Install additional tools
echo -e "${YELLOW}📦 Installing additional tools...${NC}"
sudo apt update
sudo apt install -y curl wget git vim htop ufw fail2ban openssl

# Configure firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
echo -e "${GREEN}✅ Firewall configured${NC}"

# Make scripts executable
echo -e "${YELLOW}🔧 Setting up deployment scripts...${NC}"
chmod +x scripts/*.sh
echo -e "${GREEN}✅ Scripts configured${NC}"

echo ""
echo -e "${GREEN}🎉 System setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Run: ./scripts/deploy-production.sh"
echo "2. Follow the prompts to configure your domain and SSL"
echo "3. Access your platform at https://your-domain"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "• You may need to log out and back in for Docker group changes to take effect"
echo "• Make sure your domain DNS points to this server's IP address"
echo "• Configure email settings in .env.production after deployment"
echo ""
echo -e "${GREEN}Ready for deployment! 🚀${NC}"