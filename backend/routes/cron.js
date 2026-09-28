const express = require('express');
const fs = require('fs');
const path = require('path');
const { AppError } = require('../utils/helpers');
const { applyAllWeeklyTemplates } = require('../controllers/productController');
const { buildSitemapXml } = require('../utils/sitemap');

const router = express.Router();

const requireCronSecret = (req) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) throw new AppError('Unauthorized', 401);
};

// Called weekly by Vercel Cron (see vercel.json). Vercel adds `Authorization: Bearer $CRON_SECRET`
// automatically once CRON_SECRET is set as an env var, so this also guards the endpoint from public use.
router.get('/apply-weekly-templates', async (req, res) => {
  requireCronSecret(req);
  const updated = await applyAllWeeklyTemplates();
  res.json({ success: true, updated });
});

// The public GET /sitemap.xml route (server.js) always computes live from the DB, so search
// engines never see a stale sitemap — this cron just keeps the checked-in static copy at
// frontend/public/sitemap.xml in sync, for deployments that serve it as a static file.
// NOTE: on Vercel this handler's filesystem writes don't persist to what's actually served
// (serverless functions can't write back into the deployed static output) — it's a no-op
// there beyond logging, and only does something useful when run against a traditional
// long-lived filesystem (a VPS, a container, or `node server.js` locally / in CI).
router.get('/regenerate-sitemap', async (req, res) => {
  requireCronSecret(req);
  const siteUrl = process.env.SITE_URL || 'https://market-link-frontend.vercel.app';
  const xml = await buildSitemapXml(siteUrl);
  const outFile = path.join(__dirname, '../../frontend/public/sitemap.xml');
  let written = false;
  try {
    fs.writeFileSync(outFile, xml);
    written = true;
  } catch (error) {
    console.warn('regenerate-sitemap: could not write static file (expected on serverless):', error.message);
  }
  res.json({ success: true, written, urls: xml.match(/<loc>/g)?.length || 0 });
});

module.exports = router;
