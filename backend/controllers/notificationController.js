const Notification = require("../models/Notification");
const User = require("../models/User"); // Assuming you have a User model

// Create notification for a single user
const createNotification = async (req, res) => {
  try {
    const { userId, type, message, pageToNavigate } = req.body;

    const notification = new Notification({
      user: userId,
      type,
      message,
      pageToNavigate,
    });

    await notification.save();

    // Optional: Emit real-time notification via Socket.IO
    if (req.io) {
      req.io.to(userId.toString()).emit("newNotification", notification);
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Create notifications for all users (broadcast)
const createBroadcastNotification = async (req, res) => {
  try {
    const { message, pageToNavigate } = req.body;

    const users = await User.find({}); // all users

    const notifications = users.map((user) => ({
      user: user._id,
      type: "broadcast",
      message,
      pageToNavigate,
    }));

    const created = await Notification.insertMany(notifications);

    // Optional: emit real-time notifications via Socket.IO
    if (req.io) {
      users.forEach((user) => {
        req.io.to(user._id.toString()).emit("newNotification", {
          message,
          pageToNavigate,
        });
      });
    }

    res.status(201).json({ count: created.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get notifications for a user
const getNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Mark a notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );

    res.json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  createNotification,
  createBroadcastNotification,
  getNotifications,
  markAsRead,
};
