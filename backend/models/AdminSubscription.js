// AdminSubscription.js
const mongoose = require("mongoose");

const AdminSubscriptionSchema = new mongoose.Schema({
  subscription: { type: Object, required: true, unique: false }, // store whole subscription object
}, { timestamps: true });

module.exports = mongoose.model("AdminSubscription", AdminSubscriptionSchema);
