// src/context/AppContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

// ✅ Read from Vite or CRA .env (depending on your setup)
// For Vite: use import.meta.env.VITE_BACKEND_URL
// For CRA: use process.env.REACT_APP_BACKEND_URL
const backendUrl =
  import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  useEffect(() => {
    if (token) {
      // Optionally: fetch user data from backend
      fetch(`${backendUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.user) setUser(data.user);
        })
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem("token");
        });
    }
  }, [token]);

  const login = (jwt, userData) => {
    localStorage.setItem("token", jwt);
    setToken(jwt);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AppContext.Provider
      value={{
        backendUrl,
        user,
        token,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
