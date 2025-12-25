#!/bin/bash

# AWS SDK Client Component Fix Deployment Script
# Run this script in your project root directory

echo "Deploying AWS SDK fixes..."

# Create API route directories
# mkdir -p src/app/api/auth/login
# mkdir -p src/app/api/auth/logout  
# mkdir -p src/app/api/auth/validate

# Copy API routes
cp api/auth/login-route.ts ../src/app/api/auth/login/route.ts
cp api/auth/logout-route.ts ../src/app/api/auth/logout/route.ts
cp api/auth/validate-route.ts ../src/app/api/auth/validate/route.ts

# Copy modified files
cp contexts/AuthContext.tsx ../src/contexts/
cp lib/aws/*.ts ../src/lib/aws/
cp next.config.js ../.

echo "Files copied successfully!"
echo ""
echo "Next steps:"
echo "1. Run: npm install server-only"
echo "2. Test: npm run build"
echo "3. Deploy to Amplify"

# Optional: Install dependency automatically
read -p "Install server-only dependency now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm install server-only
    echo "Dependencies installed!"
fi

echo "Fix deployment complete!"
