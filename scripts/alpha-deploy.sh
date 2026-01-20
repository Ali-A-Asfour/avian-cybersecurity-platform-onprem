#!/bin/bash

# AVIAN Platform - Alpha Deployment Script
# Automated deployment for alpha testing environment

set -e  # Exit on any error

echo "🚀 AVIAN Platform Alpha Deployment"
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    echo ""
    echo "Please create .env.production file first:"
    echo "1. Copy .env.alpha to .env.production"
    echo "2. Update all configuration values"
    echo "3. Run ./scripts/generate-secrets.sh to generate secure secrets"
    exit 1
fi

# Load environment variables
source .env.production

# Validate required environment variables
required_vars=("DATABASE_URL" "JWT_SECRET" "NEXTAUTH_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set in .env.production"
        exit 1
    fi
done

echo "✅ Environment configuration validated"
echo ""

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p nginx/ssl
mkdir -p logs
mkdir -p backups

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.alpha.yml build --no-cache
docker-compose -f docker-compose.alpha.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
if docker-compose -f docker-compose.alpha.yml ps | grep -q "unhealthy\|Exit"; then
    echo "❌ Some services are not healthy. Checking logs..."
    docker-compose -f docker-compose.alpha.yml logs --tail=50
    exit 1
fi

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose -f docker-compose.alpha.yml exec -T app npm run db:migrate

# Seed initial data (optional)
read -p "🌱 Seed database with initial admin user? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f docker-compose.alpha.yml exec -T app npm run db:seed
    echo "✅ Database seeded with initial admin user"
    echo "   Email: admin@avian-platform.com"
    echo "   Password: Admin123!"
fi

# Test application health
echo "🏥 Testing application health..."
sleep 10
if docker-compose -f docker-compose.alpha.yml exec -T app curl -f http://localhost:3000/api/health/live > /dev/null 2>&1; then
    echo "✅ Application health check passed"
else
    echo "❌ Application health check failed"
    echo "Checking application logs..."
    docker-compose -f docker-compose.alpha.yml logs app --tail=20
    exit 1
fi

# Display deployment information
echo ""
echo "🎉 Alpha deployment completed successfully!"
echo "========================================"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.alpha.yml ps
echo ""
echo "🌐 Application URLs:"
echo "   Main Application: ${NEXTAUTH_URL}"
echo "   Health Check: ${NEXTAUTH_URL}/api/health/live"
echo "   Admin Panel: ${NEXTAUTH_URL}/admin"
echo ""
echo "👤 Default Admin Account (if seeded):"
echo "   Email: admin@avian-platform.com"
echo "   Password: Admin123!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure SSL certificate (if not done already)"
echo "2. Test all functionality"
echo "3. Create client user accounts"
echo "4. Configure firewall rules"
echo "5. Set up monitoring and backups"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs: docker-compose -f docker-compose.alpha.yml logs -f"
echo "   Stop services: docker-compose -f docker-compose.alpha.yml down"
echo "   Restart services: docker-compose -f docker-compose.alpha.yml restart"
echo "   Backup database: ./scripts/backup.sh"
echo ""
echo "📞 Support:"
echo "   Check ALPHA_DEPLOYMENT_GUIDE.md for detailed instructions"
echo "   Review troubleshooting section for common issues"
echo ""

# Optional: Configure SSL
if [ ! -f "nginx/ssl/cert.pem" ]; then
    echo "🔒 SSL Certificate Setup:"
    echo "   For Let's Encrypt: sudo certbot --nginx -d your-domain.com"
    echo "   For self-signed: openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem"
fi

echo "✅ Alpha deployment ready for testing!"