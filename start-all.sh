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

# Pre-launch Expo Go on a booted iOS simulator
if xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
  echo "📲 Warming up Expo Go on booted simulator..."
  xcrun simctl launch booted host.exp.Exponent >/dev/null 2>&1 || true
  sleep 2
fi

# Use LAN so iOS Simulator reliably reaches Metro (localhost-only binding is flaky on this machine)
EXPO_PUBLIC_API_URL=http://localhost:3000/api EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1 ./node_modules/.bin/expo start --lan --go --ios
