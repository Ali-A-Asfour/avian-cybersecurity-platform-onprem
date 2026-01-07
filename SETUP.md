# AVIAN Platform - Local Development Setup

This guide will help you set up the AVIAN Cybersecurity Platform for local development using Finch (Docker alternative).

## Prerequisites

- Node.js 20+ installed
- Finch installed with `docker` alias configured
- Git

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Database Services

Start PostgreSQL and Redis using Finch:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Verify services are running:

```bash
docker compose -f docker-compose.dev.yml ps
```

You should see both `postgres` and `redis` with status "Up".

### 3. Set Up Database

Run database migrations:

```bash
npm run db:migrate
```

(Optional) Seed development data:

```bash
npm run db:seed
```

### 4. Verify Configuration

The `.env.local` file has been created with development defaults. Review and adjust if needed:

```bash
cat .env.local
```

### 5. Start Development Server

```bash
npm run dev
```

The application should start at http://localhost:3000

### 6. Verify Health

Check that the application is running:

```bash
curl http://localhost:3000/api/health/live
```

You should see a JSON response with `"alive": true`.

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Check PostgreSQL is running:
   ```bash
   docker compose -f docker-compose.dev.yml ps postgres
   ```

2. Check PostgreSQL logs:
   ```bash
   docker compose -f docker-compose.dev.yml logs postgres
   ```

3. Test connection manually:
   ```bash
   docker compose -f docker-compose.dev.yml exec postgres psql -U avian -d avian -c "SELECT 1;"
   ```

### Redis Connection Issues

If you see Redis connection errors:

1. Check Redis is running:
   ```bash
   docker compose -f docker-compose.dev.yml ps redis
   ```

2. Test Redis connection:
   ```bash
   docker compose -f docker-compose.dev.yml exec redis redis-cli -a avian_dev_redis_password ping
   ```

### Port Conflicts

If ports 5432 or 6379 are already in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.dev.yml` and update `DATABASE_URL` and `REDIS_URL` in `.env.local`

### Clean Start

To completely reset your development environment:

```bash
# Stop all services
docker compose -f docker-compose.dev.yml down

# Remove volumes (WARNING: This deletes all data)
docker compose -f docker-compose.dev.yml down -v

# Start fresh
docker compose -f docker-compose.dev.yml up -d
npm run db:migrate
```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Database Management

```bash
# Generate new migration
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes (development only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

## Services

### PostgreSQL

- **Host**: localhost
- **Port**: 5432
- **Database**: avian
- **User**: avian
- **Password**: avian_dev_password

### Redis

- **Host**: localhost
- **Port**: 6379
- **Password**: avian_dev_redis_password

## Next Steps

1. Review the implementation plan in `.kiro/specs/self-hosted-security-migration/tasks.md`
2. Start with Task 0.4: Remove AWS SDK dependencies
3. Follow the tasks sequentially to implement authentication and security features

## Useful Commands

```bash
# View all running containers
docker ps

# View container logs
docker compose -f docker-compose.dev.yml logs -f

# Stop services
docker compose -f docker-compose.dev.yml stop

# Start services
docker compose -f docker-compose.dev.yml start

# Restart services
docker compose -f docker-compose.dev.yml restart

# Remove everything (including volumes)
docker compose -f docker-compose.dev.yml down -v
```

## Support

If you encounter issues not covered here, check:
1. The troubleshooting section above
2. Container logs: `docker compose -f docker-compose.dev.yml logs`
3. Application logs in the terminal where `npm run dev` is running
