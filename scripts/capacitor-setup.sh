#!/bin/bash

# Capacitor Setup Script for TalkMe Chat
# This script initializes Capacitor and sets up Android platform

set -e

echo "🚀 Starting Capacitor Setup..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the web app
echo "🔨 Building web application..."
npm run build

# Initialize Capacitor
echo "⚙️  Initializing Capacitor..."
npx cap init talkme com.talkme.app --web-dir=dist || echo "ℹ️  Capacitor already initialized"

# Add Android platform
echo "🤖 Adding Android platform..."
npx cap add android || echo "ℹ️  Android platform already added"

# Copy web assets
echo "📱 Copying web assets to Android..."
npx cap copy android

# Sync platforms
echo "🔄 Syncing platforms..."
npx cap sync

# Fix permissions
echo "🔐 Setting executable permissions..."
if [ -f "android/gradlew" ]; then
    chmod +x android/gradlew
fi

echo "✅ Capacitor setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run cap:open:android' to open Android Studio"
echo "2. Connect an Android device or start an emulator"
echo "3. Run the app from Android Studio"
