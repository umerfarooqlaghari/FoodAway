#!/bin/bash

# Usage:
#   ./build-mobile.sh            → production build (for TestFlight / App Store)
#   ./build-mobile.sh preview    → internal distribution build
#   ./build-mobile.sh dev        → development client build (requires running Expo server)

PROFILE="${1:-production}"

case "$PROFILE" in
  dev)        PROFILE="development" ;;
  preview)    PROFILE="preview" ;;
  production) PROFILE="production" ;;
  *)          PROFILE="$1" ;;
esac

echo "🚀 Starting EAS iOS Build — profile: $PROFILE"
cd mobile-app
npx eas-cli build --profile "$PROFILE" --platform ios
