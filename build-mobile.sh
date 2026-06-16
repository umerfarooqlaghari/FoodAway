#!/bin/bash

echo "🚀 Starting one-time EAS iOS Build..."
cd mobile-app
npx eas-cli build --profile development --platform ios
