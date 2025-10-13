import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FaHome, FaCalendarAlt, FaComments, FaWallet, FaUser } from "react-icons/fa";

const tabs = [
  { name: "Dashboard", icon: <FaHome />, path: "/dashboard" },
  { name: "Events", icon: <FaCalendarAlt />, path: "/events" },
  { name: "Chat", icon: <FaComments />, path: "/messages" },
  { name: "Contributions", icon: <FaWallet />, path: "/contribution" },
  { name: "Profile", icon: <FaUser />, path: "/profile" },
];

export default function Tab() {
  const [expanded, setExpanded] = useState(false);
  const [activeRect, setActiveRect] = useState({ left: 0, width: 0 });
  const location = useLocation();
  const containerRef = useRef(null);

  // ✅ Update active tab position on route change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeLink = container.querySelector("a.active-tab");
    if (activeLink) {
      const rect = activeLink.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();

      setActiveRect({
        left: rect.left - parentRect.left,
        width: rect.width,
      });
    }
  }, [location.pathname]);

  return (
    <>
      {/* 🖥️ Desktop Sidebar */}
      <div
        className={`hidden md:flex flex-col bg-white border-r shadow-sm transition-all duration-300 dark:bg-gray-900 ${
          expanded ? "w-48" : "w-20"
        }`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="mt-6 flex flex-col space-y-2 relative px-2">
          {/* Animated Background Slider */}
          <div
            className="absolute left-2 right-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg transition-all duration-500 ease-out"
            style={{
              height: "48px",
              top: `${tabs.findIndex(tab => tab.path === location.pathname) * 56}px`,
              opacity: location.pathname ? 1 : 0,
            }}
          />

          {tabs.map((tab, index) => (
            <NavLink
              key={tab.name}
              to={tab.path}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 w-full px-3 py-3 text-gray-600 hover:text-black transition-all duration-400 rounded-lg relative z-10",
                  isActive
                    ? "text-blue-600 font-semibold dark:text-blue-400"
                    : "dark:text-gray-400 dark:hover:text-white",
                ].join(" ")
              }
            >
              <span
                className={`text-xl transition-all duration-300 ${
                  location.pathname === tab.path ? "scale-110" : "group-hover:scale-105"
                }`}
              >
                {tab.icon}
              </span>
              {expanded && (
                <span className="text-sm transition-all duration-300 delay-75">
                  {tab.name}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* 📱 Mobile Bottom Nav */}
      <div
        ref={containerRef}
        className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 shadow-2xl flex justify-around items-center py-3 px-2 z-[9999] rounded-t-2xl md:hidden"
      >
        {/* Animated Slider */}
        <div
          className="absolute top-2 bottom-2 bg-blue-500/20 rounded-xl border border-blue-500/30 transition-all duration-500 ease-out"
          style={{
            left: `${activeRect.left}px`,
            width: `${activeRect.width}px`,
          }}
        />

        {tabs.map((tab) => (
          <NavLink
            key={tab.name}
            to={tab.path}
            className={({ isActive }) =>
              [
                "flex flex-col items-center justify-center flex-1 relative z-10",
                isActive ? "text-white active-tab" : "text-gray-500",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <div className="flex flex-col items-center rounded-lg transition-all duration-300">
                <span
                  className={`text-2xl mb-1 transition-all duration-300 ${
                    isActive
                      ? "text-white scale-110 drop-shadow-lg"
                      : "text-gray-500 hover:text-gray-300 hover:scale-105"
                  }`}
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-xs font-medium transition-all duration-300 ${
                    isActive
                      ? "text-white scale-105 font-semibold"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab.name}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </>
  );
}
