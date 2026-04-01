const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    company: {
        type: String
    },
    category: {
        type: String
    },
    quantity: {
        type: Number,
        default: 1
    },
    batchNumber: {
        type: String
    },
    manufactureDate: {
        type: Date
    },
    barcode: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String
    },
    expiryDate: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Product", productSchema);