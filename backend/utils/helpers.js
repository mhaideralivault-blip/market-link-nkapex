const jwt = require('jsonwebtoken');

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Query/body values may be objects ({$ne: ...}); only accept plain strings.
const cleanString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

// "Fred's Fresh Produce" -> "freds-fresh-produce"; used for readable, shareable URLs.
const slugify = (text = '') =>
  String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// URLs accept either a 24-char id (old links keep working) or a slug.
const isObjectId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
const byIdOrSlug = (idOrSlug, slugField = 'slug') =>
  isObjectId(idOrSlug) ? { _id: idOrSlug } : { [slugField]: String(idOrSlug).toLowerCase() };

// First free slug: base, then base-<hint>, then base-2, base-3...
const uniqueSlug = async (exists, base, hint) => {
  let slug = base || 'item';
  if (await exists(slug)) slug = hint ? `${base}-${hint}` : base;
  const root = slug;
  let counter = 2;
  while (await exists(slug)) slug = `${root}-${counter++}`;
  return slug;
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (req, defaultLimit = 20) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const requireFields = (body, fields) => {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length) throw new AppError(`Missing required field(s): ${missing.join(', ')}`, 400);
};

const isEmail = (value) => typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value);

const isValidName = (value) => typeof value === 'string' && value.trim().length >= 2 && /^[\p{L}][\p{L}\s.'-]*$/u.test(value.trim());

const isValidPhone = (value) => typeof value === 'string' && value.replace(/\D/g, '').length >= 7 && /^[\d+\-\s()]{7,20}$/.test(value.trim());

// Mirrors the frontend rule: 8+ chars, upper, lower, digit, symbol.
const passwordIssues = (value) => {
  const v = typeof value === 'string' ? value : '';
  const issues = [];
  if (v.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(v)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(v)) issues.push('a lowercase letter');
  if (!/\d/.test(v)) issues.push('a number');
  if (!/[^A-Za-z0-9]/.test(v)) issues.push('a special character');
  return issues;
};

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const toGeoPoint = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new AppError('Invalid latitude/longitude', 400);
  }
  // GeoJSON order is [longitude, latitude].
  return { type: 'Point', coordinates: [longitude, latitude] };
};

// Mongo filter for "within radiusKm of (lat, lng)" on a GeoJSON field.
const withinKm = (lat, lng, radiusKm = 10) => {
  const point = toGeoPoint(lat, lng);
  return { $geoWithin: { $centerSphere: [point.coordinates, Number(radiusKm) / 6378.1] } };
};

module.exports = {
  AppError,
  DAYS,
  cleanString,
  escapeRegex,
  slugify,
  isObjectId,
  byIdOrSlug,
  uniqueSlug,
  getPagination,
  requireFields,
  isEmail,
  isValidName,
  isValidPhone,
  passwordIssues,
  signToken,
  toGeoPoint,
  withinKm,
};
