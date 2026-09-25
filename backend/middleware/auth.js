const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../utils/helpers');

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw new AppError('Not authenticated', 401);

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError('User no longer exists', 401);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  req.user = user;
  next();
};

// For public routes that personalise the response when a valid token is sent (never rejects).
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user?.isActive) req.user = user;
    } catch {
      /* invalid token: treat as a guest */
    }
  }
  next();
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new AppError('You do not have access to this resource', 403);
    next();
  };

// Farmers must be approved by an admin before they can list products / take orders.
const approvedFarmer = (req, res, next) => {
  if (req.user.role !== 'farmer' || req.user.farmerProfile?.approvalStatus !== 'approved') {
    throw new AppError('Your farmer account is not approved yet', 403);
  }
  next();
};

module.exports = { protect, optionalAuth, authorize, approvedFarmer };
