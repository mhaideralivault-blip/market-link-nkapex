const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { AppError, cleanString, getPagination } = require('../utils/helpers');
const { notify } = require('../utils/services');

const HOUR = 3600 * 1000;

// ---------- helpers ----------

const slotStartTime = (date, time) => new Date(`${date}T${time}:00`);

const validateItems = (items) => {
  if (!Array.isArray(items) || !items.length) throw new AppError('items must be a non-empty array', 400);
  const mergedItems = new Map();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (typeof item.product !== 'string' || !Number.isInteger(quantity) || quantity < 1) {
      throw new AppError('Each item needs a product id and integer quantity >= 1', 400);
    }
    mergedItems.set(item.product, (mergedItems.get(item.product) || 0) + quantity);
  }
  return [...mergedItems].map(([product, quantity]) => ({ product, quantity }));
};

// Pickup date/slot must fall on an operating day, inside a pickup window, and before cut-off.
const validatePickup = (farmer, market, pickupDate, pickupSlot) => {
  const profile = farmer.farmerProfile;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate || '') || !pickupSlot?.start || !pickupSlot?.end) {
    throw new AppError('pickupDate (YYYY-MM-DD) and pickupSlot {start,end} (HH:mm) are required', 400);
  }
  if (!(pickupSlot.start < pickupSlot.end)) throw new AppError('Invalid pickup slot', 400);

  const start = slotStartTime(pickupDate, pickupSlot.start);
  if (isNaN(start)) throw new AppError('Invalid pickup date/time', 400);

  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][start.getDay()];
  if (profile.operatingDays.length && !profile.operatingDays.includes(dayName)) {
    throw new AppError(`${profile.stallName} is not open for pickup on ${dayName}`, 400);
  }
  const windows = profile.pickupWindows.filter((window) => window.day === dayName);
  if (windows.length && !windows.some((window) => pickupSlot.start >= window.start && pickupSlot.end <= window.end)) {
    throw new AppError(`Pickup slot is outside ${profile.stallName}'s pickup windows`, 400);
  }
  if (market && profile.markets.length && !profile.markets.some((marketId) => marketId.equals(market))) {
    throw new AppError(`${profile.stallName} does not sell at that market`, 400);
  }
  if (Date.now() > start.getTime() - profile.cutoffHours * HOUR) {
    throw new AppError(`Order cut-off has passed (${profile.cutoffHours}h before pickup)`, 400);
  }
};

// Atomically take stock; on failure give back what was already taken.
const reserveStock = async (items) => {
  const taken = [];
  const snapshot = [];
  try {
    for (const item of items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, isActive: true, available: true, quantityAvailable: { $gte: item.quantity } },
        { $inc: { quantityAvailable: -item.quantity } },
        { new: true }
      );
      if (!product) {
        const existing = await Product.findById(item.product).select('name');
        throw new AppError(`Not enough stock for ${existing?.name || 'a product'}`, 409);
      }
      taken.push(item);
      snapshot.push({ product: product._id, name: product.name, unit: product.unit, price: product.price, quantity: item.quantity });
    }
  } catch (error) {
    await releaseStock(taken);
    throw error;
  }
  return snapshot;
};

const releaseStock = (items) =>
  Promise.all(items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { quantityAvailable: item.quantity } })));

// Order total in rupees/dollars, rounded to 2 decimals.
const calculateTotal = (items) =>
  Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;

// Short readable order number shown to users, e.g. "a3f9c2".
const shortOrderId = (order) => order._id.toString().slice(-6);

const loadOrderForUser = async (id, user) => {
  const order = await Order.findById(id);
  if (!order) throw new AppError('Order not found', 404);
  const canView =
    user.role === 'admin' ||
    (user.role === 'customer' && order.customer.equals(user._id)) ||
    (user.role === 'farmer' && order.farmer.equals(user._id));
  if (!canView) throw new AppError('Order not found', 404);
  return order;
};

const assertBeforeCutoff = (order, farmer) => {
  const start = slotStartTime(order.pickupDate, order.pickupSlot.start);
  if (Date.now() > start.getTime() - farmer.farmerProfile.cutoffHours * HOUR) {
    throw new AppError('The cut-off time for this order has passed', 400);
  }
};

// ---------- customer ----------

