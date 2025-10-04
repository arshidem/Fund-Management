// src/user/pages/NotificationsPage.jsx
import React, { useEffect } from "react";
import { useNotifications } from "../../context/NotificationContext";

const NotificationsPage = () => {
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Notifications ({unreadCount} unread)</h2>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length === 0 && (
          <p className="text-gray-500 text-center">No notifications yet.</p>
        )}

        <ul>
          {notifications.map((n) => (
            <li
              key={n._id}
              className={`p-3 mb-2 border rounded flex justify-between items-center ${
                n.read ? "bg-gray-50" : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex-1 cursor-pointer" onClick={() => {
                if (!n.read) markAsRead(n._id);
                if (n.pageToNavigate) window.location.href = n.pageToNavigate;
              }}>
                <p className="font-medium">{n.message}</p>
                <small className="text-gray-500">
                  {new Date(n.createdAt).toLocaleString()}
                </small>
              </div>
              <button
                onClick={() => deleteNotification(n._id)}
                className="text-red-500 hover:underline ml-4"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default NotificationsPage;
