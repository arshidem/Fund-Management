// src/user/pages/Blocked.jsx
import React from "react";
import { useAppContext } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";

const Blocked = () => {
  const { logout } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/signin");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Account Blocked</h1>
        <p className="text-gray-700 mb-6">
          Your account has been blocked by the admin. Please contact support if you think this is a mistake.
        </p>
        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Blocked;