// POST /api/orders  { items:[{product,quantity}], market, pickupDate, pickupSlot:{start,end}, notes }
// A cart with products from several farmers is split into one order per farmer.
const placeOrder = async (req, res) => {
  const { market, pickupDate, pickupSlot, notes } = req.body;
  const items = validateItems(req.body.items);

  const products = await Product.find({ _id: { $in: items.map((item) => item.product) }, isActive: true });
  if (products.length !== items.length) throw new AppError('One or more products are unavailable', 400);

  const itemsByFarmer = new Map();
  for (const item of items) {
    const product = products.find((candidate) => candidate._id.equals(item.product));
    const key = String(product.farmer);
    itemsByFarmer.set(key, [...(itemsByFarmer.get(key) || []), item]);
  }

  // Validate every farmer group before touching stock.
  const farmers = await User.find({
    _id: { $in: [...itemsByFarmer.keys()] },
    isActive: true,
    'farmerProfile.approvalStatus': 'approved',
  });
  if (farmers.length !== itemsByFarmer.size) throw new AppError('A farmer in your cart is not accepting orders', 400);
  farmers.forEach((farmer) => validatePickup(farmer, market, pickupDate, pickupSlot));

  const createdOrders = [];
  try {
    for (const farmer of farmers) {
      const groupItems = itemsByFarmer.get(String(farmer._id));
      const snapshot = await reserveStock(groupItems);
      const order = new Order({
        customer: req.user._id,
        farmer: farmer._id,
        market,
        items: snapshot,
        totalAmount: calculateTotal(snapshot),
        pickupDate,
        pickupSlot: { start: pickupSlot.start, end: pickupSlot.end },
        notes: cleanString(notes),
      });
      order.setStatus('placed');
      await order.save();
      createdOrders.push(order);
    }
  } catch (error) {
    for (const createdOrder of createdOrders) {
      await releaseStock(createdOrder.items);
      await createdOrder.deleteOne();
    }
    throw error;
  }

  for (const placed of createdOrders) {
    await notify(placed.customer, 'Order placed', `Your order #${shortOrderId(placed)} was placed. Pay at pickup.`, 'order', `/orders/${placed._id}`);
    await notify(placed.farmer, 'New pre-order', `You have a new order #${shortOrderId(placed)}.`, 'order', `/orders/${placed._id}`);
  }
  res.status(201).json({ success: true, orders: createdOrders });
};

// PUT /api/orders/:id — change items and/or pickup slot before cut-off.
const modifyOrder = async (req, res) => {
  const order = await loadOrderForUser(req.params.id, req.user);
  if (!order.customer.equals(req.user._id)) throw new AppError('Only the customer can modify an order', 403);
  if (!['placed', 'accepted'].includes(order.status)) throw new AppError(`Cannot modify a ${order.status} order`, 400);

  const farmer = await User.findById(order.farmer);
  assertBeforeCutoff(order, farmer);

  const { pickupDate = order.pickupDate, pickupSlot = order.pickupSlot, notes } = req.body;
  validatePickup(farmer, order.market, pickupDate, pickupSlot);

  if (req.body.items) {
    const items = validateItems(req.body.items);
    const ownedCount = await Product.countDocuments({ _id: { $in: items.map((item) => item.product) }, farmer: order.farmer });
    if (ownedCount !== items.length) throw new AppError('All items must be from the same farmer as the order', 400);

    const previousItems = order.items.map((item) => ({ product: item.product, quantity: item.quantity }));
    await releaseStock(previousItems);
    try {
      order.items = await reserveStock(items);
    } catch (error) {
      await reserveStock(previousItems).catch(() => {});
      throw error;
    }
    order.totalAmount = calculateTotal(order.items);
  }

  order.pickupDate = pickupDate;
  order.pickupSlot = { start: pickupSlot.start, end: pickupSlot.end };
  if (notes !== undefined) order.notes = cleanString(notes);
  order.setStatus('placed'); // farmer must re-confirm changes
  await order.save();
  await notify(order.farmer, 'Order modified', `Order #${shortOrderId(order)} was updated by the customer.`, 'order', `/orders/${order._id}`);
  res.json({ success: true, order });
};

const cancelOrder = async (req, res) => {
  const order = await loadOrderForUser(req.params.id, req.user);
  if (!order.customer.equals(req.user._id)) throw new AppError('Only the customer can cancel an order', 403);
  if (!['placed', 'accepted'].includes(order.status)) throw new AppError(`Cannot cancel a ${order.status} order`, 400);
  assertBeforeCutoff(order, await User.findById(order.farmer));

  await releaseStock(order.items);
  order.setStatus('cancelled');
  await order.save();
  await notify(order.farmer, 'Order cancelled', `Order #${shortOrderId(order)} was cancelled.`, 'order', `/orders/${order._id}`);
  res.json({ success: true, order });
};

