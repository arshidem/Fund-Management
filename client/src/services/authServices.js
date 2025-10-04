// src/services/authServices.js
import axios from "axios";

// Request OTP
export const requestOTP = async (backendUrl, email) => {
  try {
    const res = await axios.post(`${backendUrl}/api/auth/request-otp`, { email });
    return res.data; // { message, userExists, isApproved, ... }
  } catch (err) {
    throw err.response?.data || { message: "Error sending OTP" };
  }
};

// Verify OTP
export const verifyOTP = async (backendUrl, email, otp) => {
  try {
    const res = await axios.post(`${backendUrl}/api/auth/verify-otp`, { email, otp });
    const data = res.data;

    // Backend might return token only if approved
    // Or token + user object if approved
    return data;
  } catch (err) {
    throw err.response?.data || { message: "Invalid OTP" };
  }
};

// Register new user details
export const registerDetails = async (backendUrl, { email, name, phone, gender }) => {
  try {
    const res = await axios.post(`${backendUrl}/api/auth/register-details`, {
      email,
      name,
      phone,
      gender,
    });
    return res.data; // { message }
  } catch (err) {
    throw err.response?.data || { message: "Error submitting registration" };
  }
};

// Auth me (get current logged-in user)
export const authMe = async (backendUrl, token) => {
  try {
    const res = await axios.get(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data; // { user }
  } catch (err) {
    throw err.response?.data || { message: "Error fetching user" };
  }
};
