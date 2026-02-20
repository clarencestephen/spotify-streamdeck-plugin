#!/bin/bash
set -e

echo ""
echo "  Essentials for Spotify - Installer"
echo "  ===================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is not installed."
    echo "  Download it from https://nodejs.org/ (version 20 or later)"
    exit 1
fi

# Check Node.js version
NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 20 ]; then
    echo "  [ERROR] Node.js 20 or later is required. You have v${NODE_VER}."
    echo "  Download it from https://nodejs.org/"
    exit 1
fi

echo "  [1/3] Installing dependencies..."
npm install --silent

echo "  [2/3] Building plugin..."
npm run build --silent

echo "  [3/3] Installing to Stream Deck..."
PLUGIN_DIR="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/com.cognosis.spotify-playlist-ops.sdPlugin"

# Remove old installation if present
if [ -d "$PLUGIN_DIR" ]; then
    echo "  Removing previous installation..."
    rm -rf "$PLUGIN_DIR"
fi

# Copy plugin
cp -r "com.cognosis.spotify-playlist-ops.sdPlugin" "$PLUGIN_DIR"

echo ""
echo "  Done! Restart Stream Deck to load the plugin."
echo "  Then drag the \"Setup\" button onto your deck to get started."
echo ""
