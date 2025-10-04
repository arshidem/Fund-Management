const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  gender: { type: String, enum: ["male", "female", "other"] },

  otp: { type: String, select: false },
  otpExpires: { type: Date, select: false },

  isActive: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false }, // <-- New field

  role: { type: String, default: "user" },
  lastLogin: { type: Date },
  subscriptions: [
    {
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
      },
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
