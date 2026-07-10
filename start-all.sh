#!/bin/bash

echo "🚀 Starting TakeAway Platform..."

# Setup a trap to kill all background processes when the script exits
trap 'echo "🛑 Stopping services..."; kill $(jobs -p)' EXIT

# 1. Start Backend
echo "📦 Starting Backend on port 3000..."
cd backend
npm start &
cd ..

# Give the backend a couple of seconds to spin up
sleep 3

# 2. Start Admin Web
echo "💻 Starting Admin Web Dashboard..."
cd admin-web
npm run dev &
cd ..

# Give the Vite server a second to start
sleep 2

# 4. Start Mobile App
echo "📱 Starting Mobile App Expo Server..."
cd mobile-app

# Clear stale Metro process (causes "Could not connect to the server" in simulator)
if lsof -ti :8081 >/dev/null 2>&1; then
  echo "♻️  Clearing stale process on port 8081..."
  lsof -ti :8081 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Only use the iOS Simulator when Xcode is actually installed
IOS_FLAG=""
if xcrun simctl list devices >/dev/null 2>&1 && [ -d /Applications/Xcode.app ]; then
  IOS_FLAG="--ios"

  # Ensure iOS Simulator is running and booted
  if ! xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
    echo "🖥️  No booted iOS simulator found. Launching Simulator app..."
    open -a Simulator
    # Give it a few seconds to initialize and start booting
    sleep 6
  fi

  # Pre-launch Expo Go on a booted iOS simulator
  if xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
    echo "📲 Warming up Expo Go on booted simulator..."
    xcrun simctl launch booted host.exp.Exponent >/dev/null 2>&1 || true
    sleep 2
  fi
else
  echo "📱 Xcode not installed — skipping iOS Simulator. Scan the QR code with Expo Go on your phone."
fi

# Don't force EXPO_PUBLIC_API_URL here: the app derives the backend URL from
# Metro's LAN host (App.js getDevApiUrl), which works for both physical
# devices and the simulator. Hardcoding localhost breaks physical phones.
EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1 ./node_modules/.bin/expo start --lan --go $IOS_FLAG
