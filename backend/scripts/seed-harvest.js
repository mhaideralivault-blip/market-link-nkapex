// Usage: npm run seed:harvest
// Adds a few "coming soon" harvests so the Harvest calendar has content. Idempotent: re-running refreshes the dates
// (relative to today) of any seeded harvest that is still upcoming and never creates duplicates.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Harvest = require('../models/Harvest');

const inDays = (days) => new Date(Date.now() + days * 24 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

// [farmer email, title, category, days from today, quantity, unit, description]
const HARVESTS = [
  ['sunrise.orchard@marketlink.test', 'Sindhri Mangoes', 'Fruits', 2, 120, 'kg', 'First flush of sweet Sindhri mangoes, tree-ripened and picked the morning of the market.'],
  ['sunrise.orchard@marketlink.test', 'Pomegranates', 'Fruits', 9, 80, 'kg', 'Deep red, juicy pomegranates from our hillside orchard.'],
  ['farmer@marketlink.test', 'Sweet Corn', 'Vegetables', 3, 200, 'pcs', 'Fresh corn on the cob, picked at dawn.'],
  ['farmer@marketlink.test', 'Baby Spinach', 'Vegetables', 6, 40, 'kg', 'Tender baby spinach leaves, pesticide-free.'],
  ['hillside.harvest@marketlink.test', 'Wild Forest Honey', 'Honey & Preserves', 5, 30, 'jar', 'Small batch raw honey collected from the ridge hives.'],
  ['meadow.dairy@marketlink.test', 'Fresh Cream Cheese', 'Dairy', 4, 25, 'kg', 'Soft, creamy cheese made in small batches.'],
  ['goldencrust.bakery@marketlink.test', 'Sourdough Loaves', 'Baked Goods', 1, 40, 'pcs', 'Slow-fermented sourdough, baked the night before.'],
  ['bluewater.catch@marketlink.test', 'Fresh Pomfret', 'Meat & Seafood', 8, 35, 'kg', 'Line-caught pomfret, kept on ice and delivered to the stall.'],
  ['hillside.harvest@marketlink.test', 'Organic Basmati Rice', 'Grains & Pulses', 14, 150, 'kg', 'New-crop aged basmati with a long, fragrant grain.'],
];

(async () => {
  await connectDB();
  if (mongoose.connection.name === 'test' && !process.env.ALLOW_TEST_DB) throw new Error('Refusing to write to the shared "test" database.');
  const categories = new Map((await Category.find()).map((category) => [category.name, category._id]));
  let created = 0;
  let refreshed = 0;
  for (const [email, title, categoryName, days, estimatedQuantity, unit, description] of HARVESTS) {
    const farmer = await User.findOne({ email });
    if (!farmer) continue;
    const existing = await Harvest.findOne({ farmer: farmer._id, title });
    if (!existing) {
      await Harvest.create({ farmer: farmer._id, title, category: categories.get(categoryName), expectedDate: inDays(days), estimatedQuantity, unit, description });
      created++;
    } else if (existing.status === 'upcoming') {
      existing.expectedDate = inDays(days);
      await existing.save();
      refreshed++;
    }
  }
  console.log(`Harvest calendar ready: ${created} created, ${refreshed} refreshed, ${await Harvest.countDocuments({ status: 'upcoming' })} upcoming.`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
