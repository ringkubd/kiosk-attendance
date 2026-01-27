#!/bin/bash

# Kiosk Attendance App Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Kiosk Attendance App - Setup Script"
echo "========================================"
echo ""

# Check Node.js
echo "📦 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version is $NODE_VERSION. Recommended: 18+"
else
    echo "✅ Node.js $(node -v)"
fi

# Check npm
echo ""
echo "📦 Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi
echo "✅ npm $(npm -v)"

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install

# Check for Android SDK
echo ""
echo "🤖 Checking Android SDK..."
if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  ANDROID_HOME is not set."
    echo "   Please set it to your Android SDK location:"
    echo "   export ANDROID_HOME=\$HOME/Android/Sdk"
else
    echo "✅ ANDROID_HOME: $ANDROID_HOME"
fi

# Check for model file
echo ""
echo "🧠 Checking for ONNX model..."
if [ -f "assets/models/MobileFaceNet.onnx" ]; then
    MODEL_SIZE=$(du -h "assets/models/MobileFaceNet.onnx" | cut -f1)
    echo "✅ Model found: $MODEL_SIZE"
else
    echo "⚠️  Model not found!"
    echo "   Please place MobileFaceNet.onnx in assets/models/"
    echo "   See assets/models/README.md for details"
fi

# Create placeholder model directory
mkdir -p assets/models

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Place MobileFaceNet.onnx in assets/models/"
echo "2. Run: npm run check-model"
echo "3. Run: npx expo prebuild --platform android"
echo "4. Run: npx expo run:android"
echo ""
echo "Or see QUICKSTART.md for detailed instructions"
