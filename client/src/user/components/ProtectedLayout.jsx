// src/user/components/ProtectedLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Tab from "./Tab";

export default function ProtectedLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar / Tab */}
      <Tab />

      {/* Page content */}
      <div className="flex-1 mb-14 md:mb-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
