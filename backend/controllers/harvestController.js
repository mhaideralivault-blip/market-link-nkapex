const Harvest = require('../models/Harvest');
const User = require('../models/User');
const Category = require('../models/Category');
const { AppError, cleanString, getPagination } = require('../utils/helpers');
const { notifyMany, approvedFarmerIds, publicFarmerFilter } = require('../utils/services');

const FARMER_FIELDS = 'farmerProfile.stallName farmerProfile.slug';
const todayKarachi = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const linkFor = (harvest) => `/harvest?date=${harvest.expectedDate}`;

// Validates and normalises the fields a farmer may set.
const readBody = async (body, { partial = false } = {}) => {
  const data = {};
  if (!partial || body.title !== undefined) {
    const title = cleanString(body.title);
    if (!title) throw new AppError('Please say what is coming (title is required)', 400);
    data.title = title.slice(0, 80);
  }
  if (!partial || body.expectedDate !== undefined) {
    if (!isDate(body.expectedDate)) throw new AppError('Choose the expected date', 400);
    if (body.expectedDate < todayKarachi()) throw new AppError('The expected date cannot be in the past', 400);
    data.expectedDate = body.expectedDate;
  }
  if (body.description !== undefined) data.description = (cleanString(body.description) || '').slice(0, 400);
  if (body.unit !== undefined) data.unit = (cleanString(body.unit) || 'kg').slice(0, 20);
  if (body.estimatedQuantity !== undefined && body.estimatedQuantity !== '' && body.estimatedQuantity !== null) {
    const quantity = Number(body.estimatedQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) throw new AppError('Estimated quantity must be a positive number', 400);
    data.estimatedQuantity = quantity;
  }
  if (body.category !== undefined) {
    const category = cleanString(body.category);
    if (category) {
      if (!(await Category.exists({ _id: category }))) throw new AppError('Unknown category', 400);
      data.category = category;
    } else data.category = undefined;
  }
  return data;
};

const present = (harvest, user) => {
  const plain = harvest.toObject ? harvest.toObject() : harvest;
  const subscribers = plain.subscribers || [];
  delete plain.subscribers;
  return {
    ...plain,
    subscriberCount: subscribers.length,
    subscribed: user?.role === 'customer' ? subscribers.some((id) => id.equals(user._id)) : false,
  };
};

// GET /api/harvests?farmer=&from=&to=&limit=   (public; upcoming produce from today on, approved farmers only)
const listUpcoming = async (req, res) => {
  const farmers = await approvedFarmerIds(publicFarmerFilter());
  const filter = { status: 'upcoming', expectedDate: { $gte: cleanString(req.query.from) || todayKarachi() }, farmer: { $in: farmers } };
  if (cleanString(req.query.to)) filter.expectedDate.$lte = cleanString(req.query.to);
  if (cleanString(req.query.farmer)) filter.farmer = cleanString(req.query.farmer);
  const { limit } = getPagination(req);
  const harvests = await Harvest.find(filter)
    .sort('expectedDate title')
    .limit(Math.max(limit, Math.min(Number(req.query.limit) || 0, 300)))
    .populate('farmer', FARMER_FIELDS)
    .populate('category', 'name');
  res.json({ success: true, total: harvests.length, harvests: harvests.map((harvest) => present(harvest, req.user)) });
};

// POST /api/harvests/:id/subscribe   |   DELETE /api/harvests/:id/subscribe   (customer)
const setSubscription = (subscribe) => async (req, res) => {
  const harvest = await Harvest.findById(req.params.id);
  if (!harvest) throw new AppError('Harvest not found', 404);
  if (subscribe && harvest.status !== 'upcoming') throw new AppError(`This harvest is already ${harvest.status}`, 400);
  await Harvest.updateOne({ _id: harvest._id }, subscribe ? { $addToSet: { subscribers: req.user._id } } : { $pull: { subscribers: req.user._id } });
  const fresh = await Harvest.findById(harvest._id).populate('farmer', FARMER_FIELDS).populate('category', 'name');
  res.json({ success: true, harvest: present(fresh, req.user) });
};

// ---------- farmer ----------

// GET /api/harvests/mine
const listMine = async (req, res) => {
  const harvests = await Harvest.find({ farmer: req.user._id }).sort('-expectedDate').limit(100).populate('category', 'name');
  res.json({ success: true, harvests: harvests.map((harvest) => present(harvest, req.user)) });
};

// POST /api/harvests
const createHarvest = async (req, res) => {
  const data = await readBody(req.body);
  const harvest = await Harvest.create({ ...data, farmer: req.user._id });
  // Customers who favourited this stall hear about it first.
  const followers = await User.find({ role: 'customer', isActive: true, 'favorites.farmers': req.user._id }).distinct('_id');
  await notifyMany(followers, 'Coming soon', `${req.user.farmerProfile.stallName} will have ${harvest.title} on ${harvest.expectedDate}. Tap Notify me to get an alert.`, 'harvest', linkFor(harvest));
  res.status(201).json({ success: true, harvest: present(harvest, req.user) });
};

const loadOwn = async (id, user) => {
  const harvest = await Harvest.findById(id);
  if (!harvest || !harvest.farmer.equals(user._id)) throw new AppError('Harvest not found', 404);
  return harvest;
};

// PUT /api/harvests/:id   (only while upcoming)
const updateHarvest = async (req, res) => {
  const harvest = await loadOwn(req.params.id, req.user);
  if (harvest.status !== 'upcoming') throw new AppError(`Cannot edit a harvest that is already ${harvest.status}`, 400);
  const data = await readBody(req.body, { partial: true });
  const dateChanged = data.expectedDate && data.expectedDate !== harvest.expectedDate;
  Object.assign(harvest, data);
  await harvest.save();
  if (dateChanged) {
    await notifyMany(harvest.subscribers, 'Date changed', `${harvest.title} from ${req.user.farmerProfile.stallName} is now expected on ${harvest.expectedDate}.`, 'harvest', linkFor(harvest));
  }
  res.json({ success: true, harvest: present(harvest, req.user) });
};

// PATCH /api/harvests/:id/status { status: 'available' | 'cancelled' }
const updateStatus = async (req, res) => {
  const harvest = await loadOwn(req.params.id, req.user);
  const { status } = req.body;
  if (!['available', 'cancelled'].includes(status)) throw new AppError('Status must be available or cancelled', 400);
  if (harvest.status !== 'upcoming') throw new AppError(`This harvest is already ${harvest.status}`, 400);
  harvest.status = status;
  await harvest.save();
  const stall = req.user.farmerProfile.stallName;
  const link = status === 'available' ? `/farmers/${req.user.farmerProfile.slug || req.user._id}` : linkFor(harvest);
  await notifyMany(
    harvest.subscribers,
    status === 'available' ? 'Now available!' : 'Harvest cancelled',
    status === 'available' ? `${harvest.title} from ${stall} is now available. Order before it sells out!` : `${harvest.title} from ${stall} will not be available on ${harvest.expectedDate}.`,
    status === 'available' ? 'restock' : 'harvest',
    link
  );
  res.json({ success: true, harvest: present(harvest, req.user), notified: harvest.subscribers.length });
};

module.exports = {
  listUpcoming,
  subscribe: setSubscription(true),
  unsubscribe: setSubscription(false),
  listMine,
  createHarvest,
  updateHarvest,
  updateStatus,
};
