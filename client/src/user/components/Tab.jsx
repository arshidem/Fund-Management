import React from "react";
import { NavLink } from "react-router-dom";
import { FaHome, FaCalendarAlt, FaComments, FaWallet, FaUser } from "react-icons/fa";
import { useState } from "react";

const tabs = [
  { name: "Dashboard", icon: <FaHome />, path: "/dashboard" },
  { name: "Events", icon: <FaCalendarAlt />, path: "/events" },
  { name: "Chat", icon: <FaComments />, path: "/messages" },
  { name: "Contributions", icon: <FaWallet />, path: "/contribution" },
  { name: "Profile", icon: <FaUser />, path: "/profile" },
];

export default function Tab() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex flex-col bg-white border-r shadow-sm transition-all duration-300 ${
          expanded ? "w-48" : "w-20"
        }`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="mt-6 flex flex-col items-center space-y-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.name}
              to={tab.path}
              className={({ isActive }) =>
                `flex items-center gap-3 w-full px-4 py-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-lg ${
                  isActive ? "bg-blue-100 text-blue-600 font-medium" : ""
                }`
              }
            >
              <span className="text-xl">{tab.icon}</span>
              {expanded && <span className="text-sm">{tab.name}</span>}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md flex justify-around md:hidden z-50 ">
        {tabs.map((tab) => (
          <NavLink
            key={tab.name}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center text-black text-sm px-5 py-4 rounded ${
                isActive ? "bg-gray-300" : ""
              }`
            }
          >
            <span className="text-xl">{tab.icon}</span>
          </NavLink>
        ))}
      </div>
    </>
  );
}
