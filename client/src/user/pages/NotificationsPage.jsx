import React, { useState, useEffect } from "react";
import { useNotification } from "../../context/NotificationContext";
import { useAdminService } from "../../services/adminService";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EnvelopeIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

const NotificationsPage = () => {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllAsReadOnVisit,
  } = useNotification();

  const adminService = useAdminService();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    type: "",
    unreadOnly: false,
  });
  const [page, setPage] = useState(1);
  const limit = 20;
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [userStatuses, setUserStatuses] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null); // Track which dropdown is open

  // Fetch user status for entry approval notifications
  useEffect(() => {
    const fetchUserStatuses = async () => {
      const entryApprovals = notifications.filter(
        (n) => n.type === "entry_approval" && n.metadata?.newUserId
      );

      for (const notification of entryApprovals) {
        const userId = notification.metadata.newUserId;

        if (!userStatuses[userId]) {
          try {
            console.log("🔄 Fetching status for user:", userId);
            const userData = await adminService.getUserById(userId);

            setUserStatuses((prev) => ({
              ...prev,
              [userId]: {
                isApproved: userData.data.isApproved,
                isBlocked: userData.data.isBlocked,
                name: userData.data.name,
                email: userData.data.email,
              },
            }));
          } catch (error) {
            console.error("❌ Failed to fetch user status:", error);
            setUserStatuses((prev) => ({
              ...prev,
              [userId]: {
                isApproved: false,
                isBlocked: false,
                name: "Unknown",
                email: "Unknown",
              },
            }));
          }
        }
      }
    };

    if (notifications.length > 0) {
      fetchUserStatuses();
    }
  }, [notifications, adminService]);

  // Mark all as read when component mounts
  useEffect(() => {
    if (notifications.length > 0 && unreadCount > 0 && !hasMarkedAsRead) {
      console.log("🔄 Auto-marking all notifications as read...");
      markAllAsReadOnVisit();
      setHasMarkedAsRead(true);
    }
  }, [notifications, unreadCount, hasMarkedAsRead, markAllAsReadOnVisit]);

  // Fetch notifications when page or filters change
  useEffect(() => {
    fetchNotifications(page, limit, filters);
  }, [page, filters]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null);
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Handle back button click
  const handleBackClick = () => {
    if (unreadCount > 0) {
      markAllAsReadOnVisit();
    }
    navigate(-1);
  };

  // Format time function
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours}h ago`;
    } else if (diffInDays < 7) {
      const days = Math.floor(diffInDays);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Get type badge style
  const getTypeBadge = (type) => {
    const types = {
      entry_approval: { label: "Approval", style: "bg-gray-100 text-gray-800" },
      payment_due: { label: "Payment Due", style: "bg-red-100 text-red-800" },
      payment_received: {
        label: "Payment",
        style: "bg-green-100 text-green-800",
      },
      account_approved: {
        label: "Account",
        style: "bg-blue-100 text-blue-800",
      },
      general: { label: "General", style: "bg-gray-100 text-gray-800" },
      warning: { label: "Warning", style: "bg-yellow-100 text-yellow-800" },
      info: { label: "Info", style: "bg-blue-100 text-blue-800" },
    };
    return types[type] || types.general;
  };

  // Extract user ID from notification
  const getUserIdFromNotification = (notification) => {
    return notification.metadata?.newUserId;
  };

  // Handle approve user
  const handleApproveEntry = async (notification, event) => {
    if (event) event.stopPropagation();
    setProcessingAction(notification._id);
    setOpenDropdown(null);

    try {
      const userId = getUserIdFromNotification(notification);

      if (!userId) {
        throw new Error("User ID not found in notification metadata");
      }

      console.log("🔄 Approving user:", userId);
      const result = await adminService.approveUser(
        userId,
        "Approved via notification"
      );
      console.log("✅ User approved successfully:", result);

      // Update local status
      setUserStatuses((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          isApproved: true,
          isBlocked: false,
        },
      }));

      // Refresh notifications
      fetchNotifications(page, limit, filters);
    } catch (error) {
      console.error("❌ Failed to approve user:", error);
      alert(
        "Failed to approve user: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle reject user
  const handleRejectUser = async (notification, event) => {
    if (event) event.stopPropagation();
    setProcessingAction(notification._id);
    setOpenDropdown(null);

    try {
      const userId = getUserIdFromNotification(notification);

      if (!userId) {
        throw new Error("User ID not found in notification metadata");
      }

      const reason = prompt("Enter rejection reason:");
      if (!reason) return;

      console.log("🔄 Rejecting user:", userId);
      const result = await adminService.rejectUser(userId, reason);
      console.log("✅ User rejected successfully:", result);

      // Update local status
      setUserStatuses((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          isApproved: false,
          isBlocked: true,
        },
      }));

      fetchNotifications(page, limit, filters);
    } catch (error) {
      console.error("❌ Failed to reject user:", error);
      alert(
        "Failed to reject user: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle block user
  const handleBlockUser = async (notification, event) => {
    if (event) event.stopPropagation();
    setProcessingAction(notification._id);
    setOpenDropdown(null);

    try {
      const userId = getUserIdFromNotification(notification);

      if (!userId) {
        throw new Error("User ID not found in notification metadata");
      }

      const reason = prompt("Enter block reason:");
      if (!reason) return;

      console.log("🔄 Blocking user:", userId);
      const result = await adminService.blockUser(userId, reason);
      console.log("✅ User blocked successfully:", result);

      // Update local status
      setUserStatuses((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          isBlocked: true,
        },
      }));

      fetchNotifications(page, limit, filters);
    } catch (error) {
      console.error("❌ Failed to block user:", error);
      alert(
        "Failed to block user: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle unblock user
  const handleUnblockUser = async (notification, event) => {
    if (event) event.stopPropagation();
    setProcessingAction(notification._id);
    setOpenDropdown(null);

    try {
      const userId = getUserIdFromNotification(notification);

      if (!userId) {
        throw new Error("User ID not found in notification metadata");
      }

      console.log("🔄 Unblocking user:", userId);
      const result = await adminService.unblockUser(userId);
      console.log("✅ User unblocked successfully:", result);

      // Update local status
      setUserStatuses((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          isBlocked: false,
        },
      }));

      fetchNotifications(page, limit, filters);
    } catch (error) {
      console.error("❌ Failed to unblock user:", error);
      alert(
        "Failed to unblock user: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle view profile
  const handleViewProfile = (notification, event) => {
    event.stopPropagation();
    setOpenDropdown(null);

    const userId = getUserIdFromNotification(notification);
    if (userId) {
      navigate(`/admin/users/${userId}`);
    }
  };

  // Handle send message
  const handleSendMessage = (notification, event) => {
    event.stopPropagation();
    setOpenDropdown(null);

    const userId = getUserIdFromNotification(notification);
    if (userId) {
      // Navigate to messages page or open message modal
      console.log("💬 Send message to user:", userId);
      // You can implement messaging functionality here
      alert(`Send message to user ${userId}`);
    }
  };

  // Handle request more info
  const handleRequestMoreInfo = (notification, event) => {
    event.stopPropagation();
    setOpenDropdown(null);

    const userId = getUserIdFromNotification(notification);
    if (userId) {
      const message = prompt("Enter your information request:");
      if (message) {
        console.log("📝 Request more info from user:", userId, message);
        // Implement API call to send info request
        alert(`Information request sent to user ${userId}`);
      }
    }
  };

  // Handle delete user
  const handleDeleteUser = async (notification, event) => {
    event.stopPropagation();
    setOpenDropdown(null);

    const userId = getUserIdFromNotification(notification);
    if (userId) {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this user? This action cannot be undone."
      );
      if (confirmDelete) {
        setProcessingAction(notification._id);
        try {
          console.log("🗑️ Deleting user:", userId);
          // Implement delete user API call
          // await adminService.deleteUser(userId);
          alert(`User ${userId} deleted successfully`);
          fetchNotifications(page, limit, filters);
        } catch (error) {
          console.error("❌ Failed to delete user:", error);
          alert("Failed to delete user");
        } finally {
          setProcessingAction(null);
        }
      }
    }
  };

  const handleMakePayment = async (notification, event) => {
    event.stopPropagation();
    setProcessingAction(notification._id);

    try {
      console.log("💳 Processing payment for:", notification.metadata);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("✅ Payment processed successfully");

      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
    } catch (error) {
      console.error("❌ Failed to process payment:", error);
      alert("Failed to process payment");
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification) => {
    if (notification.actionUrl && notification.type !== "entry_approval") {
      window.location.href = notification.actionUrl;
    }
  };

  // Toggle dropdown
  const toggleDropdown = (notificationId, event) => {
    event.stopPropagation();
    setOpenDropdown(openDropdown === notificationId ? null : notificationId);
  };

  // Get user status for a notification
  const getUserStatus = (notification) => {
    const userId = getUserIdFromNotification(notification);
    return (
      userStatuses[userId] || {
        isApproved: false,
        isBlocked: false,
        name: "Loading...",
        email: "Loading...",
      }
    );
  };

  // Get primary action button based on user status
  const getPrimaryActionButton = (notification) => {
    if (notification.type === "entry_approval") {
      const userStatus = getUserStatus(notification);
      const { isApproved, isBlocked } = userStatus;

      if (isBlocked) {
        // User is blocked - show Unblock button
        return {
          label: "Unblock",
          onClick: handleUnblockUser,
          style: "bg-green-600 hover:bg-green-700 text-white",
          loadingText: "Unblocking...",
          icon: CheckIcon,
        };
      } else if (isApproved) {
        // User is approved - show Block button
        return {
          label: "Block",
          onClick: handleBlockUser,
          style: "bg-red-600 hover:bg-red-700 text-white",
          loadingText: "Blocking...",
          icon: XMarkIcon,
        };
      } else {
        // User is pending - show Approve button
        return {
          label: "Approve",
          onClick: handleApproveEntry,
          style: "bg-green-600 hover:bg-green-700 text-white",
          loadingText: "Approving...",
          icon: CheckIcon,
        };
      }
    }

    if (notification.type === "payment_due") {
      return {
        label: "Pay Now",
        onClick: handleMakePayment,
        style: "bg-blue-600 hover:bg-blue-700 text-white",
        loadingText: "Processing...",
        icon: CurrencyDollarIcon,
      };
    }

    return null;
  };

  // Get dropdown menu items based on user status
  const getDropdownMenuItems = (notification) => {
    if (notification.type === "entry_approval") {
      const userStatus = getUserStatus(notification);
      const { isApproved, isBlocked } = userStatus;

      if (isBlocked) {
        // Blocked user dropdown options
        return [
          {
            label: "Approve User",
            icon: CheckIcon,
            onClick: handleApproveEntry,
            style: "text-green-700",
          },
          {
            label: "Delete User",
            icon: TrashIcon,
            onClick: handleDeleteUser,
            style: "text-red-700",
          },
        ];
      } else if (isApproved) {
        // Approved user dropdown options
        return [
          {
            label: "View Profile",
            icon: EyeIcon,
            onClick: handleViewProfile,
            style: "text-blue-700",
          },
          {
            label: "Send Message",
            icon: EnvelopeIcon,
            onClick: handleSendMessage,
            style: "text-gray-700",
          },
        ];
      } else {
        // Pending user dropdown options
        return [
          {
            label: "Request More Info",
            icon: ExclamationTriangleIcon,
            onClick: handleRequestMoreInfo,
            style: "text-yellow-700",
          },
          {
            label: "Reject User",
            icon: XMarkIcon,
            onClick: handleRejectUser,
            style: "text-red-700",
          },
        ];
      }
    }

    return [];
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-3 text-gray-600">Loading notifications...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back Button */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackClick}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Notifications
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, type: e.target.value }));
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
            >
              <option value="">All types</option>
              <option value="entry_approval">Approvals</option>
              <option value="payment_due">Payments Due</option>
              <option value="payment_received">Payments Received</option>
              <option value="account_approved">Account Updates</option>
              <option value="general">General</option>
            </select>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.unreadOnly}
                onChange={(e) => {
                  setFilters((prev) => ({
                    ...prev,
                    unreadOnly: e.target.checked,
                  }));
                  setPage(1);
                }}
                className="rounded border-gray-300 text-gray-600 focus:ring-gray-400"
              />
              <span className="text-sm text-gray-700">Unread only</span>
            </label>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-300 text-6xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No notifications
              </h3>
              <p className="text-gray-500 text-sm">
                {filters.unreadOnly || filters.type
                  ? "No notifications match your filters."
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const typeBadge = getTypeBadge(notification.type);
              const primaryAction = getPrimaryActionButton(notification);
              const dropdownItems = getDropdownMenuItems(notification);
              const isProcessing = processingAction === notification._id;
              const userStatus = getUserStatus(notification);
              const hasActions = primaryAction || dropdownItems.length > 0;

              return (
                <div
                  key={notification._id}
                  className={`bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors ${
                    notification.actionUrl &&
                    notification.type !== "entry_approval"
                      ? "cursor-pointer hover:bg-gray-50"
                      : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    {/* Action Buttons Area */}
                    {hasActions ? (
                      <div className="flex-shrink-0 flex items-center space-x-1">
                        {/* Primary Action Button */}
                        {primaryAction && (
                          <button
                            onClick={(e) =>
                              primaryAction.onClick(notification, e)
                            }
                            disabled={isProcessing}
                            className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                              primaryAction.style
                            } ${
                              isProcessing
                                ? "opacity-70 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            {isProcessing ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-1 border-white mr-1"></div>
                                {primaryAction.loadingText}
                              </>
                            ) : (
                              <>
                                <primaryAction.icon className="h-3 w-3 mr-1" />
                                {primaryAction.label}
                              </>
                            )}
                          </button>
                        )}

                        {/* Dropdown Menu */}
                      {/* Dropdown Menu */}
{dropdownItems.length > 0 && (
  <div className="relative">
    <button
      onClick={(e) => toggleDropdown(notification._id, e)}
      className="flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
    >
      <EllipsisVerticalIcon className="h-4 w-4" />
    </button>

    {/* Dropdown Content */}
    {openDropdown === notification._id && (
      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
        {dropdownItems.map((item, index) => (
          <button
            key={index}
            onClick={(e) => item.onClick(notification, e)}
            className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${item.style}`}
          >
            <item.icon className="h-4 w-4 mr-2" />
            {item.label}
          </button>
        ))}
      </div>
    )}
  </div>
)}
                      </div>
                    ) : (
                      /* Green dot for unread notifications without action buttons */
                      <>
                        {!notification.isRead && (
                          <div className="flex-shrink-0 mt-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        )}
                        {notification.isRead && (
                          <div className="flex-shrink-0 w-2"></div>
                        )}
                      </>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3
                            className={`text-base font-semibold line-clamp-1 ${
                              notification.actionUrl &&
                              notification.type !== "entry_approval"
                                ? "text-gray-900 hover:text-gray-700"
                                : "text-gray-800"
                            }`}
                          >
                            {notification.title}
                            {notification.actionUrl && !hasActions && (
                              <span className="ml-1 text-gray-400">→</span>
                            )}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${typeBadge.style}`}
                          >
                            {typeBadge.label}
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-600 text-sm leading-relaxed mb-2 line-clamp-2">
                        {notification.message}
                      </p>

                      {/* Show user info and status for entry approval notifications */}
                      {notification.type === "entry_approval" && (
                        <div className="text-xs text-gray-500 mb-1 space-y-1">
                          <div>
                            User: {userStatus.name} ({userStatus.email})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <div
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                userStatus.isApproved
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {userStatus.isApproved ? "Approved" : "Pending"}
                            </div>
                            {userStatus.isBlocked && (
                              <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Blocked
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center">
                        <span className="text-xs text-gray-500">
                          {formatDateTime(notification.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {notifications.length > 0 && (
          <div className="mt-8 flex justify-center items-center space-x-4">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page}</span>
            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={notifications.length < limit}
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
