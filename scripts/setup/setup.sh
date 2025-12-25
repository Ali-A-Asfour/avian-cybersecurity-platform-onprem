#!/bin/bash

# AVIAN Platform Setup Script
echo "🚀 Setting up AVIAN Cybersecurity Platform..."

# Check if nvm is installed
if ! command -v nvm &> /dev/null; then
    echo "📦 Installing Node Version Manager (nvm)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use the correct Node.js version
echo "📦 Installing Node.js LTS..."
nvm install
nvm use

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "⚙️ Creating .env.local file..."
    cp config/development.env .env.local
fi

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   1. Start development server: npm run dev"
echo "   2. Open http://localhost:3000 in your browser"
echo "   3. For production build: npm run build"
echo ""
echo "📚 Available commands:"
echo "   npm run dev          - Start development server"
echo "   npm run build        - Build for production"
echo "   npm run start        - Start production server"
echo "   npm run lint         - Run linting"
echo "   npm run test         - Run tests"
echo ""
