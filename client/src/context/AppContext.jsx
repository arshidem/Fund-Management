// src/context/AppContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Backend URL from environment
const backendUrl =
  import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const navigate = useNavigate();

  // 'loading' | 'approved' | 'pending' | 'blocked'
  const [status, setStatus] = useState("loading");

  // Derived state
  const isAuthenticated = !!user;
  const canAccess = status === "approved";

  // Function to check user auth status
  const checkUserAuth = async (authToken = token) => {
    if (!authToken) {
      setUser(null);
      setStatus("pending");
      return null;
    }

    setCheckingAuth(true);
    try {
      const res = await fetch(`${backendUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      // Handle token expiration
      if (res.status === 401) {
        logout();
        return null;
      }

      const data = await res.json();

      if (data?.user) {
        setUser(data.user);

        if (data.user.isBlocked) {
          setStatus("blocked");
          navigate("/blocked");
        } else if (!data.user.isApproved) {
          setStatus("pending");
        } else {
          setStatus("approved");
        }
        return data.user;
      } else {
        // Invalid user data
        logout();
        return null;
      }
    } catch (err) {
      console.error("Error checking user auth:", err);
      // Don't logout on network errors, just keep current state
      return user;
    } finally {
      setCheckingAuth(false);
    }
  };

  // Load token from localStorage on mount and check auth
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      // Check auth status immediately
      checkUserAuth(savedToken).finally(() => {
        setAuthReady(true);
      });
    } else {
      setStatus("pending");
      setAuthReady(true);
    }
  }, []);

  // Check auth status when token changes
  useEffect(() => {
    if (token) {
      checkUserAuth();
    }
  }, [token]);

  // Set up periodic auth checking (every 2 minutes)
  // useEffect(() => {
  //   if (!token) return;

  //   const interval = setInterval(() => {
  //     checkUserAuth();
  //   }, 2 * 60 * 1000); // 2 minutes

  //   return () => clearInterval(interval);
  // }, [token]);

  // // Check auth status when app comes back to focus (tab switch)
  // useEffect(() => {
  //   const handleFocus = () => {
  //     if (token) {
  //       checkUserAuth();
  //     }
  //   };

  //   window.addEventListener('focus', handleFocus);
  //   return () => window.removeEventListener('focus', handleFocus);
  // }, [token]);

  // Login function: store token & user
  const login = async (jwt, userData) => {
    localStorage.setItem("token", jwt);
    setToken(jwt);
    setUser(userData);

    if (userData.isBlocked) {
      setStatus("blocked");
      navigate("/blocked");
    } else if (!userData.isApproved) {
      setStatus("pending");
    } else {
      setStatus("approved");
    }

    // Verify the login was successful by checking auth
    await checkUserAuth(jwt);
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setStatus("pending");
    navigate("/");
  };

  // Manual refresh function - can be called from anywhere in the app
  const refreshAuth = async () => {
    return await checkUserAuth();
  };

  return (
    <AppContext.Provider
      value={{
        backendUrl,
        user,
        setUser,
        token,
        setToken,
        isAuthenticated,
        authReady,
        status,
        canAccess,
        checkingAuth,
        login,
        logout,
        refreshAuth, // Export for manual refreshing
      }}
    >
      {authReady ? (
        children
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);