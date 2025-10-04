const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",   // Reference to User model; for admin notifications, it can point to admin user
      required: true,
    },
    type: {
      type: String,
      enum: ["admin", "user", "broadcast"],
      default: "user",
    },
    message: {
      type: String,
      required: true,
    },
    pageToNavigate: {
      type: String, // e.g., "/admin/approvals" or "/user/payments"
      default: "/",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
