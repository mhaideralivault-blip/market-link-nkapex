const mongoose = require('mongoose');

const { Schema } = mongoose;
const { slugify, uniqueSlug } = require('../utils/helpers');

// What a grower can tell customers about a product. Kept as a fixed list so filters and badges stay consistent.
const TAGS = ['organic', 'pesticide-free', 'seasonal', 'fresh-picked', 'handmade', 'small-batch', 'vegan', 'gluten-free'];

const productSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true }, // readable URL, e.g. sourdough-loaf
    description: { type: String, trim: true, maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true, maxlength: 20 }, // kg, dozen, bunch...
    quantityAvailable: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, trim: true },
    harvestedOn: { type: Date }, // harvest / bake / production date, shown as a freshness badge
    storage: { type: String, trim: true, maxlength: 200 }, // e.g. "Refrigerate, best within 5 days"
    tags: [{ type: String, enum: TAGS }],
    // Farmer's manual "temporarily unavailable" switch. Sold out is derived from quantity.
    available: { type: Boolean, default: true },
    // Recurring weekly stock template.
    weeklyTemplate: {
      enabled: { type: Boolean, default: false },
      quantity: { type: Number, min: 0, default: 0 },
      appliedAt: { type: Date }, // last time this product's stock was reset from the template
    },
    // Set false by admin moderation instead of hard-deleting when needed.
    isActive: { type: Boolean, default: true },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Slug is created once (when the product is first saved) and then kept, so shared links never break on renames.
productSchema.pre('validate', async function () {
  if (this.slug) return;
  const User = mongoose.model('User');
  const farmer = await User.findById(this.farmer).select('farmerProfile.stallName').lean();
  this.slug = await uniqueSlug((candidate) => this.constructor.exists({ slug: candidate, _id: { $ne: this._id } }), slugify(this.name), slugify(farmer?.farmerProfile?.stallName));
});

productSchema.index({ name: 'text', description: 'text' });
// Compound indexes matching the public listing filters + sorts (avoid in-memory sorts on big catalogs).
productSchema.index({ isActive: 1, available: 1, createdAt: -1 });
productSchema.index({ category: 1, isActive: 1, createdAt: -1 });
productSchema.index({ farmer: 1, isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, price: 1 });
productSchema.index({ isActive: 1, ratingAvg: -1, ratingCount: -1 });

productSchema.virtual('status').get(function () {
  if (!this.available) return 'unavailable';
  return this.quantityAvailable <= 0 ? 'sold_out' : 'available';
});

productSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.id;
    delete ret.__v;
    return ret;
  },
});

const Product = mongoose.model('Product', productSchema);
Product.TAGS = TAGS;
module.exports = Product;
