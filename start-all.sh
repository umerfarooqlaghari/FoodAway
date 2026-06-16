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
EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1 npx expo start -c
