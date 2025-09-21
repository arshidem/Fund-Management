const User = require("../models/User");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Helpers
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

const sendOTP = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Nike Auth" <${process.env.SENDER_EMAIL}>`,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
  });
};

// 📌 Request OTP
exports.requestOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = generateOTP();
  let user = await User.findOne({ email });

  if (!user) {
    // New user → pending approval
    user = new User({
      email,
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000),
      isActive: false,
      isApproved: false,
    });
  } else {
    // Existing user → update OTP
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
  }

  await user.save();
  await sendOTP(email, otp);

  return res.status(200).json({ message: "OTP sent" });
};

// 📌 Verify OTP
exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ message: "Email and OTP required" });

  const user = await User.findOne({ email }).select("+otp +otpExpires");
  if (!user) return res.status(404).json({ message: "User not found" });

  const isExpired = !user.otpExpires || user.otpExpires < new Date();
  const isMismatch = user.otp !== otp;
  if (isExpired || isMismatch) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  // Clear OTP
  user.otp = null;
  user.otpExpires = null;
  await user.save();

  // If not approved → block login
  if (!user.isApproved) {
    return res.status(403).json({
      message: "Your request has been sent to admin. Please wait for approval.",
    });
  }

  // Approved → login
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);
  return res.status(200).json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      isActive: user.isActive,
      isApproved: user.isApproved,
    },
  });
};
