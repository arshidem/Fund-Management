import React from "react";
import { useNavigate } from "react-router-dom";

const PrivacySecurity = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[rgb(240,240,240)] flex flex-col items-center justify-center text-center p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-3">
        Privacy & Security
      </h2>
      <p className="text-gray-600 max-w-sm">
        We value your privacy. Here you’ll find options to manage your data and
        security preferences. (Coming soon)
      </p>

      <button
        onClick={() => navigate(-1)}
        className="mt-6 bg-black text-white px-6 py-2 rounded-full hover:bg-gray-800 transition-all"
      >
        Go Back
      </button>
    </div>
  );
};

export default PrivacySecurity;
