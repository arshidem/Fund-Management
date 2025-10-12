// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { NotificationProvider } from "./context/NotificationContext";

import SignIn from "./user/pages/SignIn";
import Landing from "./user/pages/Landing";
import Dashboard from "./user/pages/Dashboard";
import Blocked from "./user/pages/Blocked";
import ProtectedRoute from "./user/components/ProtectedRoute";
import EventDetails from "./user/pages/EventDetails";
import NotificationsPage from "./user/pages/NotificationsPage";
import UserProfile from "./user/pages/UserProfile";
import UserMessage from "./user/pages/UserMessage";
import { Toaster } from "react-hot-toast";

import ProtectedLayout from "./user/components/ProtectedLayout"; // Layout wrapper with Tab

import "./index.css";

function App() {
  return (
    <AppProvider>
      <NotificationProvider>
        {/* React Hot Toast Provider */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#363636",
              color: "#fff",
            },
            success: {
              duration: 3000,
              theme: {
                primary: "green",
                secondary: "black",
              },
            },
            error: {
              duration: 5000,
              style: {
                background: "#ef4444",
                color: "#fff",
              },
            },
          }}
        />

        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/landing" replace />} />

          {/* Public routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/blocked" element={<Blocked />} />

          {/* Landing page */}
          <Route
            path="/landing"
            element={
              <ProtectedRoute>
                <Landing />
              </ProtectedRoute>
            }
          />

          {/* Protected pages with Tab/sidebar */}
          <Route
            element={
              <ProtectedRoute requireApproved={true}>
                <ProtectedLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/events/:eventId" element={<EventDetails />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/admin/users/:userId" element={<UserProfile />} />
            <Route path="/messages" element={<UserMessage />} />
            <Route path="/messages/user/:userId" element={<UserMessage />} />
            {/* Add other pages that require sidebar here */}
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </NotificationProvider>
    </AppProvider>
  );
}

export default App;
