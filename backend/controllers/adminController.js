const User = require("../models/User");

// 📌 Get pending users
exports.getPendingUsers = async (req, res) => {
  const users = await User.find({ isApproved: false });
  res.status(200).json(users);
};

// 📌 Approve a user
exports.approveUser = async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.isApproved = true;
  user.isActive = true;
  await user.save();

  res.status(200).json({ message: "User approved", user });
};
