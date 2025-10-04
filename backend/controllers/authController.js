const User = require("../models/User");
const jwt = require("jsonwebtoken");
const SibApiV3Sdk = require('@sendinblue/client');
const notificationService = require('../services/notificationService');

// Helpers
// authController.js
const Notification = require("../models/Notification");

// --------------------------
// Helper to notify all admins
// --------------------------
const notifyAdmins = async (req, user, message, pageToNavigate) => {
  try {
    const io = req.app.get('io');
    if (!io) return;

    const admins = await User.find({ role: 'admin', isActive: true });

    const notifications = admins.map(admin => ({
      user: admin._id,
      type: 'signup',
      message,
      pageToNavigate,
      read: false,
      createdAt: new Date()
    }));

    await Notification.insertMany(notifications);

    admins.forEach(admin => {
      io.to(admin._id.toString()).emit('new-notification', {
        user: admin._id,
        type: 'signup',
        message,
        pageToNavigate,
        read: false,
        createdAt: new Date()
      });
    });

    console.log('📢 Admin notification sent for new user signup');
  } catch (err) {
    console.error('⚠️ Failed to notify admins:', err);
  }
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

const client = new SibApiV3Sdk.TransactionalEmailsApi();
client.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const sendOTP = async (email, otp) => {
  try {
    await client.sendTransacEmail({
      sender: { name: 'Community App', email: process.env.SENDER_EMAIL },
      to: [{ email }],
      subject: 'Your OTP Code',
      htmlContent: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error('Failed to send OTP:', error);
    throw new Error('OTP sending failed');
  }
};


// 📌 Step 1: Request OTP
exports.requestOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = generateOTP();
  let user = await User.findOne({ email });

  if (!user) {
    // New user → OTP sent, wait for registration
    user = new User({
      email,
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000),
      isApproved: false,
      isActive: false,
    });
    await user.save();
    await sendOTP(email, otp);
    return res.status(200).json({ message: "OTP sent", userExists: false });
  }

  // Existing user
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();
  await sendOTP(email, otp);

  return res.status(200).json({
    message: "OTP sent",
    userExists: true,
    isApproved: user.isApproved,
    isBlocked: user.isBlocked || false,
  });
};

// 📌 Step 2: Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // ✅ Input validation
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    // ✅ Find user with OTP fields
    const user = await User.findOne({ email }).select("+otp +otpExpires");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // ✅ Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Your account is temporarily blocked. Please contact admin." });
    }

    // ✅ OTP validation
    const isExpired = !user.otpExpires || user.otpExpires < new Date();
    if (isExpired || user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // ✅ Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // ✅ Check registration
    const isRegistered = user.name && user.phone && user.gender;

    // 🚀 Case 1: Not registered → show registration form
    if (!isRegistered) {
      const tempToken = generateToken(user._id);
      return res.status(200).json({
        success: true,
        userExists: false,
        message: "Please complete your registration",
        tempToken,
        user: { _id: user._id, email: user.email },
        redirect: "/register"
      });
    }

    // ✅ Generate auth token
    const token = generateToken(user._id);

    // ✅ Update activity
    user.isActive = true;
    user.lastLogin = new Date();
    await user.save();

    // 🚀 Case 2: Registered but not approved → notify admin
    if (!user.isApproved) {
      await notifyAdmins(req, {
        userId: user._id,
        message: `New user registered: ${user.name}`,
        pageToNavigate: "/admin/users"
      });

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

    // 🚀 Case 3: Registered & approved → dashboard
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

exports.registerDetails = async (req, res) => {
  try {
    const { email, name, phone, gender } = req.body;
    if (!email || !name || !phone || !gender)
      return res.status(400).json({ success: false, message: "All fields are required" });

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone))
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit phone number" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.name && user.phone && user.gender)
      return res.status(400).json({ success: false, message: "User registration already completed" });

    user.name = name.trim();
    user.phone = phone;
    user.gender = gender;
    user.isApproved = false;
    user.isActive = true;
    user.lastLogin = new Date();
    await user.save();

    // Notify admins in real time
    const io = req.app.get("io");
    if (io) {
      io.emit("new-user-signup", {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        timestamp: new Date()
      });
      console.log("📢 New user registration notification sent to admin");
    }

    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      message: "Registration submitted successfully. Waiting for admin approval.",
      token,
      user: { ...user.toObject() },
      redirect: "/landing"
    });

  } catch (error) {
    console.error("❌ Registration error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get current logged-in user
exports.authMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "-otp -otpExpires -password"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get any user by ID (admin only)
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-otp -otpExpires -password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
