const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DAYS } = require('../utils/helpers');

const { Schema } = mongoose;

const farmerProfileSchema = new Schema(
  {
    stallName: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, trim: true, lowercase: true }, // readable URL for the stall page
    contactPerson: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000 },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
    markets: [{ type: Schema.Types.ObjectId, ref: 'Market' }],
    operatingDays: [{ type: String, enum: DAYS }],
    pickupWindows: [
      {
        _id: false,
        day: { type: String, enum: DAYS, required: true },
        start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
        end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
      },
    ],
    // Orders can be placed/modified/cancelled until this many hours before pickup.
    cutoffHours: { type: Number, default: 12, min: 0 },
    location: {
      address: String,
      mapPin: String,
      latitude: Number,
      longitude: Number,
    },
    geo: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    role: { type: String, enum: ['customer', 'farmer', 'admin'], default: 'customer' },
    isActive: { type: Boolean, default: true },
    farmerProfile: farmerProfileSchema,
    // Family sharing: `group` is the owner's user id once the customer belongs to a family group.
    family: {
      group: { type: Schema.Types.ObjectId, ref: 'User' },
      invites: [{ _id: false, from: { type: Schema.Types.ObjectId, ref: 'User' }, fromName: String, at: { type: Date, default: Date.now } }],
    },
    favorites: {
      farmers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      markets: [{ type: Schema.Types.ObjectId, ref: 'Market' }],
    },
  },
  { timestamps: true }
);

userSchema.index({ 'farmerProfile.geo': '2dsphere' });
userSchema.index({ role: 1, 'farmerProfile.approvalStatus': 1 });
userSchema.index({ role: 1, createdAt: -1 }); // admin user lists (paged, newest first)
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'family.group': 1 }, { sparse: true });

userSchema.index({ 'farmerProfile.slug': 1 }, { unique: true, sparse: true });

userSchema.pre('validate', async function () {
  if (this.role !== 'farmer' || !this.farmerProfile?.stallName || this.farmerProfile.slug) return;
  const { slugify, uniqueSlug } = require('../utils/helpers');
  this.farmerProfile.slug = await uniqueSlug((candidate) => this.constructor.exists({ 'farmerProfile.slug': candidate, _id: { $ne: this._id } }), slugify(this.farmerProfile.stallName));
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
