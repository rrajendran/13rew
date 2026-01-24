#!/bin/bash

# 13rew Setup Script

echo "🚀 Setting up 13rew..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js $(node --version) found"

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "⚠️  Homebrew not found. 13rew requires Homebrew to be installed."
    echo "   Visit: https://brew.sh/"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Homebrew $(brew --version | head -n1) found"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "To start 13rew:"
    echo "  npm run dev      # Development mode (with DevTools)"
    echo "  npm start        # Production mode"
    echo ""
    echo "To build for distribution:"
    echo "  npm run build    # Creates DMG in dist/ folder"
    echo ""
else
    echo ""
    echo "❌ Failed to install dependencies"
    echo "   Try running: npm install --verbose"
    exit 1
fi