// GET /api/orders/:id/reorder — current availability of a past order's items, ready to add to a cart.
const reorder = async (req, res) => {
  const order = await loadOrderForUser(req.params.id, req.user);
  const products = await Product.find({ _id: { $in: order.items.map((item) => item.product) }, isActive: true });
  const items = order.items.map((item) => {
    const product = products.find((candidate) => candidate._id.equals(item.product));
    const isAvailable = product && product.status === 'available';
    return {
      product: item.product,
      name: item.name,
      requested: item.quantity,
      currentPrice: product?.price,
      quantityAvailable: product?.quantityAvailable ?? 0,
      canOrder: !!isAvailable && product.quantityAvailable >= item.quantity,
    };
  });
  res.json({ success: true, items });
};

// ---------- farmer ----------

const TRANSITIONS = {
  placed: ['accepted', 'declined'],
  accepted: ['ready', 'declined'],
  ready: ['completed'],
};

const MESSAGES = {
  accepted: 'was accepted by the farmer.',
  declined: 'was declined by the farmer.',
  ready: 'is ready for pickup!',
  completed: 'was completed. You can now leave a review.',
};

// PATCH /api/orders/:id/status { status }
const updateStatus = async (req, res) => {
  const order = await loadOrderForUser(req.params.id, req.user);
  if (!order.farmer.equals(req.user._id)) throw new AppError('Not your order', 403);
  const { status } = req.body;
  if (!TRANSITIONS[order.status]?.includes(status)) {
    throw new AppError(`Cannot change status from ${order.status} to ${status}`, 400);
  }
  if (status === 'declined') await releaseStock(order.items);
  if (status === 'ready') order.pickupCode = Order.generatePickupCode();
  order.setStatus(status);
  await order.save();
  await notify(order.customer, `Order ${status}`, `Your order #${shortOrderId(order)} ${MESSAGES[status]}`, 'order', `/orders/${order._id}`);
  const result = order.toObject();
  delete result.pickupCode; // only the customer may see it
  res.json({ success: true, order: result });
};

// POST /api/orders/verify-pickup { code }  (farmer) — the customer shows a QR/code, the farmer confirms the handover.
const verifyPickup = async (req, res) => {
  const code = cleanString(req.body.code).toUpperCase().replace(/^MLINK:/, '').replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) throw new AppError('Enter the 6-character pickup code', 400);
  const order = await Order.findOne({ farmer: req.user._id, status: 'ready', pickupCode: code }).select('+pickupCode');
  if (!order) throw new AppError('No ready order matches this code. Check the code and that the order is marked ready.', 404);
  order.setStatus('completed');
  await order.save();
  await notify(order.customer, 'Order completed', `Your order #${shortOrderId(order)} ${MESSAGES.completed}`, 'order', `/orders/${order._id}`);
  await order.populate('customer', 'name phone');
  const result = order.toObject();
  delete result.pickupCode;
  res.json({ success: true, order: result });
};

// ---------- shared ----------

// Customer: own orders; farmer: received orders; admin: all.
const listOrders = async (req, res) => {
  const filter = {};
  if (req.user.role === 'customer') filter.customer = req.user._id;
  if (req.user.role === 'farmer') filter.farmer = req.user._id;
  if (cleanString(req.query.status) && Order.STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (cleanString(req.query.date)) filter.pickupDate = cleanString(req.query.date);

  const { page, limit, skip } = getPagination(req);
  const [orders, totalCount] = await Promise.all([
    Order.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name phone')
      .populate('farmer', 'farmerProfile.stallName')
      .populate('market', 'name'),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, total: totalCount, page, orders });
};

const getOrder = async (req, res) => {
  const order = await loadOrderForUser(req.params.id, req.user);
  // Only the customer who owns a ready order gets the pickup code (created lazily for orders that were ready before this feature).
  if (req.user.role === 'customer' && order.status === 'ready') {
    const withCode = await Order.findById(order._id).select('+pickupCode');
    if (!withCode.pickupCode) {
      withCode.pickupCode = Order.generatePickupCode();
      await withCode.save();
    }
    order.pickupCode = withCode.pickupCode;
  }
  await order.populate([
    { path: 'customer', select: 'name phone email' },
    { path: 'farmer', select: 'farmerProfile.stallName farmerProfile.location farmerProfile.operatingDays farmerProfile.pickupWindows farmerProfile.cutoffHours phone' },
    { path: 'market', select: 'name address latitude longitude mapLink' },
  ]);
  res.json({ success: true, order });
};

module.exports = { placeOrder, modifyOrder, cancelOrder, reorder, updateStatus, verifyPickup, listOrders, getOrder };
