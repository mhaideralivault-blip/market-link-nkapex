// Usage: npm run sitemap
// Regenerates frontend/public/sitemap.xml for local/manual runs and non-serverless deployments.
// In production on Vercel, GET /sitemap.xml (server.js) computes this live from the DB on every
// request instead, since a serverless function can't write back into the deployed static output.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { buildSitemapXml } = require('../utils/sitemap');

const SITE_URL = process.env.SITE_URL || 'https://market-link-frontend.vercel.app';
const OUT_FILE = path.join(__dirname, '../../frontend/public/sitemap.xml');

(async () => {
  await connectDB();
  const xml = await buildSitemapXml(SITE_URL);
  fs.writeFileSync(OUT_FILE, xml);
  console.log(`Sitemap written to ${OUT_FILE}`);
  console.log(`  ${xml.match(/<loc>/g)?.length || 0} URLs`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
