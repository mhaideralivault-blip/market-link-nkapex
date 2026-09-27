const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Market = require('../models/Market');
const { AppError, cleanString, escapeRegex, getPagination, toGeoPoint, DAYS, byIdOrSlug } = require('../utils/helpers');
const { farmerFilterFromQuery, invalidateFarmers } = require('../utils/services');
const cache = require('../utils/cache');

const PUBLIC_FIELDS = 'farmerProfile.stallName farmerProfile.slug farmerProfile.description farmerProfile.operatingDays farmerProfile.pickupWindows farmerProfile.cutoffHours farmerProfile.markets farmerProfile.location farmerProfile.ratingAvg farmerProfile.ratingCount';

// GET /api/farmers?market=&day=&lat=&lng=&radius=&search=
const listFarmers = async (req, res) => {
  const filter = farmerFilterFromQuery(req.query);
  if (cleanString(req.query.search)) filter['farmerProfile.stallName'] = new RegExp(escapeRegex(cleanString(req.query.search)), 'i');
  const { page, limit, skip } = getPagination(req);
  const [farmers, total] = await Promise.all([
    User.find(filter).select(PUBLIC_FIELDS).populate('farmerProfile.markets', 'name').skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, farmers });
};

// Farmer profile with current weekly stock.
const getFarmer = async (req, res) => {
  const farmer = await User.findOne({ ...byIdOrSlug(req.params.id, 'farmerProfile.slug'), ...farmerFilterFromQuery({}) })
    .select(PUBLIC_FIELDS)
    .populate('farmerProfile.markets', 'name slug address latitude longitude');
  if (!farmer) throw new AppError('Farmer not found', 404);
  const products = await Product.find({ farmer: farmer._id, isActive: true, available: true, quantityAvailable: { $gt: 0 } })
    .populate('category', 'name');
  res.json({ success: true, farmer, products });
};

// PUT /api/farmers/profile — markets, operating days, pickup windows, cut-off, location.
const updateProfile = async (req, res) => {
  const body = req.body;
  const profile = req.user.farmerProfile;

  if (cleanString(body.stallName)) profile.stallName = cleanString(body.stallName);
  if (cleanString(body.contactPerson)) profile.contactPerson = cleanString(body.contactPerson);
  if (body.description !== undefined) profile.description = cleanString(body.description);
  if (body.cutoffHours !== undefined) {
    const cutoffHours = Number(body.cutoffHours);
    if (!Number.isFinite(cutoffHours) || cutoffHours < 0) throw new AppError('cutoffHours must be >= 0', 400);
    profile.cutoffHours = cutoffHours;
  }
  if (Array.isArray(body.operatingDays)) {
    profile.operatingDays = body.operatingDays.map((day) => String(day).toLowerCase()).filter((day) => DAYS.includes(day));
  }
  if (Array.isArray(body.pickupWindows)) {
    profile.pickupWindows = body.pickupWindows.map((window) => {
      const day = String(window.day).toLowerCase();
      if (!DAYS.includes(day) || !(window.start < window.end)) throw new AppError('Invalid pickup window', 400);
      return { day, start: window.start, end: window.end };
    });
  }
  if (Array.isArray(body.markets)) {
    const count = await Market.countDocuments({ _id: { $in: body.markets }, isActive: true });
    if (count !== body.markets.length) throw new AppError('One or more markets are invalid', 400);
    profile.markets = body.markets;
  }
  if (body.location && typeof body.location === 'object') {
    const { address, mapPin, latitude, longitude } = body.location;
    profile.location = { address: cleanString(address), mapPin: cleanString(mapPin), latitude, longitude };
    if (latitude !== undefined && longitude !== undefined) profile.geo = toGeoPoint(latitude, longitude);
  }
  await req.user.save();
  invalidateFarmers();
  cache.clear('home');
  res.json({ success: true, user: req.user });
};

// Dashboard: total/pending orders, revenue (completed), best sellers.
const DAY_MS = 24 * 3600 * 1000;
// Local (not UTC) date as YYYY-MM-DD, matching how pickup dates are stored.
const localDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dashboard = async (req, res) => {
  const farmer = req.user._id;
  const fourteenDaysAgo = new Date(Date.now() - 13 * DAY_MS);
  fourteenDaysAgo.setUTCHours(0, 0, 0, 0);
  const [statusCounts, revenueTotals, bestSelling, recent, dailyStats, upcomingOrders, lowStock, staleWeeklyStock] = await Promise.all([
    Order.aggregate([{ $match: { farmer } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { farmer, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      { $match: { farmer, status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 5 },
    ]),
    Order.find({ farmer }).sort('-createdAt').limit(5).populate('customer', 'name'),
    Order.aggregate([
      { $match: { farmer, createdAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } } } },
    ]),
    // Everything the farmer still has to prepare: open orders for today or later, soonest first.
    Order.find({ farmer, status: { $in: ['placed', 'accepted', 'ready'] }, pickupDate: { $gte: localDateString(new Date()) } })
      .sort({ pickupDate: 1, 'pickupSlot.start': 1 })
      .limit(200)
      .populate('customer', 'name phone')
      .lean(),
    Product.find({ farmer, isActive: true, available: true, quantityAvailable: { $lte: 5 } }).sort('quantityAvailable').limit(8).select('name unit quantityAvailable').lean(),
    Product.find({
      farmer,
      isActive: true,
      'weeklyTemplate.enabled': true,
      $or: [{ 'weeklyTemplate.appliedAt': null }, { 'weeklyTemplate.appliedAt': { $lt: new Date(Date.now() - 7 * DAY_MS) } }],
    }).select('name weeklyTemplate.appliedAt').lean(),
  ]);

  // Market-day pick list: group open orders by pickup date and add up the quantity of every product to pack.
  const byDate = new Map();
  for (const order of upcomingOrders) {
    const day = byDate.get(order.pickupDate) || { date: order.pickupDate, orders: [], items: new Map(), total: 0 };
    day.orders.push({
      _id: order._id,
      customer: order.customer?.name,
      phone: order.customer?.phone,
      slot: order.pickupSlot,
      status: order.status,
      total: order.totalAmount,
      notes: order.notes,
      items: order.items.map((item) => ({ name: item.name, unit: item.unit, quantity: item.quantity })),
    });
    day.total += order.totalAmount;
    for (const item of order.items) {
      const key = `${item.name}|${item.unit}`;
      const packEntry = day.items.get(key) || { name: item.name, unit: item.unit, quantity: 0 };
      packEntry.quantity += item.quantity;
      day.items.set(key, packEntry);
    }
    byDate.set(order.pickupDate, day);
  }
  const pickList = [...byDate.values()]
    .slice(0, 4)
    .map((day) => ({ ...day, items: [...day.items.values()].sort((first, second) => second.quantity - first.quantity) }));
  const statsByDate = new Map(dailyStats.map((row) => [row._id, row]));
  const days = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(Date.now() - (13 - index) * DAY_MS).toISOString().slice(0, 10);
    return { day, orders: statsByDate.get(day)?.orders || 0, revenue: statsByDate.get(day)?.revenue || 0 };
  });

  const ordersByStatus = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
  res.json({
    success: true,
    stats: {
      totalOrders: statusCounts.reduce((sum, row) => sum + row.count, 0),
      pendingOrders: ordersByStatus.placed || 0,
      ordersByStatus,
      revenue: revenueTotals[0]?.total || 0,
      bestSelling,
      recentOrders: recent,
      days,
      pickList,
      lowStock,
      staleWeeklyStock,
    },
  });
};

module.exports = { listFarmers, getFarmer, updateProfile, dashboard };
