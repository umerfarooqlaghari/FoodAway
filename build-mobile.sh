#!/bin/bash

# ./build-mobile.sh           → production build + auto-submit to TestFlight
# ./build-mobile.sh preview   → internal distribution build (no submit)
# ./build-mobile.sh dev       → development client build (requires running Expo server)

PROFILE="${1:-production}"

case "$PROFILE" in
  dev)        PROFILE="development" ;;
  preview)    PROFILE="preview" ;;
  production) PROFILE="production" ;;
esac

echo "🚀 EAS iOS Build — profile: $PROFILE"
cd mobile-app

if [ "$PROFILE" = "production" ]; then
  npx eas-cli build --profile production --platform ios --auto-submit
else
  npx eas-cli build --profile "$PROFILE" --platform ios
fi
