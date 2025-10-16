import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  FaSearch,
  FaComments,
  FaSync,
  FaCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { useAppContext } from "../../../context/AppContext";
import { useSocket } from "../../../context/SocketContext";
import useMessageService from "../../../services/messageService";

const ChatList = ({ onChatSelect, activeChatId }) => {
  const { user, isMobile } = useAppContext();
  const { socket, isConnected } = useSocket();
  const messageService = useMessageService();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State variables
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [filter, setFilter] = useState("all");
  const [typingUsers, setTypingUsers] = useState(new Set());

  // Refs
  const typingTimeoutRef = useRef(null);

  // 🔹 Socket connection debug
  useEffect(() => {
    console.log("🔌 ChatList Socket Status:", {
      hasSocket: !!socket,
      isConnected,
      socketId: socket?.id,
      user: user?._id,
    });
  }, [socket, isConnected, user]);

  // 🔹 Set user as online when socket connects or when component mounts
  useEffect(() => {
    if (socket && isConnected && user?._id) {
      console.log("🟢 ChatList: Setting current user as online");
      socket.emit('user-online', { 
        userId: user._id,
        socketId: socket.id 
      });
    } else {
      console.log("❌ ChatList: Socket not ready", {
        hasSocket: !!socket,
        isConnected,
        user: user?._id
      });
    }
  }, [socket, isConnected, user]);

  // 🔹 Retry sending online status when socket connection state changes
  useEffect(() => {
    if (isConnected && user?._id) {
      console.log("🟢 Socket connected, setting user online");
      // Small delay to ensure socket is fully ready
      const timer = setTimeout(() => {
        if (socket && isConnected) {
          socket.emit('user-online', { 
            userId: user._id,
            socketId: socket.id 
          });
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, user, socket]);

  // 🔹 Enhanced typing indicator handler
  const handleTypingIndicator = useCallback((data) => {
    try {
      console.log("⌨️ Typing indicator received:", data);
      
      const { chatId, isTyping, userId } = data;
      
      // Don't show typing indicator for current user's own typing
      if (userId === user?._id) return;
      
      setTypingUsers(prev => {
        const newTypingUsers = new Set(prev);
        
        if (isTyping) {
          newTypingUsers.add(userId);
        } else {
          newTypingUsers.delete(userId);
        }
        
        return newTypingUsers;
      });

      // Auto-remove typing indicator after 3 seconds
      if (isTyping) {
        if (window.typingTimeouts && window.typingTimeouts[userId]) {
          clearTimeout(window.typingTimeouts[userId]);
        }
        
        window.typingTimeouts = window.typingTimeouts || {};
        window.typingTimeouts[userId] = setTimeout(() => {
          setTypingUsers(prev => {
            const newTypingUsers = new Set(prev);
            newTypingUsers.delete(userId);
            return newTypingUsers;
          });
          delete window.typingTimeouts[userId];
        }, 3000);
      }
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  }, [user]);

  // 🔹 Socket-only typing indicator sender
  const sendTypingIndicator = useCallback((isTyping, targetChat) => {
    if (!socket || !isConnected || !targetChat) return;

    const chatId = targetChat.type === 'individual' ? targetChat.user?._id : targetChat.eventId;
    const chatType = targetChat.type;

    const typingData = {
      chatId: chatId,
      type: chatType,
      isTyping: isTyping,
      userId: user?._id
    };

    console.log(`⌨️ Sending typing: ${isTyping ? 'start' : 'stop'} in ${chatType} chat`);
    
    // Socket only - no HTTP API call
    socket.emit('typing', typingData);
  }, [socket, isConnected, user]);

  // 🔹 Real-time message handler
  const handleNewMessageCallback = useCallback((newMessage) => {
    console.log("📨 New message received:", newMessage);

    setConversations((prev) => {
      if (!Array.isArray(prev)) return prev;

      const senderId = newMessage.sender?._id || newMessage.sender;
      const recipientId = newMessage.recipient?._id || newMessage.recipient;
      const eventId = newMessage.eventId;
      const isFromCurrentUser = senderId === user?._id;

      // Find existing conversation
      const existingConvIndex = prev.findIndex((chat) => {
        if (eventId && chat.type === "event") {
          return chat.eventId === eventId;
        }
        if (chat.type === "individual" && chat.user?._id) {
          return chat.user._id === senderId || chat.user._id === recipientId;
        }
        return false;
      });

      let updatedConversations = [...prev];

      if (existingConvIndex !== -1) {
        // Update existing conversation
        const existingChat = updatedConversations[existingConvIndex];
        const isIncomingMessage = !isFromCurrentUser;

        updatedConversations[existingConvIndex] = {
          ...existingChat,
          lastMessage: newMessage,
          lastMessageAt: newMessage.createdAt || new Date().toISOString(),
          unreadCount: isIncomingMessage
            ? (existingChat.unreadCount || 0) + 1
            : existingChat.unreadCount,
        };

        // Move to top of list
        if (existingConvIndex > 0) {
          const [movedChat] = updatedConversations.splice(existingConvIndex, 1);
          updatedConversations.unshift(movedChat);
        }
      } else {
        // Create new conversation for incoming messages
        if (!isFromCurrentUser) {
          const newChat = {
            _id: `temp-${Date.now()}`,
            type: eventId ? "event" : "individual",
            user: eventId ? null : (newMessage.sender || newMessage.senderDetails),
            eventId: eventId,
            name: eventId ? "New Event Chat" : (newMessage.sender?.name || "Unknown User"),
            lastMessage: newMessage,
            lastMessageAt: newMessage.createdAt || new Date().toISOString(),
            unreadCount: 1,
            isNewChat: true,
            participantsCount: eventId ? 1 : undefined,
          };
          updatedConversations.unshift(newChat);
        }
      }

      return updatedConversations;
    });
  }, [user]);

  // 🔹 Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("🔌 Setting up socket listeners");

    // In ChatList - Update the socket listeners
    const handleUserOnline = (data) => {
      console.log("🟢 FRONTEND: User online event received:", data);
      setOnlineUsers(prev => {
        const newSet = new Set([...prev, data.userId]);
        console.log("🟢 Online users updated:", Array.from(newSet));
        return newSet;
      });
    };

    const handleUserOffline = (data) => {
      console.log("🔴 FRONTEND: User offline event received:", data);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        console.log("🔴 Online users updated:", Array.from(newSet));
        return newSet;
      });
    };

    // Register socket listeners
    socket.on("newMessage", handleNewMessageCallback);
    socket.on("typing", handleTypingIndicator);
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);

    return () => {
      socket.off("newMessage", handleNewMessageCallback);
      socket.off("typing", handleTypingIndicator);
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
    };
  }, [socket, isConnected, handleNewMessageCallback, handleTypingIndicator]);

  // 🔹 Fetch conversations only (no online users HTTP call)
  const fetchInitialData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      console.log("🔄 Fetching conversations");
      const convRes = await messageService.getConversations();

      if (convRes?.success === false) {
        if (convRes.message?.includes("denied") || convRes.message?.includes("permission")) {
          setError("You don't have permission to access messages");
          return;
        }
        setError(convRes.message || "Failed to load conversations");
        return;
      }

      let conversationsData = [];
      
      // Handle different response formats
      if (convRes?.success && Array.isArray(convRes.data)) {
        conversationsData = convRes.data;
      } else if (Array.isArray(convRes)) {
        conversationsData = convRes;
      } else if (convRes?.data && Array.isArray(convRes.data)) {
        conversationsData = convRes.data;
      }

      // Process conversations
      const processedConversations = conversationsData
        .map((conv) => {
          if (conv.type === "individual" && conv.user) {
            return {
              ...conv,
              user: conv.user,
              lastMessage: conv.lastMessage || {
                body: conv.lastMessageText || "",
                type: conv.lastMessageType || "text",
                createdAt: conv.lastMessageAt,
                status: "sent",
              },
              lastMessageAt: conv.lastMessageAt || conv.lastMessage?.createdAt,
              unreadCount: conv.unreadCount || 0,
              isNewChat: false,
            };
          }
          
          if (conv.type === "event") {
            return {
              ...conv,
              name: conv.name || "Event Group",
              lastMessage: conv.lastMessage || {
                body: conv.lastMessageText || "",
                type: conv.lastMessageType || "text",
                createdAt: conv.lastMessageAt,
                status: "sent",
              },
              lastMessageAt: conv.lastMessageAt || conv.lastMessage?.createdAt,
              unreadCount: conv.unreadCount || 0,
              isNewChat: false,
            };
          }
          
          return conv;
        })
        .filter((conv) => conv !== null);

      setConversations(processedConversations);

    } catch (err) {
      console.error("❌ Error fetching conversations:", err);
      if (err.response?.status === 403) {
        setError("Access denied. You don't have permission to view messages.");
      } else if (err.response?.status === 401) {
        setError("Please login again to access messages.");
      } else {
        setError("Failed to load conversations. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [user, messageService]);

  // 🔹 Initial data loading
  useEffect(() => {
    fetchInitialData();
  }, []);

  // 🔹 Manual refresh
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchInitialData();
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchInitialData]);

  // 🔹 Helper functions
  const formatLastMessage = (chat) => {
    const userId = chat.user?._id;
    if (userId && typingUsers.has(userId)) {
      return "typing...";
    }
    
    const message = chat.lastMessage;
    if (!message && chat.lastMessageText) {
      const text = chat.lastMessageText || "";
      return text.length > 35 ? text.substring(0, 35) + "..." : text;
    }
    if (!message) return "No messages yet";
    
    if (message.type === "image") return "📷 Photo";
    if (message.type === "audio") return "🎤 Audio message";
    if (message.type === "video") return "🎥 Video";
    if (message.type === "document") return "📄 Document";
    if (message.type === "multiple") return "📎 Multiple files";
    
    const text = message.body || "";
    return text.length > 35 ? text.substring(0, 35) + "..." : text;
  };

  const getChatDisplayName = (chat) => {
    if (chat.type === "individual" && chat.user) {
      return chat.user.name || chat.user.email || "Unknown User";
    }
    if (chat.type === "event") {
      return chat.name || "Event Group";
    }
    return "Unknown Chat";
  };

  const isUserOnline = (userId) => onlineUsers.has(userId?.toString());
  const isUserTyping = (userId) => typingUsers.has(userId?.toString());

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (days === 1) {
        return "Yesterday";
      } else if (days < 7) {
        return date.toLocaleDateString([], { weekday: "short" });
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    } catch (error) {
      return "";
    }
  };

