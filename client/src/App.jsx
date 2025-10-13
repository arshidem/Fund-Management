// src/App.jsx
import React from "react";
import { useAppContext, AppProvider } from "./context/AppContext";
import { Routes, Route, Navigate } from "react-router-dom";
import { NotificationProvider } from "./context/NotificationContext";

import SignIn from "./user/pages/SignIn";
import Landing from "./user/pages/Landing";
import Dashboard from "./user/pages/Dashboard";
import Event from "./user/pages/Event";
import Blocked from "./user/pages/Blocked";
import ProtectedRoute from "./user/components/ProtectedRoute";
import EventDetails from "./user/pages/EventDetails/EventDetails";
import NotificationsPage from "./user/pages/NotificationsPage";
import Profile from "./user/pages/Profile";
import PrivacySecurity from "./user/pages/PrivacySecurity";
import UserMessage from "./user/pages/UserMessage";
import ProtectedLayout from "./user/components/ProtectedLayout";

import { Toaster } from "react-hot-toast";
import "./index.css";

// Theme wrapper that uses the context
function ThemeWrapper({ children }) {
  const { theme } = useAppContext();

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark"
          ? "bg-black text-white"
          : "bg-[rgb(240,240,240)] text-black"
      }`}
    >
      {children}
    </div>
  );
}

function AppContent() {
  return (
    <ThemeWrapper>
      <Routes>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/blocked" element={<Blocked />} />

        <Route
          path="/landing"
          element={
            <ProtectedRoute>
              <Landing />
            </ProtectedRoute>
          }
        />

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
          <Route path="/profile" element={<Profile />} />
          <Route path="/privacy&security" element={<PrivacySecurity />} />
          <Route path="/messages" element={<UserMessage />} />
          <Route path="/events" element={<Event />} />
          <Route path="/messages/user/:userId" element={<UserMessage />} />
        </Route>

        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </ThemeWrapper>
  );
}

function App() {
  return (
    <AppProvider>
      <NotificationProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: "#363636", color: "#fff" },
            success: { duration: 3000 },
            error: {
              duration: 5000,
              style: { background: "#ef4444", color: "#fff" },
            },
          }}
        />
        <AppContent />
      </NotificationProvider>
    </AppProvider>
  );
}

export default App;