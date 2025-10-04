// src/context/NotificationContext.jsx
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import SocketService from '../utils/socket';
import { useAppContext } from './AppContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, token, isAuthenticated, backendUrl } = useAppContext();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const mounted = useRef(true);
  const setupComplete = useRef(false);

  // =============================
  // SOCKET.IO SETUP
  // =============================
  useEffect(() => {
    mounted.current = true;
    if (!mounted.current || setupComplete.current || !isAuthenticated || !user || !token) return;

    const setup = async () => {
      try {
        const socket = await SocketService.connect(token);
        if (!mounted.current) return SocketService.disconnect();

        setIsConnected(true);
        setupComplete.current = true;

        // Join user room (user notifications)
        SocketService.joinUserRoom(user._id);

        // Admin users join "admins" room
        if (user.role === 'admin') SocketService.joinAdminRoom(user._id);

        // Listen for incoming notifications
        setupSocketListeners(socket);

        // Load existing notifications from backend
        await fetchNotifications();
      } catch (error) {
        console.error('Socket setup error:', error);
        if (mounted.current) {
          setConnectionError(error.message);
          setIsConnected(false);
          setupComplete.current = false;
        }
      }
    };

    setup();
    return () => cleanupSocket();
  }, [isAuthenticated, user, token]);

  // =============================
  // SOCKET LISTENERS
  // =============================
  const setupSocketListeners = (socket) => {
    socket.off('newNotification'); // ensure no duplicates
    socket.on('newNotification', (notification) => {
      if (!mounted.current) return;

      // Update state
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const browserNotification = new Notification(notification.title || 'New Notification', {
          body: notification.message,
          icon: '/icon.png',
          badge: '/icon.png'
        });
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
          if (notification.pageToNavigate) window.location.href = notification.pageToNavigate;
        };
        setTimeout(() => browserNotification.close(), 5000);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setupComplete.current = false;
    });
  };

  // =============================
  // FETCH NOTIFICATIONS
  // =============================
  const fetchNotifications = async () => {
    if (!token || !backendUrl || !user?._id) return;

    try {
      const res = await fetch(`${backendUrl}/api/notifications/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();

      const notifs = data.notifications || data || [];
      setNotifications(notifs);

      const unread = notifs.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error fetching notifications:', err.message);
    }
  };

  // =============================
  // ACTIONS
  // =============================
  const markAsRead = async (notificationId) => {
    if (!token || !backendUrl) return;
    try {
      const res = await fetch(`${backendUrl}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n._id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Mark as read failed:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!token || !backendUrl) return;
    try {
      const res = await fetch(`${backendUrl}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Mark all read failed:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!token || !backendUrl) return;
    try {
      const res = await fetch(`${backendUrl}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (err) {
      console.error('Delete notification failed:', err);
    }
  };

  // =============================
  // CLEANUP
  // =============================
  const cleanupSocket = () => {
    SocketService.disconnect();
    setIsConnected(false);
    setConnectionError(null);
    setupComplete.current = false;
    setNotifications([]);
    setUnreadCount(0);
  };

  // =============================
  // BROWSER PERMISSION
  // =============================
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        connectionError,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
