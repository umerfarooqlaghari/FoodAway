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

export EAS_SKIP_AUTO_FINGERPRINT=1
export EXPO_ASC_API_KEY_PATH="/Users/macbookpro/Desktop/projects/GoodtoGo/AuthKey.p8"
export EXPO_ASC_ISSUER_ID="138bd8ae-ea40-4c7b-a543-2964deb4a55b"
export EXPO_ASC_KEY_ID="VTVNRS996B"
export EXPO_APPLE_TEAM_ID="2WQ7LU7T5X"
export EXPO_APPLE_TEAM_TYPE="COMPANY_OR_ORGANIZATION"
unset EXPO_APPLE_ID
unset EXPO_APPLE_PASSWORD

echo "🚀 EAS iOS Build — profile: $PROFILE"
cd mobile-app

if [ "$PROFILE" = "production" ]; then
  npx eas-cli build --profile production --platform ios --auto-submit
else
  npx eas-cli build --profile "$PROFILE" --platform ios
fi
