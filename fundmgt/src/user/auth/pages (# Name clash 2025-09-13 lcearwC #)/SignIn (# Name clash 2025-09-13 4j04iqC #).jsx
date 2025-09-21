import React, { useState } from "react";
import axios from "axios";
import { useAppContext } from "../../../context/AppContext";
const SignIn = () => {
  const [step, setStep] = useState("request"); // request | verify | pending
  const [form, setForm] = useState({
    name: "",
    gender: "",
    email: "",
    phone: "",
    otp: "",
  });

  const [message, setMessage] = useState("");
const { backendUrl, login } = useAppContext();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Step 1: Request OTP
  const requestOTP = async () => {
    try {
      const res = await axios.post(`${backendUrl}/api/auth/request-otp`, {
        email: form.email,
      });
      setMessage(res.data.message);
      setStep("verify");
    } catch (err) {
      setMessage(err.response?.data?.message || "Error sending OTP");
    }
  };

  // Step 2: Verify OTP
  const verifyOTP = async () => {
    try {
      const res = await axios.post(`${backendUrl}/api/auth/verify-otp`, {
        email: form.email,
        otp: form.otp,
      });

      if (res.data.newUser) {
        // New user flow
        setStep("pending");
        setMessage("Your request has been sent to admin. Please wait for approval.");
      } else {
        // Existing user flow
        localStorage.setItem("token", res.data.token);
        setMessage("Login successful! Redirecting...");
        window.location.href = "/dashboard"; // or your home page
      }
    } catch (err) {
      setMessage(err.response?.data?.message || "Invalid OTP");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-md w-96">
        <h2 className="text-xl font-bold mb-4 text-center">Sign In</h2>

        {step === "request" && (
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
              onClick={requestOTP}
              className="w-full bg-blue-600 text-white p-2 rounded"
            >
              Send OTP
            </button>
          </>
        )}

        {step === "verify" && (
          <>
            <input
              type="text"
              name="otp"
              placeholder="Enter OTP"
              value={form.otp}
              onChange={handleChange}
              className="w-full p-2 border rounded mb-3"
            />
            <button
              onClick={verifyOTP}
              className="w-full bg-green-600 text-white p-2 rounded"
            >
              Verify OTP
            </button>
          </>
        )}

        {step === "pending" && (
          <div className="text-center">
            <p className="text-gray-700">{message}</p>
          </div>
        )}

        {message && step !== "pending" && (
          <p className="text-center text-sm text-gray-600 mt-4">{message}</p>
        )}
      </div>
    </div>
  );
};

export default SignIn;
