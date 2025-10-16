// backend/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const SibApiV3Sdk = require("sib-api-v3-sdk");
require("dotenv").config();

const { sendEntryApprovalNotification } = require('../services/notificationService');
// --------------------------
// Helper functions
// --------------------------
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (userId, temp = false) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: temp ? "15m" : process.env.JWT_EXPIRES_IN || "7d",
  });

const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const sendOTPEmail = async (email, otp) => {
  try {
    const sendSmtpEmail = {
      sender: { name: "Community App", email: process.env.SENDER_EMAIL },
      to: [{ email }],
      subject: "Your OTP Code",
      htmlContent: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    };

    const data = await tranEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log("✅ OTP email sent successfully:", data.messageId || data);
  } catch (err) {
    console.error("❌ Failed to send OTP via Brevo API:", err.message);
    console.log("💡 Fallback: Copy OTP manually:", otp);
  }
};


// --------------------------
// Step 1: Request OTP
// --------------------------
exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid email address" 
      });
    }

    const otp = generateOTP();
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = new User({
        email: email.toLowerCase().trim(),
        otp,
        otpExpires: new Date(Date.now() + 5 * 60 * 1000),
        isApproved: false,
        isActive: false,
      });
      await user.save();
      
      await sendOTPEmail(email, otp);
      
      return res.status(200).json({ 
        success: true,
        message: "OTP sent to your email", 
        userExists: false 
      });
    }

    // Update existing user's OTP
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
    
    await sendOTPEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      userExists: true,
      isApproved: user.isApproved,
    });
  } catch (error) {
    console.error("❌ Request OTP error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// --------------------------
// Step 2: Verify OTP
// --------------------------
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and OTP are required" 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+otp +otpExpires");
      
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found. Please request a new OTP." 
      });
    }


    // Check OTP validity
    const isExpired = !user.otpExpires || user.otpExpires < new Date();
    if (isExpired || user.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid or expired OTP" 
      });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Check if user has completed registration
    const isRegistered = Boolean(user.name && user.phone && user.gender);

    // Case 1: Not registered → send tempToken for registration completion
    if (!isRegistered) {
      const tempToken = generateToken(user._id, true);
      
      return res.status(200).json({
        success: true,
        userExists: false,
        message: "Please complete your registration",
        tempToken,
        user: { 
          _id: user._id, 
          email: user.email 
        },
        redirect: "/register"
      });
    }

    // Generate proper auth token for registered users
    const token = generateToken(user._id);

    // Update user activity
    user.isActive = true;
    user.lastLogin = new Date();
    await user.save();

    // Send sign-in notification to admins for unapproved users
    if (!user.isApproved) {
      try {
        await sendEntryApprovalNotification(user._id, req);
      } catch (notificationError) {
        console.error('Failed to send sign-in notification:', notificationError);
        // Don't fail login if notification fails
      }
    }

    // Case 2: Registered but not approved → notify admins and show pending message
    if (!user.isApproved) {
      return res.status(200).json({
        success: true,
        userExists: true,
        isApproved: false,
        message: "Your account is pending admin approval",
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          gender: user.gender,
          isActive: user.isActive,
          isApproved: user.isApproved,
          lastLogin: user.lastLogin
        },
        redirect: "/landing"
      });
    }

    // Case 3: Registered & approved → proceed to dashboard
    return res.status(200).json({
      success: true,
      userExists: true,
      isApproved: true,
      message: "Login successful!",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        isActive: user.isActive,
        isApproved: user.isApproved,
        lastLogin: user.lastLogin,
        role: user.role || "user"
      },
      redirect: "/dashboard"
    });
  } catch (error) {
    console.error("❌ OTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during OTP verification",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// --------------------------
// Step 3: Complete registration
// --------------------------
exports.registerDetails = async (req, res) => {
  try {
    const { email, name, phone, gender } = req.body;
    
    // Validate all required fields
    if (!email || !name || !phone || !gender) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required" 
      });
    }

    // Validate phone format
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid 10-digit phone number" 
      });
    }

    // Validate gender
    const validGenders = ['male', 'female', 'other'];
    if (!validGenders.includes(gender.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        message: "Please select a valid gender" 
      });
    }

    // Validate name length
    if (name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: "Name must be at least 2 characters long" 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found. Please request a new OTP." 
      });
    }

    // Check if user already completed registration
    if (user.name && user.phone && user.gender) {
      return res.status(400).json({ 
        success: false, 
        message: "User registration already completed" 
      });
    }

    // Update user details
    user.name = name.trim();
    user.phone = phone;
    user.gender = gender.toLowerCase();
    user.isApproved = false;
    user.isActive = true;
    user.lastLogin = new Date();
    await user.save();

    // Notify admins about new user registration
    try {
      await sendEntryApprovalNotification(user._id, req);
      console.log(`📢 Entry approval notification sent for user ${user.name}`);
    } catch (notificationError) {
      console.error('Failed to send registration notification:', notificationError);
      // Don't fail registration if notification fails
    }

    const token = generateToken(user._id);
    
    return res.status(200).json({
      success: true,
      message: "Registration submitted successfully. Waiting for admin approval.",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        isActive: user.isActive,
        isApproved: user.isApproved,
        lastLogin: user.lastLogin
      },
      redirect: "/landing"
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error during registration" 
    });
  }
};

// Utility routes
// --------------------------
exports.authMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-otp -otpExpires -password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    console.error("authMe error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-otp -otpExpires -password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    console.error("getUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update User Profile Controller
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId; // from auth middleware
    const { name, email, phone, gender } = req.body;

    // Basic validation
    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ message: "Name, email, and phone are required." });
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email, phone, gender },
      { new: true, runValidators: true }
    ).select("-otp -otpExpires"); // exclude sensitive fields

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

