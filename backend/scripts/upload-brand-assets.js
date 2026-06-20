#!/usr/bin/env node
/**
 * Upload Grabengo brand assets to S3 under brand/
 * Usage: node scripts/upload-brand-assets.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { uploadBufferToS3, publicS3Url } = require('../src/aws');

const ROOT = path.join(__dirname, '../..');

const ASSETS = [
  {
    localPath: path.join(ROOT, 'admin-web/public/favicon.png'),
    s3Key: 'brand/logo.png',
    contentType: 'image/png',
    envKey: 'APP_LOGO_URL',
  },
  {
    localPath: path.join(ROOT, 'admin-web/public/groceries_bag.png'),
    s3Key: 'brand/groceries-bag.png',
    contentType: 'image/png',
    envKey: 'APP_GROCERIES_BAG_URL',
  },
];

async function main() {
  const uploaded = {};

  for (const asset of ASSETS) {
    if (!fs.existsSync(asset.localPath)) {
      console.warn(`Skip missing file: ${asset.localPath}`);
      uploaded[asset.envKey] = publicS3Url(asset.s3Key);
      continue;
    }

    const buffer = fs.readFileSync(asset.localPath);
    uploaded[asset.envKey] = await uploadBufferToS3(asset.s3Key, buffer, asset.contentType);
    console.log(`${asset.envKey}=${uploaded[asset.envKey]}`);
  }

  console.log('\nAdd these to your .env / Render environment:');
  for (const [key, url] of Object.entries(uploaded)) {
    console.log(`${key}=${url}`);
  }
}

main().catch(err => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
