// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppContext } from './AppContext';
import SocketService from '../utils/socket';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { token, backendUrl, user } = useAppContext();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const initializeSocket = async () => {
      if (token && backendUrl && user) {
        try {
          console.log("🔌 Initializing unified socket connection...");
          const socketInstance = await SocketService.connect(backendUrl, token);
          setSocket(socketInstance);
          
          socketInstance.on('connect', () => {
            console.log("✅ Unified socket connected");
            setIsConnected(true);
          });

          socketInstance.on('disconnect', () => {
            console.log("❌ Unified socket disconnected");
            setIsConnected(false);
          });

          socketInstance.on('error', (error) => {
            console.error("❌ Socket error:", error);
          });

        } catch (error) {
          console.error("❌ Failed to initialize unified socket:", error);
          setIsConnected(false);
        }
      } else {
        // Cleanup when no token/user
        if (socket) {
          socket.disconnect();
          setSocket(null);
          setIsConnected(false);
        }
      }
    };

    initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, backendUrl, user?._id]); // Reconnect when user changes

  const value = {
    socket,
    isConnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};