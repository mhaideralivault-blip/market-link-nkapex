const mongoose = require('mongoose');

const { Schema } = mongoose;

// A farmer announces produce that is *coming* (e.g. "Alphonso mangoes, next Saturday").
// Customers tap "Notify me" and get an alert when the farmer marks it available.
const HARVEST_STATUSES = ['upcoming', 'available', 'cancelled'];

const harvestSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 400 },
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    expectedDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    estimatedQuantity: { type: Number, min: 0 },
    unit: { type: String, trim: true, maxlength: 20, default: 'kg' },
    status: { type: String, enum: HARVEST_STATUSES, default: 'upcoming', index: true },
    subscribers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

harvestSchema.statics.STATUSES = HARVEST_STATUSES;
harvestSchema.index({ status: 1, expectedDate: 1 });
harvestSchema.index({ farmer: 1, expectedDate: 1 });
harvestSchema.index({ subscribers: 1 });

module.exports = mongoose.model('Harvest', harvestSchema);
