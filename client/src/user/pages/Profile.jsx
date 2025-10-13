import React, { useState } from "react";
import { FaCog } from "react-icons/fa";
import { useAppContext } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "../../services/authServices";

const Profile = () => {
  const { user, logout, toggleTheme, backendUrl, token, theme } = useAppContext();
  const navigate = useNavigate();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    try {
      const res = await updateProfile(backendUrl, token, formData);
      console.log("Profile updated:", res);
      setIsEditOpen(false);
      window.location.reload();
    } catch (err) {
      console.error("Update failed:", err.message || err);
    }
  };

  return (
    <div className="relative min-h-screen bg-[rgb(240,240,240)] dark:bg-gray-900 flex flex-col items-center p-6 transition-all duration-300">
      {/* Settings Button */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="absolute top-5 right-5 text-gray-800 dark:text-white hover:text-black transition-all"
      >
        <FaCog size={22} />
      </button>

      {/* Avatar */}
      <div className="mt-14 mb-4">
        <div className="w-28 h-28 rounded-full bg-gray-200 shadow-sm flex items-center justify-center text-4xl text-gray-500">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>

      {/* User Info */}
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{user?.name}</h2>
      <p className="text-gray-600 dark:text-gray-400 mt-1">{user?.email}</p>
      <p className="text-gray-600 dark:text-gray-400">{user?.phone}</p>

      {/* Edit Button */}
      <button
        onClick={() => setIsEditOpen(true)}
        className="mt-6 bg-black dark:bg-white dark:text-black text-white px-6 py-2 rounded-full shadow-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all"
      >
        Edit Profile
      </button>

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-80 p-6">
            <h3 className="dark:text-white text-lg font-semibold text-gray-900 mb-4">
              Edit Profile
            </h3>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white"
                placeholder="Name"
              />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white"
                placeholder="Email"
              />
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white"
                placeholder="Phone"
              />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="px-5 py-2 rounded-full bg-black dark:bg-white dark:text-black text-white hover:bg-gray-800 dark:hover:bg-gray-200"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Slide Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white dark:bg-gray-800 shadow-xl rounded-l-3xl transform ${
          isSettingsOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-300 ease-in-out z-50 p-6 flex flex-col`}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h3>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {/* Theme Toggle Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              THEME
            </label>
            
            {/* Smooth Sliding Toggle */}
            <div 
              className="relative w-full h-12 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 cursor-pointer"
              onClick={toggleTheme}
            >
              {/* Background Slider */}
              <div className="relative w-full h-full">
                {/* Sliding Indicator */}
                <div
                  className={`absolute top-1 bottom-1 w-1/2 rounded-lg transition-all duration-300 ease-in-out ${
                    theme === 'light' 
                      ? 'left-1 bg-white shadow-md' 
                      : 'left-[calc(50%-0.125rem)] bg-gray-800 dark:bg-gray-600 shadow-md'
                  }`}
                />
                
                {/* Labels */}
                <div className="relative z-10 h-full flex items-center justify-between px-2">
                  <span
                    className={`flex-1 text-center text-sm font-medium transition-colors duration-200 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    LIGHT
                  </span>
                  <span
                    className={`flex-1 text-center text-sm font-medium transition-colors duration-200 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    DARK
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Other Settings Options */}
          <button className="text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-3 rounded-xl shadow-sm text-gray-700 dark:text-gray-300 font-medium transition-colors">
            Notifications
          </button>

          <button
            onClick={() => {
              setIsSettingsOpen(false);
              navigate("/privacy&security");
            }}
            className="text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-3 rounded-xl shadow-sm text-gray-700 dark:text-gray-300 font-medium transition-colors"
          >
            Privacy & Security
          </button>

          <button
            onClick={logout}
            className="text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-3 rounded-xl shadow-sm text-red-600 dark:text-red-400 font-medium transition-colors mt-4"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Backdrop overlay */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};

export default Profile;