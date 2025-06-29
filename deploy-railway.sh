#!/bin/bash

echo "🚀 Deploying Pokemon Collectr to Railway..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

# Build the client
echo "🔨 Building React client..."
npm run build

# Check if build was successful
if [ ! -d "client/build" ]; then
    echo "❌ Error: Client build failed. Build directory not found."
    exit 1
fi

echo "✅ Build completed successfully!"
echo "📁 Build directory: client/build"

# Check for Railway CLI
if command -v railway &> /dev/null; then
    echo "🚂 Railway CLI found. You can deploy with: railway up"
else
    echo "ℹ️  Railway CLI not found. Deploy through Railway dashboard or install with: npm install -g @railway/cli"
fi

echo "🎉 Ready for deployment!" 