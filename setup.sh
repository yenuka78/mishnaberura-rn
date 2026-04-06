#!/bin/bash
# Setup script for Mishna Berura React Native app
set -e

echo "Installing dependencies..."
npm install

echo "Running expo prebuild (generates android/ directory)..."
npx expo prebuild --platform android --clean

echo "Copying HTML assets..."
ASSETS_SRC="./assets"
ASSETS_DST="android/app/src/main/assets"
mkdir -p "$ASSETS_DST"
cp "$ASSETS_SRC"/*.html "$ASSETS_DST/"
cp "$ASSETS_SRC"/*.css "$ASSETS_DST/"
cp "$ASSETS_SRC"/*.ttf "$ASSETS_DST/"

echo "Done. Run: npx expo run:android"
