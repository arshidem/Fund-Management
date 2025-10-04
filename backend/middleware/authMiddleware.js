// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes: verify JWT & attach user info
exports.protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    // if (user.isBlocked) return res.status(403).json({ message: "Your account is blocked" });

    req.userId = user._id;
    req.userRole = user.role;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Admin-only routes
exports.adminOnly = (req, res, next) => {
  if (req.userRole !== "admin")
    return res.status(403).json({ message: "Forbidden: Admins only" });
  next();
};
