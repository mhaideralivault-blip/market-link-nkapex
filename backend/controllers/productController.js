const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const cache = require('../utils/cache');
const { audit } = require('../utils/audit');
const { AppError, cleanString, escapeRegex, getPagination, requireFields, byIdOrSlug } = require('../utils/helpers');
const {
  farmerFilterFromQuery,
  approvedFarmerIds,
  notifyRestock,
} = require('../utils/services');

const SORTS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  newest: { createdAt: -1 },
  rating: { ratingAvg: -1, ratingCount: -1 },
};

// GET /api/products?search=&category=&minPrice=&maxPrice=&market=&day=&farmer=&inStock=true&sort=
const listProducts = async (req, res) => {
  const query = req.query;
  const filter = { isActive: true, available: true };

  // Only products from approved farmers; market/day/location narrow the farmer set.
  const farmerFilter = farmerFilterFromQuery(query);
  if (cleanString(query.farmer)) farmerFilter._id = cleanString(query.farmer);
  filter.farmer = { $in: await approvedFarmerIds(farmerFilter) };

  if (cleanString(query.category)) filter.category = cleanString(query.category);
  if (cleanString(query.search)) filter.name = new RegExp(escapeRegex(cleanString(query.search)), 'i');
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined && !isNaN(query.minPrice)) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice !== undefined && !isNaN(query.maxPrice)) filter.price.$lte = Number(query.maxPrice);
  }
  if (query.inStock !== 'false') filter.quantityAvailable = { $gt: 0 };

  const { page, limit, skip } = getPagination(req);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name')
      .populate('farmer', 'farmerProfile.stallName farmerProfile.slug farmerProfile.location')
      .sort(SORTS[query.sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), products });
};

// Real, computed signals shown on the product page (cached 2 min per product):
//  - reserved: how much was reserved in the last 7 days (social proof, never invented)
//  - price: how this price compares with the average for the same category and unit
//  - together: products most often reserved in the same orders (cross-sell)
const buildInsights = async (product) => {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const live = { status: { $nin: ['cancelled', 'declined'] } };
  const [reservedStats, categoryPriceStats, coPurchases] = await Promise.all([
    Order.aggregate([
      { $match: { ...live, createdAt: { $gte: since }, 'items.product': product._id } },
      { $unwind: '$items' },
      { $match: { 'items.product': product._id } },
      { $group: { _id: null, qty: { $sum: '$items.quantity' }, orders: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { isActive: true, category: product.category._id || product.category, unit: product.unit, _id: { $ne: product._id } } },
      { $group: { _id: null, avg: { $avg: '$price' }, n: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...live, 'items.product': product._id } },
      { $unwind: '$items' },
      { $match: { 'items.product': { $ne: product._id } } },
      { $group: { _id: '$items.product', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]),
  ]);
  const together = coPurchases.length
    ? await Product.find({ _id: { $in: coPurchases.map((pair) => pair._id) }, farmer: product.farmer, isActive: true, available: true, quantityAvailable: { $gt: 0 } })
        .populate('category', 'name')
        .populate('farmer', 'farmerProfile.stallName farmerProfile.slug')
    : [];
  const rankById = new Map(coPurchases.map((pair, index) => [String(pair._id), index]));
  together.sort((first, second) => rankById.get(String(first._id)) - rankById.get(String(second._id)));
  const priceStats = categoryPriceStats[0];
  return {
    reserved: reservedStats[0] ? { qty: reservedStats[0].qty, orders: reservedStats[0].orders } : null,
    price:
      priceStats && priceStats.n >= 2
        ? {
            average: Math.round(priceStats.avg * 100) / 100,
            deltaPct: Math.round(((product.price - priceStats.avg) / priceStats.avg) * 100),
            compared: priceStats.n,
          }
        : null,
    together: together.slice(0, 3),
  };
};

const getProduct = async (req, res) => {
  const product = await Product.findOne({ ...byIdOrSlug(req.params.id), isActive: true })
    .populate('category', 'name')
    .populate('farmer', 'farmerProfile.stallName farmerProfile.slug farmerProfile.location farmerProfile.operatingDays farmerProfile.pickupWindows farmerProfile.markets farmerProfile.ratingAvg');
  if (!product) throw new AppError('Product not found', 404);
  const insights = await cache.cached(`pdp:${product._id}`, 120_000, () => buildInsights(product)).catch(() => null);
  res.json({ success: true, product, insights });
};

// Farmer: own products (including unavailable ones).
const myProducts = async (req, res) => {
  const products = await Product.find({ farmer: req.user._id }).populate('category', 'name').sort('-createdAt');
  res.json({ success: true, products });
};

// Copy only the fields a farmer is allowed to set, cleaning values on the way.
const pickFields = (body) => {
  const fields = {};
  ['name', 'description', 'unit', 'image', 'category'].forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key];
  });
  if (body.storage !== undefined) fields.storage = String(body.storage).trim().slice(0, 200);
  if (body.harvestedOn !== undefined) {
    const harvestDate = body.harvestedOn ? new Date(body.harvestedOn) : null;
    const isValidPastDate = harvestDate && !isNaN(harvestDate) && harvestDate.getTime() <= Date.now() + 24 * 3600 * 1000;
    fields.harvestedOn = isValidPastDate ? harvestDate : undefined;
  }
  if (Array.isArray(body.tags)) fields.tags = [...new Set(body.tags.filter((tag) => Product.TAGS.includes(tag)))];
  if (body.price !== undefined) fields.price = Number(body.price);
  if (body.quantityAvailable !== undefined) fields.quantityAvailable = Number(body.quantityAvailable);
  return fields;
};

