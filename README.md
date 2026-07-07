# Grabengo

**Reducing food waste, one meal at a time.**

Grabengo connects customers with local businesses selling surplus food at a discount before it goes to waste. Customers browse and book discounted food bags from nearby stores; sellers manage their listings and orders through a dedicated dashboard or the admin web portal.

---

## Repository structure

```
GoodtoGo/
├── backend/          Node.js + Express API (PostgreSQL)
├── admin-web/        React + Vite — superadmin & seller portal + public landing page
└── mobile-app/       React Native (Expo) — customer & seller mobile app
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| PostgreSQL | ≥ 14 |
| Expo CLI | bundled via `npx` |
| EAS CLI | `npm i -g eas-cli` (for app store builds) |

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url> GoodtoGo
cd GoodtoGo

cd backend       && npm install && cd ..
cd admin-web     && npm install && cd ..
cd mobile-app    && npm install && cd ..
```

### 2. Environment variables

**`backend/.env`**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/grabengo
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/grabengo_test

# Server
PORT=3000
JWT_SECRET=your-secret-key-here

# App branding (used in emails and receipts)
APP_BRAND_NAME=Grabengo
APP_TAGLINE=Reducing food waste, one meal at a time.
APP_SITE_URL=https://grabengo.store
APP_SITE_HOST=grabengo.store
APP_SUPPORT_EMAIL=support@grabengo.store
APP_PROMO_CODE=Grabengo20
APP_LOGO_URL=
APP_GROCERIES_BAG_URL=

# AWS (S3 for image uploads, SES for transactional email)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SES_FROM_EMAIL=no-reply@grabengo.store
AWS_S3_BUCKET_NAME=goodtogo-assets
```

**`mobile-app/.env`**

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For a physical device on the same Wi-Fi, replace `localhost` with your machine's local IP (e.g. `http://192.168.1.x:3000/api`). The app auto-detects this in development — see `getDevApiUrl()` in `App.js`.

**`admin-web`** — no `.env` needed locally; `VITE_SITE_HOST` defaults to `grabengo.store`.

### 3. Database

```bash
psql -U postgres -c "CREATE DATABASE grabengo;"
cd backend && node src/index.js   # migrations run automatically on first boot
```

To seed demo data:

```bash
node seed-users.js
node seed-orders.js
```

---

## Running locally

### All services at once

```bash
./start-all.sh
```

### Individually

```bash
# Backend (port 3000)
cd backend && node src/index.js

# Admin web (port 5173)
cd admin-web && npm run dev

# Mobile app
cd mobile-app && npm start
# Press 'i' for iOS simulator, 'a' for Android emulator
```

---

## Tests

```bash
# Backend
cd backend && TEST_DATABASE_URL=postgresql://... npm test

# Admin web
cd admin-web && npm test
```

---

## Architecture notes

- **Auth** — JWT with refresh tokens. Roles: `Customer`, `Seller`, `SellersAdmin`, `SuperAdmin`.
- **Multi-tenancy** — Each brand is a tenant with its own subdomain (`brand.grabengo.store`). The web portal resolves tenant from the subdomain; the mobile app passes `tenant_id` directly.
- **Image storage** — Store and food images are uploaded to S3 and served via short-lived pre-signed URLs.
- **Push notifications** — Expo push notifications via `expo-notifications`. Device tokens are registered per user on login.
- **Real-time** — Order updates and in-app chat run over a WebSocket server co-located with the Express API.

---

## Building for the app stores

### iOS — App Store

```bash
cd mobile-app
eas build --platform ios --profile production
eas submit --platform ios
```

**Required fields in App Store Connect before submission:**

| Field | Value |
|-------|-------|
| Bundle ID | `com.alphadevs.mobileapp` |
| Privacy Policy URL | `https://grabengo.store/privacy` |
| Support URL | `https://grabengo.store/contact` |
| Category | Food & Drink |
| Age rating | 4+ |
| Encryption | No (set via `ITSAppUsesNonExemptEncryption: false` in `app.json`) |

**Screenshots — upload under App Store Connect → App Information → Screenshots:**

| Device | Required canvas size |
|--------|---------------------|
| iPhone 16 Pro Max (6.9") | 1320 × 2868 px |
| iPhone 14 Plus / 15 Plus (6.5") | 1284 × 2778 px |
| iPhone 8 Plus (5.5") | 1242 × 2208 px |

Minimum 3 per device, maximum 10. Recommended screens to capture:

1. Landing / home (brand carousel, hero)
2. Store listing (browse nearby food bags)
3. Store detail / bag detail with pricing
4. Order confirmation / receipt
5. Seller dashboard (shows the B2B side)

### Android — Google Play

```bash
eas build --platform android --profile production
eas submit --platform android
```

**Required in Play Console:**

| Field | Value |
|-------|-------|
| Package name | `com.alphadevs.mobileapp` |
| Privacy Policy URL | `https://grabengo.store/privacy` |
| Category | Food & Drink |

**Screenshots:**

- Minimum 4 phone screenshots (min 320 px on shortest side, max 3840 px, 16:9 or 9:16 ratio)
- Feature graphic: 1024 × 500 px (shown on the Play Store listing)
- Same 5 screens as iOS work well here too

---

## Demo credentials for app store review

**Both Apple and Google require working test credentials if your app has a login screen.** Reviewers need to access all features without contacting you — missing or broken credentials triggers an automatic rejection (Apple guideline 2.1, Google "App access" policy).

Where to enter them:
- **App Store Connect** → Your App → App Review Information → "Sign-in required" → Yes
- **Google Play Console** → App content → App access → Add instructions

Run the demo seed script to create and fully populate the accounts:

```bash
cd backend && node seed-demo.js
```

This provisions two demo stores (London — Soho & Shoreditch), 10 food items, 2 surprise bags, 12 historical orders, and 5 store reviews.

| Role | Email | Password |
|------|-------|----------|
| Seller (SellersAdmin) | `testSeller@grabengo.store` | `123Grabengo@!` |
| Customer | `testCustomer@grabengo.store` | `123Grabengo@!` |

> Keep these accounts active permanently. Apple re-reviews every app update with the same credentials and will reject if the account no longer works.

---

## Permissions

All permissions are pre-configured in `mobile-app/app.json`:

| Permission | Reason shown to user |
|-----------|----------------------|
| Camera | Upload store and food photos |
| Photo library | Select images from gallery |
| Location (when in use) | Show nearby stores |
| Push notifications | Order updates and alerts |

---

## Privacy policy

The privacy policy is live at **`https://grabengo.store/privacy`** — served by the `admin-web` React app at the `/privacy` route (`src/pages/PrivacyPolicy.jsx`). No separate hosting needed; it's part of the main web deployment.

---

## Key URLs

| | |
|-|-|
| Production web | `https://grabengo.store` |
| Privacy policy | `https://grabengo.store/privacy` |
| Terms | `https://grabengo.store/terms` |
| Contact / support | `https://grabengo.store/contact` |
| Tenant store (example) | `https://{subdomain}.grabengo.store/shop` |
| API health check | `https://api.grabengo.store/health` |
