const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Public routes
router.post("/request-otp", authController.requestOTP);
router.post("/verify-otp", authController.verifyOTP);
router.post("/register-details", authController.registerDetails);

// Protected routes
router.get("/me", protect, authController.authMe);

// Admin routes
router.get("/user/:id", protect, adminOnly, authController.getUser);

module.exports = router;
