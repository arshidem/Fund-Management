// src/user/pages/Landing.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { authMe } from "../../services/authServices";

const Landing = () => {
  const { backendUrl, token, user, setUser } = useAppContext();
  const navigate = useNavigate();
console.log(token);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        // No token - don't redirect, just stay on landing
        return;
      }

      try {
        const data = await authMe(backendUrl, token);
        if (data?.user) {
          setUser(data.user);


          // if user is approved → go dashboard
          if (data.user.isApproved) {
            navigate("/dashboard");
          }
          // If not approved, stay on landing (show pending message)
        }
      } catch (err) {
        console.error(err);
        // On error, stay on landing page
      }
    };

    fetchUser();
  }, [token, backendUrl, setUser, navigate]);

  // If no token, show landing page with sign-in button
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Welcome to Fund Management
          </h1>
          <p className="text-gray-600 mb-6">
            Join our community to participate in events, contribute to funds, and stay connected with members.
          </p>
          <button
            onClick={() => navigate("/signin")}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 w-full"
          >
            Sign In
          </button>
          <p className="text-sm text-gray-500 mt-4">
            Don't have an account? Contact admin for registration.
          </p>
        </div>
      </div>
    );
  }

  // If user exists but not approved, show pending message
  if (user && !user.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-yellow-500 text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Pending Approval</h1>
          <p className="text-gray-600 mb-4">
            Hello <strong>{user?.name}</strong>, your account is waiting for admin approval.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            You'll receive an email notification once your account is approved.
          </p>
          <button
            onClick={() => navigate("/signin")}
            className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Show loading while checking (when token exists but user data not loaded yet)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-xl font-semibold">Checking your account...</h1>
    </div>
  );
};

export default Landing;