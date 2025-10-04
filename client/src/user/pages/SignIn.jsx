// src/pages/SignIn.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAppContext } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { requestOTP, verifyOTP, registerDetails } from "../../services/authServices";

const SignIn = () => {
  const { backendUrl, login } = useAppContext();
  const navigate = useNavigate();

  const [step, setStep] = useState("email"); // email | verify | register
  const [form, setForm] = useState({ email: "", otp: "", name: "", phone: "", gender: "" });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const otpInterval = useRef(null);

  const otpInputRef = useRef(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value.trim() });

  // ===============================
  // OTP Timer / Resend OTP
  // ===============================
  useEffect(() => {
    if (otpTimer === 0) {
      clearInterval(otpInterval.current);
      return;
    }
    otpInterval.current = setInterval(() => {
      setOtpTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(otpInterval.current);
  }, [otpTimer]);

  // Auto-focus OTP input when step changes to "verify"
  useEffect(() => {
    if (step === "verify" && otpInputRef.current) otpInputRef.current.focus();
  }, [step]);

  // ===============================
  // Step 1: Request OTP
  // ===============================
  const handleRequestOTP = async () => {
    if (!form.email) return setMessage({ type: "error", text: "Email is required" });

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const data = await requestOTP(backendUrl, form.email);
      setMessage({ type: "success", text: data.message || "OTP sent successfully" });
      setStep("verify");
      setForm(prev => ({ ...prev, otp: "" }));
      setOtpTimer(60); // OTP valid for 60 seconds
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || err.message || "Error sending OTP" });
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // Step 2: Verify OTP
  // ===============================
  const handleVerifyOTP = async () => {
    if (!form.otp) return setMessage({ type: "error", text: "OTP is required" });

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const data = await verifyOTP(backendUrl, form.email, form.otp);

      if (!data.success) throw new Error(data.message || "OTP verification failed");

      if (data.redirect === "/register") {
        setStep("register");
        setMessage({ type: "info", text: data.message || "Please complete your registration" });
      } else {
        if (data.token) login(data.token, data.user || {});
        setMessage({ type: "success", text: data.message || "Login successful!" });
        setTimeout(() => navigate(data.redirect || "/landing"), 1500);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || err.message || "Invalid or expired OTP" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (otpTimer === 0) handleRequestOTP();
  };

  // ===============================
  // Step 3: Register Details
  // ===============================
  const handleRegister = async () => {
    const { name, phone, gender, email } = form;

    if (!name || !phone || !gender) return setMessage({ type: "error", text: "All fields are required" });

    if (!/^[0-9]{10}$/.test(phone)) return setMessage({ type: "error", text: "Please enter a valid 10-digit phone number" });

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const data = await registerDetails(backendUrl, { email, name, phone, gender });

      if (!data.success) throw new Error(data.message || "Registration failed");

      if (data.token) login(data.token, data.user || {});
      setMessage({ type: "success", text: data.message || "Registration submitted successfully!" });
      setTimeout(() => navigate(data.redirect || "/landing"), 2000);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || err.message || "Error submitting registration. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-md w-96">
        <h2 className="text-xl font-bold mb-4 text-center">Sign In</h2>

        {/* Step 1: Email */}
        {step === "email" && (
          <>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              className="w-full p-2 border rounded mb-3"
            />
            <button
              onClick={handleRequestOTP}
              disabled={loading}
              className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        )}

        {/* Step 2: Verify OTP */}
        {step === "verify" && (
          <>
            <input
              type="number"
              name="otp"
              placeholder="Enter OTP"
              value={form.otp}
              onChange={handleChange}
              ref={otpInputRef}
              className="w-full p-2 border rounded mb-3"
            />
            <button
              onClick={handleVerifyOTP}
              disabled={loading}
              className="w-full bg-green-600 text-white p-2 rounded disabled:opacity-50 mb-2"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              onClick={handleResendOTP}
              disabled={otpTimer > 0 || loading}
              className="w-full bg-gray-500 text-white p-2 rounded disabled:opacity-50"
            >
              {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : "Resend OTP"}
            </button>
          </>
        )}

        {/* Step 3: Register */}
        {step === "register" && (
          <>
            <input
              type="text"
              name="name"
              placeholder="Enter your name"
              value={form.name}
              onChange={handleChange}
              className="w-full p-2 border rounded mb-3"
            />
            <input
              type="text"
              name="phone"
              placeholder="Enter your phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full p-2 border rounded mb-3"
            />
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="w-full p-2 border rounded mb-3"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-purple-600 text-white p-2 rounded disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </>
        )}

        {/* Message */}
        {message.text && (
          <p
            className={`text-center text-sm mt-4 ${
              message.type === "error" ? "text-red-500" :
              message.type === "success" ? "text-green-500" :
              "text-gray-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
};

export default SignIn;
