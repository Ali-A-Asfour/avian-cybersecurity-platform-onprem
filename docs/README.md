# AVIAN Cybersecurity Platform

A comprehensive cybersecurity management platform built with Next.js 16, featuring real-time threat monitoring, incident response, compliance management, and multi-tenant architecture.

## 🚀 Quick Start

### Prerequisites
- Node.js 20.9.0+ (automatically managed via nvm)
- PostgreSQL (for production)
- Redis (for caching and sessions)

### Setup

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd project-code
   ./setup.sh
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis
- **Authentication**: JWT with secure session management
- **Testing**: Jest, React Testing Library
- **Build**: Turbopack (Next.js 16 default)

### Key Features
- 🔐 **Multi-tenant Architecture** - Secure tenant isolation
- 🚨 **Real-time Threat Monitoring** - Live security alerts and incidents
- 📊 **Compliance Management** - HIPAA, SOC2, and custom frameworks
- 🎯 **Incident Response** - Automated playbooks and workflows
- 📈 **Analytics Dashboard** - Real-time security metrics
- 🔧 **Agent Management** - Deploy and manage security agents
- 📋 **Help Desk Integration** - Ticketing and support system
- 🔍 **Threat Intelligence** - Advanced threat correlation

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # Reusable React components
├── lib/                    # Utility functions and configurations
├── services/               # Business logic and API services
├── types/                  # TypeScript type definitions
├── middleware/             # Authentication and security middleware
├── hooks/                  # Custom React hooks
└── contexts/               # React context providers

database/
├── schemas/                # Drizzle ORM schemas
├── migrations/             # Database migrations
└── seeds/                  # Development data seeds

config/                     # Environment configurations
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev                 # Start development server
npm run build              # Build for production
npm run start              # Start production server

# Code Quality
npm run lint               # Run ESLint
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage

# Database
npm run db:generate        # Generate database migrations
npm run db:migrate         # Run database migrations
npm run db:push            # Push schema changes to database
npm run db:studio          # Open Drizzle Studio
npm run db:seed            # Seed development data

# Deployment
npm run docker:build       # Build Docker image
npm run k8s:deploy         # Deploy to Kubernetes
npm run aws:deploy         # Deploy to AWS
```

### Environment Configuration

The application uses environment-specific configuration files:

- `config/development.env` - Development settings
- `config/staging.env` - Staging environment
- `config/production.env` - Production environment
- `.env.local` - Local overrides (created automatically)

### Database Setup

For development, the application uses mock data by default. For production:

1. **Setup PostgreSQL:**
   ```bash
   # Install PostgreSQL
   brew install postgresql
   brew services start postgresql
   
   # Create database
   createdb avian_platform_dev
   ```

2. **Run migrations:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

### Redis Setup (Optional)

For caching and session management:

```bash
# Install Redis
brew install redis
brew services start redis
```

## 🔒 Security Features

- **Authentication**: JWT-based with secure session management
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encryption at rest and in transit
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API rate limiting and DDoS protection
- **Audit Logging**: Complete audit trail for security events
- **Multi-factor Authentication**: TOTP-based MFA support

## 🚀 Deployment

### Docker Deployment

```bash
# Build and run with Docker
npm run docker:build
npm run docker:prod
```

### AWS Deployment

```bash
# Deploy to AWS ECS
npm run aws:ecs

# Deploy with AWS Amplify
npm run aws:amplify
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes
npm run k8s:deploy
```

## 📊 Monitoring & Observability

- **Health Checks**: `/api/health/live` and `/api/health/ready`
- **Metrics**: Prometheus-compatible metrics endpoint
- **Logging**: Structured logging with configurable levels
- **Tracing**: Distributed tracing support
- **Alerts**: Real-time alerting and notification system

## 🧪 Testing

The project includes comprehensive testing:

- **Unit Tests**: Component and utility function tests
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user workflow testing
- **Security Tests**: Authentication and authorization testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for Next.js and React
- **Prettier**: Code formatting
- **Conventional Commits**: Commit message format
- **Testing**: Minimum 80% code coverage

## 📝 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:

- Check the documentation in `/docs`
- Review the troubleshooting guide
- Contact the development team

## 🔄 Version History

- **v0.1.0** - Initial release with core features
- Latest stable version with Next.js 16 and Node.js 24 LTS

---

**Built with ❤️ by the AVIAN Security Team**