const handleSelectChat = useCallback((chat) => {
  // Mark as read optimistically
  if (chat.unreadCount > 0) {
    setConversations((prev) =>
      prev.map((c) => {
        const isSameChat =
          (c._id && c._id === chat._id) ||
          (c.type === chat.type &&
            ((c.type === "individual" && c.user?._id === chat.user?._id) ||
              (c.type === "event" && c.eventId === chat.eventId)));
        return isSameChat ? { ...c, unreadCount: 0 } : c;
      })
    );

    // Call API to mark as read
    if (chat.type === "individual" && chat.user?._id) {
      messageService.markAsRead(chat.user._id, "individual").catch(console.error);
    } else if (chat.type === "event" && chat.eventId) {
      messageService.markAsRead(chat.eventId, "event").catch(console.error);
    }
  }

  // Call the onChatSelect prop if provided
  if (onChatSelect) {
    onChatSelect(chat);
  }
  
  // ✅ UPDATED: Always navigate to /messages/chat/:chatId for both mobile and desktop
  // The ChatsPage component will handle showing/hiding based on screen size
  navigate(
    `/messages/chat/${chat.type === "individual" ? chat.user?._id : chat.eventId}`,
    { state: { chat } }
  );
}, [navigate, messageService, onChatSelect]); // ✅ Removed isMobile dependency
  // 🔹 Clean up on unmount
  useEffect(() => {
    return () => {
      if (window.typingTimeouts) {
        Object.values(window.typingTimeouts).forEach((timeout) => {
          clearTimeout(timeout);
        });
        window.typingTimeouts = {};
      }
    };
  }, []);

  // 🔹 Filtered chats
  const filteredChats = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = conversations;

    if (q) {
      filtered = filtered.filter((chat) => {
        const displayName = getChatDisplayName(chat).toLowerCase();
        const lastMessage = formatLastMessage(chat).toLowerCase();
        return displayName.includes(q) || lastMessage.includes(q);
      });
    }

    if (filter === "unread") {
      filtered = filtered.filter((chat) => chat.unreadCount > 0);
    } else if (filter === "online") {
      filtered = filtered.filter(
        (chat) => chat.type === "individual" && isUserOnline(chat.user?._id)
      );
    } else if (filter === "groups") {
      filtered = filtered.filter((chat) => chat.type === "event");
    }

    return filtered;
  }, [search, conversations, filter, typingUsers]);

  // 🔹 Check if a chat is currently active
  const isChatActive = (chat) => {
    if (!activeChatId) return false;
    
    if (chat.type === "individual") {
      return chat.user?._id === activeChatId;
    } else if (chat.type === "event") {
      return chat.eventId === activeChatId;
    }
    return false;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 rounded-t-lg">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
            Messages
          </h1>
          <div className="flex items-center space-x-2">
            <div className={clsx(
              "flex items-center space-x-1 text-xs",
              isConnected ? "text-green-500" : "text-red-500"
            )}>
              <FaCircle size={8} />
              <span>{isConnected ? "Live" : "Offline"}</span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-blue-500">
              <FaCircle size={8} />
              <span>{Array.from(onlineUsers).length} online</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <FaSync className={loading ? "animate-spin" : ""} size={16} />
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex space-x-2 mb-3 overflow-x-auto pb-1">
          {["all", "unread", "online", "groups"].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors capitalize",
                filter === filterOption
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
              )}
            >
              {filterOption}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
          />
        </div>
      </div>

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-20 text-gray-500 dark:text-gray-400">
            <div className="text-sm">Loading conversations...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4 text-center">
            <FaComments size={48} className="mb-3 opacity-50" />
            <div className="text-lg mb-2 dark:text-gray-400">Unable to load messages</div>
            <div className="text-sm mb-4 dark:text-gray-500 text-center">{error}</div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center space-x-2 transition-colors"
            >
              <FaSync size={14} />
              <span>Try Again</span>
            </button>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4 text-center">
            {search ? (
              <>
                <FaSearch size={48} className="mb-3 opacity-50" />
                <div className="text-lg mb-2 dark:text-gray-400">No conversations found</div>
                <div className="text-sm dark:text-gray-500">Try adjusting your search terms</div>
              </>
            ) : (
              <>
                <FaComments size={48} className="mb-3 opacity-50" />
                <div className="text-lg mb-2 dark:text-gray-400">No conversations yet</div>
                <div className="text-sm dark:text-gray-500">Start a conversation to see it here</div>
              </>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.type === "individual" ? `user-${chat.user?._id}` : `event-${chat.eventId}`}
              onClick={() => handleSelectChat(chat)}
              className={clsx(
                "flex items-center p-3 border-b border-gray-100 dark:border-gray-700 transition-colors cursor-pointer group",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                chat.unreadCount > 0 && "bg-blue-50 dark:bg-blue-900/20",
                isChatActive(chat) && "bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500"
              )}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={chat.type === "individual" ? (chat.user?.avatar || "/default-avatar.png") : "/group-avatar.png"}
                  alt={getChatDisplayName(chat)}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                />
                {chat.type === "individual" && isUserOnline(chat.user?._id) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                )}
                {chat.type === "individual" && isUserTyping(chat.user?._id) && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse flex items-center justify-center">
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 ml-3">
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-gray-800 dark:text-white truncate text-sm">
                    {getChatDisplayName(chat)}
                    {chat.type === "event" && chat.participantsCount && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({chat.participantsCount})</span>
                    )}
                  </div>
                  {chat.lastMessageAt && !isUserTyping(chat.user?._id) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                      {formatTime(chat.lastMessageAt)}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-1">
                  <div className={clsx(
                    "text-sm truncate flex-1",
                    chat.unreadCount > 0 && !isUserTyping(chat.user?._id)
                      ? "text-gray-800 dark:text-white font-medium"
                      : "text-gray-600 dark:text-gray-400",
                    isUserTyping(chat.user?._id) && "text-blue-500 italic"
                  )}>
                    {formatLastMessage(chat)}
                  </div>

                  <div className="flex items-center space-x-1 ml-2">
                    {chat.unreadCount > 0 && !isUserTyping(chat.user?._id) && (
                      <span className="bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 font-medium">
                        {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                      </span>
                    )}
                    {isUserTyping(chat.user?._id) && (
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>{filteredChats.length} {filteredChats.length === 1 ? "conversation" : "conversations"}</span>
          <div className="flex items-center space-x-1">
            <FaCircle size={8} className="text-green-500" />
            <span>{Array.from(onlineUsers).length} online</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatList;