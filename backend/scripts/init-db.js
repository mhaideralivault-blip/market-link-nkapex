// Usage: npm run db:init
// Creates every collection and index defined by the Mongoose models (the schema "definition script").
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const models = ['User', 'Market', 'Category', 'Product', 'Order', 'Review', 'Notification', 'Announcement', 'Report', 'Harvest'].map((n) =>
  require(`../models/${n}`)
);

(async () => {
  await connectDB();
  console.log(`Connected to database "${mongoose.connection.name}"`);
  for (const Model of models) {
    await Model.createCollection();
    await Model.syncIndexes();
    const indexes = await Model.collection.indexes();
    console.log(`- ${Model.collection.name}: ${indexes.map((index) => index.name).join(', ')}`);
  }
  await mongoose.disconnect();
  console.log('Database is ready.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
