// src/user/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

const ProtectedRoute = ({ requireApproved = false, children }) => {
  const { token, status, authReady, checkingAuth } = useAppContext();

  // Show loading while checking auth
  if (!authReady || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Verifying access...</div>
      </div>
    );
  }

  // No token but this route doesn't require token (like landing) - allow access
  if (!token && !requireApproved) {
    return children;
  }

  // No token but route requires token - redirect to landing
  if (!token && requireApproved) {
    return <Navigate to="/landing" replace />;
  }

  // User is blocked - redirect to blocked page
  if (status === "blocked") {
    return <Navigate to="/blocked" replace />;
  }

  // Route requires approval but user is not approved
  if (requireApproved && status !== "approved") {
    return <Navigate to="/landing" replace />;
  }

  // All checks passed - render children
  return children;
};

export default ProtectedRoute;