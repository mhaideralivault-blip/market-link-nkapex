const express = require('express');
const { AppError } = require('../utils/helpers');
const { applyAllWeeklyTemplates } = require('../controllers/productController');

const router = express.Router();

// Called weekly by Vercel Cron (see vercel.json). Vercel adds `Authorization: Bearer $CRON_SECRET`
// automatically once CRON_SECRET is set as an env var, so this also guards the endpoint from public use.
router.get('/apply-weekly-templates', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) throw new AppError('Unauthorized', 401);
  const updated = await applyAllWeeklyTemplates();
  res.json({ success: true, updated });
});

module.exports = router;
