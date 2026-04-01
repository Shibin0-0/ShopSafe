const mongoose = require('mongoose');

// A single-document settings store (use findOneAndUpdate with upsert)
const settingsSchema = new mongoose.Schema({
    websiteEmail: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
