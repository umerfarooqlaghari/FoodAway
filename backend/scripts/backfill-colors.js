require('dotenv').config();
const { db } = require('../src/db');
const { getPresignedUrl } = require('../src/aws');
const { extractPrimaryColor } = require('../src/colorExtractor');
const fetch = require('node-fetch');

async function extractColorFromUrl(url) {
  try {
    const response = await fetch(url);
    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;
    return await extractPrimaryColor(dataUri);
  } catch (err) {
    console.error('Error downloading image:', err);
    return null;
  }
}

async function run() {
  console.log('Starting color extraction for existing tenants...');
  const tenants = await db.prepare('SELECT id, name, logo FROM tenants').all();
  
  for (const tenant of tenants) {
    if (tenant.logo) {
      console.log(`Processing ${tenant.name}...`);
      const url = await getPresignedUrl(tenant.logo);
      const color = await extractColorFromUrl(url);
      
      if (color) {
        console.log(`Extracted color ${color} for ${tenant.name}`);
        await db.prepare('UPDATE tenants SET primary_color = ? WHERE id = ?').run(color, tenant.id);
      } else {
        console.log(`Could not extract color for ${tenant.name}, defaulting to white`);
        await db.prepare('UPDATE tenants SET primary_color = ? WHERE id = ?').run('#FFFFFF', tenant.id);
      }
    } else {
      console.log(`Skipping ${tenant.name}, no logo.`);
      await db.prepare('UPDATE tenants SET primary_color = ? WHERE id = ?').run('#FFFFFF', tenant.id);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

run();
