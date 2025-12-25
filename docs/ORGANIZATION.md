# Project Organization

This document explains the organized structure of the AVIAN Platform project.

## 📁 Directory Structure

```
project-code/
├── scripts/                    # All project scripts
│   ├── setup/                  # Setup and initialization
│   │   └── setup.sh           # Main setup script
│   └── testing/                # Testing scripts
│       ├── test-local.sh      # Local development testing
│       └── test-production.sh # Production build testing
├── docs/                       # Documentation
│   └── README.md              # Complete project documentation
├── src/                        # Application source code
├── database/                   # Database schemas and migrations
├── config/                     # Environment configurations
└── README.md                   # Quick start guide
```

## 🚀 Usage

### Setup
```bash
npm run setup
# or
./scripts/setup/setup.sh
```

### Testing
```bash
npm run test:local        # Test development build
npm run test:production   # Test production build
```

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
```

## 📋 Script Descriptions

- **setup.sh** - Installs Node.js, dependencies, and configures environment
- **test-local.sh** - Starts dev server and runs automated tests
- **test-production.sh** - Builds and tests production version
