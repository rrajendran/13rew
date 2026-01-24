#!/bin/bash

# 13rew - Installation Verification Script

echo "🔍 13rew Installation Check"
echo "==================================="
echo ""

# Check Node.js
echo -n "Node.js: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ $NODE_VERSION"
else
    echo "❌ Not found"
    echo "   Install from: https://nodejs.org/"
fi

# Check npm
echo -n "npm: "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ v$NPM_VERSION"
else
    echo "❌ Not found"
fi

# Check Homebrew
echo -n "Homebrew: "
if command -v brew &> /dev/null; then
    BREW_VERSION=$(brew --version | head -n1)
    echo "✅ $BREW_VERSION"
else
    echo "⚠️  Not found"
    echo "   Install from: https://brew.sh/"
fi

# Check project files
echo ""
echo "📁 Project Files:"

check_file() {
    if [ -f "$1" ]; then
        echo "   ✅ $1"
    else
        echo "   ❌ Missing: $1"
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo "   ✅ $1/"
    else
        echo "   ❌ Missing: $1/"
    fi
}

check_file "package.json"
check_dir "src"
check_dir "src/main"
check_dir "src/renderer"
check_file "src/main/main.js"
check_file "src/main/preload.js"
check_file "src/renderer/index.html"
check_dir "src/renderer/js"
check_dir "src/renderer/styles"

# Check if node_modules exists
echo ""
if [ -d "node_modules" ]; then
    echo "📦 Dependencies: ✅ Installed"
else
    echo "📦 Dependencies: ⚠️  Not installed"
    echo "   Run: npm install"
fi

# Check documentation
echo ""
echo "📚 Documentation:"
check_file "README.md"
check_file "GETTING_STARTED.md"
check_file "DEVELOPMENT.md"
check_file "ARCHITECTURE.md"
check_file "QUICK_REFERENCE.md"

echo ""
echo "==================================="

# Summary
echo ""
if command -v node &> /dev/null && [ -f "package.json" ]; then
    echo "✅ Ready to run!"
    echo ""
    echo "Next steps:"
    if [ ! -d "node_modules" ]; then
        echo "  1. npm install"
        echo "  2. npm run dev"
    else
        echo "  npm run dev"
    fi
else
    echo "⚠️  Not ready"
    echo ""
    echo "Please:"
    if ! command -v node &> /dev/null; then
        echo "  • Install Node.js 18+ from https://nodejs.org/"
    fi
    if [ ! -f "package.json" ]; then
        echo "  • Ensure you're in the brew-manager directory"
    fi
fi

echo ""
