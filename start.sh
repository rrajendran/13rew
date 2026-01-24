#!/bin/bash

echo "🚀 Starting 13rew..."
echo ""

# Quick brew check
if command -v brew &> /dev/null; then
    BREW_LOCATION=$(command -v brew)
    echo "✅ Homebrew detected at: $BREW_LOCATION"
else
    echo "⚠️  Homebrew not found in PATH"
    echo "   The app will still start, but you'll need to configure the path in Settings"
    echo ""
    
    # Check common locations
    if [ -f "/opt/homebrew/bin/brew" ]; then
        echo "   Found brew at: /opt/homebrew/bin/brew"
    elif [ -f "/usr/local/bin/brew" ]; then
        echo "   Found brew at: /usr/local/bin/brew"
    else
        echo "   Please install Homebrew from: https://brew.sh/"
    fi
fi

echo ""
echo "Starting app..."
npm run dev
