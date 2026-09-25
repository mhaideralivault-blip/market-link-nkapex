require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');
const { serveImage } = require('./controllers/uploadController');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to backend/.env');
  process.exit(1);
}

const app = express();
// Behind a load balancer / reverse proxy the real client IP comes from X-Forwarded-For (needed for rate limits).
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.disable('x-powered-by');

app.use(compression()); // gzip JSON/HTML: ~70% smaller responses
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim()) : true,
  })
);
app.use(express.json({ limit: '100kb' }));
// Product/market images are stored in MongoDB and served from here (cached for a week, they never change).
app.get('/uploads/*imagePath', serveImage);

const limiter = (windowMs, limit) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests, please slow down.' } });
const authLimiter = limiter(15 * 60 * 1000, 50); // brute-force protection on login/register
const apiLimiter = limiter(60 * 1000, 600); // general per-IP ceiling (10 req/s)
const heavyLimiter = limiter(60 * 1000, 30); // chatbot and order placement
app.use('/api', apiLimiter);
// Public, rarely-changing lists may be cached by browsers/CDN for a short time.
const publicCache = (seconds) => (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
  next();
};

app.use('/api/health', require('./routes/health'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/home', require('./routes/home'));
app.use('/api/search', require('./routes/search'));
app.use('/api/markets', publicCache(30), require('./routes/markets'));
app.use('/api/categories', publicCache(60), require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/farmers', require('./routes/farmers'));
app.use('/api/orders', heavyLimiter, require('./routes/orders'));
app.use('/api/harvests', require('./routes/harvests'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/family', require('./routes/family'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chatbot', heavyLimiter);
app.use('/api', require('./routes/misc'));

app.get('/', (req, res) => {
  res.send('MarketLink Apex API is running...');
});

app.use(notFound);
app.use(errorHandler);

// Vercel imports this file (see api/index.js) and calls the app per request; `node server.js` starts a normal server.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectDB().then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    // Node's defaults close idle keep-alive sockets before most load balancers do, causing sporadic 502s.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;

    // Finish in-flight requests, then close the DB pool, when the platform stops the container.
    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down`);
      server.close(() => require('mongoose').disconnect().finally(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    ['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));
  });
}

module.exports = app;
