// Shared by the live GET /sitemap.xml route and the backend/scripts/generate-sitemap.js script.
const Product = require('../models/Product');
const Market = require('../models/Market');
const User = require('../models/User');

const STATIC_PAGES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/markets', changefreq: 'daily', priority: '0.9' },
  { loc: '/products', changefreq: 'daily', priority: '0.9' },
  { loc: '/harvest', changefreq: 'weekly', priority: '0.7' },
  { loc: '/about', changefreq: 'monthly', priority: '0.5' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.5' },
  { loc: '/login', changefreq: 'yearly', priority: '0.3' },
  { loc: '/register', changefreq: 'yearly', priority: '0.3' },
];

function urlTag({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n');
}

async function buildSitemapEntries(siteUrl) {
  const [products, markets, farmers] = await Promise.all([
    Product.find({ isActive: true }).select('slug updatedAt').lean(),
    Market.find({ isActive: true }).select('slug updatedAt').lean(),
    User.find({ role: 'farmer', 'farmerProfile.approvalStatus': 'approved' })
      .select('farmerProfile.slug updatedAt')
      .lean(),
  ]);

  const entries = STATIC_PAGES.map((page) => ({ ...page, loc: `${siteUrl}${page.loc}` }));

  for (const p of products) {
    entries.push({
      loc: `${siteUrl}/products/${p.slug || p._id}`,
      lastmod: p.updatedAt?.toISOString().slice(0, 10),
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  for (const m of markets) {
    entries.push({
      loc: `${siteUrl}/markets/${m.slug || m._id}`,
      lastmod: m.updatedAt?.toISOString().slice(0, 10),
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  for (const f of farmers) {
    if (!f.farmerProfile?.slug) continue;
    entries.push({
      loc: `${siteUrl}/farmers/${f.farmerProfile.slug}`,
      lastmod: f.updatedAt?.toISOString().slice(0, 10),
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  return entries;
}

async function buildSitemapXml(siteUrl) {
  const entries = await buildSitemapEntries(siteUrl.replace(/\/$/, ''));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(urlTag).join('\n')}\n</urlset>\n`;
}

module.exports = { buildSitemapEntries, buildSitemapXml };
