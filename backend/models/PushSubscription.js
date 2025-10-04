const mongoose = require("mongoose");

const PushSubscriptionSchema = new mongoose.Schema(
  {
    subscription: { type: Object, required: true },
    userId: { type: String, required: true },
    role: { type: String, required: true }, // "admin" or "user"
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushSubscription", PushSubscriptionSchema);
