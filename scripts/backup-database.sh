#!/bin/bash

# AVIAN Platform - Database Backup Script
# Creates compressed backups of PostgreSQL database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="avian_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

echo -e "${BLUE}🗄️  Starting database backup...${NC}"

# Load environment variables
if [ -f "/.env.production" ]; then
    source /.env.production
elif [ -f "/scripts/../.env.production" ]; then
    source /scripts/../.env.production
else
    echo -e "${RED}❌ .env.production file not found!${NC}"
    exit 1
fi

# Create backup directory
mkdir -p $BACKUP_DIR

echo -e "${YELLOW}📦 Creating backup: $BACKUP_FILE${NC}"

# Create database backup
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
    -h postgres \
    -U $POSTGRES_USER \
    -d $POSTGRES_DB \
    --verbose \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip > "$BACKUP_DIR/$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created successfully: $BACKUP_FILE${NC}"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo -e "${BLUE}📊 Backup size: $BACKUP_SIZE${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Clean up old backups (keep last 30 days)
echo -e "${YELLOW}🧹 Cleaning up old backups (keeping last $RETENTION_DAYS days)...${NC}"
find $BACKUP_DIR -name "avian_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List current backups
echo -e "${BLUE}📋 Current backups:${NC}"
ls -lh $BACKUP_DIR/avian_backup_*.sql.gz 2>/dev/null || echo "No backups found"

echo -e "${GREEN}🎉 Backup process completed!${NC}"