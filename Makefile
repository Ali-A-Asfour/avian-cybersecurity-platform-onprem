# AVIAN Platform Makefile

.PHONY: help build dev test lint format clean docker-build docker-run k8s-deploy

# Default target
help:
	@echo "AVIAN Platform Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  dev          Start development server"
	@echo "  build        Build production application"
	@echo "  test         Run tests"
	@echo "  lint         Run linting"
	@echo "  format       Format code"
	@echo "  clean        Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  docker-build Build Docker image"
	@echo "  docker-run   Run Docker container"
	@echo "  docker-dev   Start development environment with Docker Compose"
	@echo ""
	@echo "Kubernetes:"
	@echo "  k8s-deploy   Deploy to Kubernetes (staging)"
	@echo "  k8s-prod     Deploy to Kubernetes (production)"
	@echo "  k8s-clean    Clean Kubernetes resources"
	@echo ""
	@echo "Database:"
	@echo "  db-migrate   Run database migrations"
	@echo "  db-seed      Seed database with sample data"
	@echo "  db-reset     Reset database"
	@echo ""
	@echo "Utilities:"
	@echo "  backup       Create backup"
	@echo "  logs         View application logs"

# Development commands
dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf .next
	rm -rf out
	rm -rf build
	rm -rf dist
	rm -rf coverage

# Docker commands
docker-build:
	docker build -t avian-platform:latest .

docker-run:
	docker run -p 3000:3000 --env-file .env.local avian-platform:latest

docker-dev:
	docker-compose -f docker-compose.dev.yml up --build

docker-prod:
	docker-compose up --build -d

docker-stop:
	docker-compose down

docker-logs:
	docker-compose logs -f app

# Kubernetes commands
k8s-deploy:
	./scripts/deploy.sh staging

k8s-prod:
	./scripts/deploy.sh production

k8s-clean:
	kubectl delete namespace avian-platform --ignore-not-found=true

k8s-status:
	kubectl get all -n avian-platform

k8s-logs:
	kubectl logs -f deployment/avian-app -n avian-platform

# Database commands
db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

db-reset:
	npm run db:push
	npm run db:seed

db-studio:
	npm run db:studio

# Backup and maintenance
backup:
	./scripts/backup.sh

restore:
	@echo "Usage: make restore BACKUP_FILE=/path/to/backup.tar.gz"
	@if [ -n "$(BACKUP_FILE)" ]; then ./scripts/restore.sh $(BACKUP_FILE); fi

# Monitoring and logs
logs:
	@if [ -f "docker-compose.yml" ]; then \
		docker-compose logs -f app; \
	else \
		kubectl logs -f deployment/avian-app -n avian-platform; \
	fi

health:
	@echo "Checking application health..."
	@curl -f http://localhost:3000/api/health/live || echo "Application not responding"

# Security scanning
security-scan:
	npm audit
	docker run --rm -v $(PWD):/app aquasec/trivy fs /app

# Performance testing
load-test:
	@echo "Running load tests..."
	@if command -v k6 >/dev/null 2>&1; then \
		k6 run tests/load/basic.js; \
	else \
		echo "k6 not installed. Install from https://k6.io/docs/getting-started/installation/"; \
	fi

# Environment setup
setup-dev:
	npm install
	cp .env.example .env.local
	@echo "Development environment setup complete"
	@echo "Please update .env.local with your configuration"

setup-prod:
	@echo "Setting up production environment..."
	@echo "Please ensure all secrets are properly configured"