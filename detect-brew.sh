#!/bin/bash

echo "🔍 Detecting Homebrew installation..."
echo ""

# Check common paths
echo "Checking common locations:"

if [ -f "/opt/homebrew/bin/brew" ]; then
    echo "✅ Found: /opt/homebrew/bin/brew (Apple Silicon)"
    BREW_PATH="/opt/homebrew/bin/brew"
elif [ -f "/usr/local/bin/brew" ]; then
    echo "✅ Found: /usr/local/bin/brew (Intel Mac)"
    BREW_PATH="/usr/local/bin/brew"
else
    echo "❌ Not found in common locations"
fi

echo ""
echo "Checking with 'which brew':"
if command -v brew &> /dev/null; then
    WHICH_BREW=$(which brew)
    echo "✅ Found: $WHICH_BREW"
    
    # Check if it's a symlink
    if [ -L "$WHICH_BREW" ]; then
        REAL_PATH=$(readlink -f "$WHICH_BREW" 2>/dev/null || readlink "$WHICH_BREW")
        echo "   → Points to: $REAL_PATH"
    fi
    
    echo ""
    echo "Homebrew version:"
    brew --version | head -n1
else
    echo "❌ brew command not found in PATH"
fi

echo ""
echo "Your PATH includes:"
echo "$PATH" | tr ':' '\n' | grep -i brew || echo "(no brew-related paths)"

echo ""
if [ ! -z "$BREW_PATH" ]; then
    echo "✅ 13rew will use: $BREW_PATH"
else
    echo "⚠️  Please install Homebrew from: https://brew.sh/"
fi
