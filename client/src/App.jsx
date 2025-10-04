// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { NotificationProvider } from "./context/NotificationContext"; // Add this

import SignIn from "./user/pages/SignIn";
import Landing from "./user/pages/Landing";
import Dashboard from "./user/pages/Dashboard";
import Blocked from "./user/pages/Blocked";
import ProtectedRoute from "./user/components/ProtectedRoute";
import EventDetails from "./user/pages/EventDetails";
import NotificationsPage from "./user/pages/NotificationsPage"; // Add notifications page
// import AdminDashboard from "./admin/pages/AdminDashboard"; // If you have admin dashboard

function App() {
  // Request browser notification permission on app start
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('✅ Notification permission granted');
        }
      });
    }
  }, []);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('[Service Worker] Registered:', reg.scope))
      .catch(err => console.error('[Service Worker] Registration failed:', err));
  });
}

  return (
    <Router>
      <AppProvider>
        <NotificationProvider> {/* Wrap with NotificationProvider */}
          <Routes>
            {/* Root path redirects to landing */}
            <Route path="/" element={<Navigate to="/landing" replace />} />
            
            {/* Public routes */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/blocked" element={<Blocked />} />
            
            {/* Landing page - protected (requires token) but doesn't require approval */}
            <Route 
              path="/landing" 
              element={
                <ProtectedRoute>
                  <Landing />
                </ProtectedRoute>
              } 
            />
            
            {/* Notifications page */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute requireApproved={true}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            {/* <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireApproved={true} requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            /> */}

            {/* Admin approvals page */}
            {/* <Route path="/admin/approvals"
              element={
                <ProtectedRoute requireApproved={true} requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }/> */}
            
            {/* Fully protected routes - require approval */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireApproved={true}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Event details route - fully protected */}
            <Route
              path="/events/:eventId"
              element={
                <ProtectedRoute requireApproved={true}>
                  <EventDetails/>
                </ProtectedRoute>
              }
            />
            
            {/* Fallback for unknown routes */}
            <Route path="*" element={<Navigate to="/landing" replace />} />
          </Routes>
        </NotificationProvider>
      </AppProvider>
    </Router>
  );
}

export default App;