// Applies only the enabled/quantity keys so an edit never wipes the stored `appliedAt`.
const applyTemplateFields = (product, weeklyTemplate) => {
  if (!weeklyTemplate || typeof weeklyTemplate !== 'object') return;
  product.weeklyTemplate.enabled = !!weeklyTemplate.enabled;
  product.weeklyTemplate.quantity = Number(weeklyTemplate.quantity) || 0;
};

const createProduct = async (req, res) => {
  requireFields(req.body, ['name', 'category', 'price', 'unit', 'quantityAvailable']);
  if (!(await Category.exists({ _id: req.body.category, isActive: true }))) {
    throw new AppError('Invalid category', 400);
  }
  const product = new Product({ ...pickFields(req.body), farmer: req.user._id });
  applyTemplateFields(product, req.body.weeklyTemplate);
  await product.save();
  res.status(201).json({ success: true, product });
};

// Load a product and make sure it belongs to the logged-in farmer.
const ownProduct = async (id, user) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);
  if (!product.farmer.equals(user._id)) throw new AppError('Not your product', 403);
  return product;
};

const updateProduct = async (req, res) => {
  const product = await ownProduct(req.params.id, req.user);
  const wasSoldOut = product.quantityAvailable <= 0;
  const fields = pickFields(req.body);
  if (fields.category && !(await Category.exists({ _id: fields.category, isActive: true }))) {
    throw new AppError('Invalid category', 400);
  }
  product.set(fields);
  applyTemplateFields(product, req.body.weeklyTemplate);
  await product.save();
  if (wasSoldOut && product.quantityAvailable > 0 && product.available) await notifyRestock(product);
  res.json({ success: true, product });
};

// PATCH /api/products/:id/status  { status: 'available' | 'sold_out' | 'unavailable' }
const setProductStatus = async (req, res) => {
  const product = await ownProduct(req.params.id, req.user);
  const { status } = req.body;
  if (status === 'sold_out') product.quantityAvailable = 0;
  else if (status === 'unavailable') product.available = false;
  else if (status === 'available') product.available = true;
  else throw new AppError('status must be available, sold_out or unavailable', 400);
  await product.save();
  res.json({ success: true, product });
};

// Resets one product's stock from its own weekly template and stamps when it happened.
const applyOne = async (product) => {
  const wasSoldOut = product.quantityAvailable <= 0;
  product.quantityAvailable = product.weeklyTemplate.quantity;
  product.available = true;
  product.weeklyTemplate.appliedAt = new Date();
  await product.save();
  if (wasSoldOut && product.quantityAvailable > 0) await notifyRestock(product);
};

// Reset stock of every product with an enabled weekly template.
const applyWeeklyTemplate = async (req, res) => {
  const products = await Product.find({ farmer: req.user._id, 'weeklyTemplate.enabled': true });
  for (const product of products) await applyOne(product);
  res.json({ success: true, updated: products.length, products });
};

// Reset a single product's stock from its own weekly template.
const applyProductTemplate = async (req, res) => {
  const product = await ownProduct(req.params.id, req.user);
  if (!product.weeklyTemplate.enabled) throw new AppError('This product has no weekly template enabled', 400);
  await applyOne(product);
  res.json({ success: true, product });
};

// Spreadsheet-style bulk edit: price, stock, visibility and/or weekly template for several of the
// farmer's own products in one request. Each item only needs the keys it wants to change.
const bulkUpdate = async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw new AppError('No items to update', 400);
  const ids = items.map((item) => item.id);
  const products = await Product.find({ _id: { $in: ids }, farmer: req.user._id });
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const updated = [];
  for (const item of items) {
    const product = byId.get(String(item.id));
    if (!product) continue;
    const wasSoldOut = product.quantityAvailable <= 0;
    if (item.price !== undefined) product.price = Math.max(0, Number(item.price) || 0);
    if (item.quantityAvailable !== undefined) product.quantityAvailable = Math.max(0, Number(item.quantityAvailable) || 0);
    if (item.available !== undefined) product.available = !!item.available;
    if (item.weeklyTemplate) applyTemplateFields(product, item.weeklyTemplate);
    await product.save();
    if (wasSoldOut && product.quantityAvailable > 0 && product.available) await notifyRestock(product);
    updated.push(product);
  }
  res.json({ success: true, updated: updated.length, products: updated });
};

// Weekly auto-refresh across every farmer (called by a scheduled Vercel Cron job; see routes/cron.js).
const applyAllWeeklyTemplates = async () => {
  const products = await Product.find({ 'weeklyTemplate.enabled': true });
  for (const product of products) await applyOne(product);
  return products.length;
};

// Farmer deletes own; admin may delete any (content moderation).
const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  if (req.user.role !== 'admin' && !product.farmer.equals(req.user._id)) throw new AppError('Not your product', 403);
  await product.deleteOne();
  cache.clear('home');
  if (req.user.role === 'admin') audit(req, 'product.remove', `Removed product listing ${product.name}`, { type: 'product', id: product._id });
  res.json({ success: true, message: 'Product removed' });
};

// Admin: list everything for moderation.
const adminListProducts = async (req, res) => {
  const filter = {};
  if (cleanString(req.query.search)) filter.name = new RegExp(escapeRegex(cleanString(req.query.search)), 'i');
  const { page, limit, skip } = getPagination(req);
  const [products, total] = await Promise.all([
    Product.find(filter).populate('farmer', 'farmerProfile.stallName farmerProfile.slug').populate('category', 'name').sort('-createdAt').skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, products });
};

module.exports = {
  listProducts,
  getProduct,
  myProducts,
  createProduct,
  updateProduct,
  setProductStatus,
  applyWeeklyTemplate,
  applyProductTemplate,
  bulkUpdate,
  applyAllWeeklyTemplates,
  deleteProduct,
  adminListProducts,
};
