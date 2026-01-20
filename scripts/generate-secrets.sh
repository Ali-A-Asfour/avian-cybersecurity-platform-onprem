#!/bin/bash

# AVIAN Platform - Secret Generation Script
# Generates secure secrets for alpha/production deployment

echo "🔐 Generating secure secrets for AVIAN Platform..."
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
REDIS_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

echo "✅ Generated secrets:"
echo ""
echo "# Add these to your .env.production file:"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo ""
echo "# Database passwords:"
echo "DATABASE_PASSWORD=$DB_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo ""
echo "# Full database URLs (update host as needed):"
echo "DATABASE_URL=postgresql://avian_alpha:$DB_PASSWORD@localhost:5432/avian_alpha"
echo "REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379"
echo ""

# Optionally write to file
read -p "💾 Save secrets to secrets.txt file? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cat > secrets.txt << EOF
# AVIAN Platform Secrets - Generated $(date)
# KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT

JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
SESSION_SECRET=$SESSION_SECRET
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Database Configuration
DATABASE_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD

# Full URLs
DATABASE_URL=postgresql://avian_alpha:$DB_PASSWORD@localhost:5432/avian_alpha
REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379
EOF
    echo "✅ Secrets saved to secrets.txt"
    echo "⚠️  Remember to keep this file secure and delete it after copying to .env.production"
fi

echo ""
echo "🚀 Next steps:"
echo "1. Copy these secrets to your .env.production file"
echo "2. Update domain names and email configuration"
echo "3. Deploy with: docker-compose -f docker-compose.production.yml up -d"