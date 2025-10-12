import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
} from "react";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";
import { notificationAPI } from "../services/notificationService";
import { useAppContext } from "./AppContext";

const NotificationContext = createContext();

// Notification reducer
const notificationReducer = (state, action) => {
  switch (action.type) {
    case "SET_NOTIFICATIONS":
      return {
        ...state,
        notifications: action.payload.notifications,
        pagination: action.payload.pagination,
        unreadCount: action.payload.unreadCount,
        lastFetched: Date.now(),
      };

    case "ADD_NOTIFICATION":
      const isDuplicate = state.notifications.some(
        (notif) => notif._id === action.payload._id
      );

      if (isDuplicate) return state;

      // Limit notifications to prevent memory issues
      const newNotifications = [action.payload, ...state.notifications].slice(
        0,
        100
      );

      return {
        ...state,
        notifications: newNotifications,
        unreadCount: state.unreadCount + 1,
      };

    case "MARK_AS_READ":
      return {
        ...state,
        notifications: state.notifications.map((notif) =>
          notif._id === action.payload ? { ...notif, isRead: true } : notif
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };

    case "MARK_ALL_AS_READ":
      return {
        ...state,
        notifications: state.notifications.map((notif) => ({
          ...notif,
          isRead: true,
        })),
        unreadCount: 0,
      };

    case "DELETE_NOTIFICATION":
      const notificationToDelete = state.notifications.find(
        (notif) => notif._id === action.payload
      );

      return {
        ...state,
        notifications: state.notifications.filter(
          (notif) => notif._id !== action.payload
        ),
        unreadCount: notificationToDelete?.isRead
          ? state.unreadCount
          : Math.max(0, state.unreadCount - 1),
      };

    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload,
      };

    case "SET_UNREAD_COUNT":
      return {
        ...state,
        unreadCount: action.payload,
      };

    case "SET_SOCKET_CONNECTED":
      return {
        ...state,
        socketConnected: action.payload,
      };

    case "CLEAR_NOTIFICATIONS":
      return {
        ...state,
        notifications: [],
        unreadCount: 0,
        pagination: { current: 1, total: 1 },
      };

    default:
      return state;
  }
};

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  socketConnected: false,
  pagination: {
    current: 1,
    total: 1,
  },
  lastFetched: null,
};

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { token, user } = useAppContext();
  const socketRef = useRef(null);
  const fetchTimeoutRef = useRef(null);

  // Initialize Socket.io with better connection handling
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      dispatch({ type: "CLEAR_NOTIFICATIONS" });
      dispatch({ type: "SET_SOCKET_CONNECTED", payload: false });
      return;
    }

    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

    console.log("🔌 Connecting to notification server...");

    socketRef.current = io(backendUrl, {
      auth: {
        token: token,
      },
      transports: ["websocket", "polling"],
      timeout: 10000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Connected to notification server");
      dispatch({ type: "SET_SOCKET_CONNECTED", payload: true });
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("❌ Disconnected from notification server:", reason);
      dispatch({ type: "SET_SOCKET_CONNECTED", payload: false });
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("🔌 Connection error:", error.message);
      dispatch({ type: "SET_SOCKET_CONNECTED", payload: false });
    });

    socketRef.current.on("newNotification", (notification) => {
      console.log("📨 New notification received");
      dispatch({ type: "ADD_NOTIFICATION", payload: notification });
      showNotificationToast(notification);
    });

    socketRef.current.on("notificationRead", (data) => {
      dispatch({ type: "SET_UNREAD_COUNT", payload: data.unreadCount });
    });

    socketRef.current.on("allNotificationsRead", (data) => {
      dispatch({ type: "SET_UNREAD_COUNT", payload: data.unreadCount });
    });

    socketRef.current.on("notificationDeleted", (data) => {
      dispatch({ type: "SET_UNREAD_COUNT", payload: data.unreadCount });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token]);

  // Debounced fetch notifications
  useEffect(() => {
    if (token) {
      // Clear any pending fetch
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Debounce fetch to prevent rapid consecutive calls
      fetchTimeoutRef.current = setTimeout(() => {
        fetchNotifications();
        fetchUnreadCount();
      }, 500);
    } else {
      dispatch({ type: "CLEAR_NOTIFICATIONS" });
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [token]);

  // Show notification toast
  const showNotificationToast = (notification) => {
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 ${
            notification.priority === "high"
              ? "border-red-500"
              : notification.priority === "medium"
              ? "border-yellow-500"
              : "border-blue-500"
          }`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {notification.message}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(notification.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                if (notification.actionUrl) {
                  window.location.href = notification.actionUrl;
                }
              }}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View
            </button>
          </div>
        </div>
      ),
      {
        duration: 6000,
        position: "top-right",
      }
    );
  };

  // Actions with better error handling
  const fetchNotifications = async (page = 1, limit = 20, filters = {}) => {
    // Prevent too frequent fetches (min 2 seconds between fetches)
    if (state.lastFetched && Date.now() - state.lastFetched < 2000) {
      console.log("⏳ Skipping fetch - too frequent");
      return;
    }

    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await notificationAPI.getNotifications(
        page,
        limit,
        filters
      );

      if (response.success) {
        dispatch({
          type: "SET_NOTIFICATIONS",
          payload: {
            notifications: response.data,
            pagination: response.pagination,
            unreadCount: response.unreadCount,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      if (error.message !== "Too many concurrent requests") {
        toast.error("Failed to load notifications");
      }
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationAPI.getUnreadCount();
      if (response.success) {
        dispatch({
          type: "SET_UNREAD_COUNT",
          payload: response.data.unreadCount,
        });
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
      // Silent fail for unread count
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await notificationAPI.markAsRead(notificationId);
      if (response.success) {
        dispatch({ type: "MARK_AS_READ", payload: notificationId });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await notificationAPI.markAllAsRead();
      if (response.success) {
        dispatch({ type: "MARK_ALL_AS_READ" });
        toast.success("All notifications marked as read");
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      toast.error("Failed to mark all notifications as read");
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await notificationAPI.deleteNotification(notificationId);
      if (response.success) {
        dispatch({ type: "DELETE_NOTIFICATION", payload: notificationId });
        toast.success("Notification deleted");
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    }
  };
  // Add this function to your NotificationContext
  const markAllAsReadOnVisit = async () => {
    try {
      const response = await notificationAPI.markAllAsRead();
      if (response.success) {
        dispatch({ type: "MARK_ALL_AS_READ" });
        console.log("✅ All notifications marked as read automatically");
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };
const updateEntryStatus = async (notificationId, status) => {
  const res = await fetch(`${backendUrl}/api/notifications/${notificationId}/entry-status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (data.success) {
    setNotifications(prev =>
      prev.map(n =>
        n._id === notificationId
          ? { ...n, metadata: { ...n.metadata, status } }
          : n
      )
    );
  }
};

  const value = {
    ...state,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    markAllAsReadOnVisit, // Add this
    updateEntryStatus,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};
