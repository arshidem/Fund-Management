import React, { useEffect, useState, useRef, useMemo } from "react";
import { 
  FaPaperPlane, FaSmile, FaPlus, FaSearch, FaComments, 
  FaUsers, FaImage, FaFile, FaMicrophone, FaVideo,
  FaReply, FaStar, FaTrash, FaEllipsisV, FaPhone,
  FaVideo as FaVideoCall, FaInfoCircle, FaPaperclip,
  FaRegStar, FaRegSmile, FaTimes, FaDownload, FaCircle,
  FaExclamationTriangle, FaSync, FaArrowLeft, FaBars
} from "react-icons/fa";
import { io as ioClient } from "socket.io-client";
import clsx from "clsx";
import { useAppContext } from "../../context/AppContext";
import useMessageService from "../../services/messageService";
import useAdminService from "../../services/adminService";

const UserMessage = () => {
  const { backendUrl, token, user } = useAppContext();
  const messageService = useMessageService();
  const adminService = useAdminService();

  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [search, setSearch] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState("chats");
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showChatWindow, setShowChatWindow] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 🔹 Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // 🔹 Fetch conversations (WhatsApp-like chat list)
  const fetchConversations = async () => {
    setLoadingConversations(true);
    setError(null);
    try {
      console.log("🔄 Fetching conversations...");
      const res = await messageService.getConversations();
      console.log("✅ Conversations API Response:", res);

      let conversationsData = [];
      if (res?.success) {
        conversationsData = Array.isArray(res.data) ? res.data : (res.data || []);
      } else if (Array.isArray(res)) {
        conversationsData = res;
      } else if (res?.conversations) {
        conversationsData = res.conversations;
      } else if (res?.data?.data && Array.isArray(res.data.data)) {
        conversationsData = res.data.data;
      }

      console.log("📱 Normalized conversations:", conversationsData);

      if (conversationsData && conversationsData.length > 0) {
        setConversations(conversationsData);
        setActiveTab('chats');
        setUsers([]);
      } else {
        setConversations([]);
        await fetchUsers();
        setActiveTab('contacts');
      }
    } catch (err) {
      console.error("❌ Error fetching conversations:", err);
      setError("Failed to load conversations. Please try again.");
      try {
        await fetchUsers();
        setActiveTab('contacts');
      } catch (e) { console.error('fallback users fetch failed', e); }
    } finally {
      setLoadingConversations(false);
    }
  };

  // 🔹 Fetch all users (for contacts tab)
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await adminService.getAllUsers({ page: 1, limit: 100 });
      const usersList = res?.data?.data || res?.data || [];
      setUsers(usersList.filter((u) => u._id !== user?._id));
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load contacts.");
    } finally {
      setLoadingUsers(false);
    }
  };

  // 🔹 Initial data loading
  useEffect(() => {
    fetchConversations();
  }, []);

  // 🔹 Fetch users when contacts tab is active
  useEffect(() => {
    if (activeTab === "contacts") {
      fetchUsers();
    }
  }, [activeTab]);

  // 🔹 Socket connection and real-time features
  useEffect(() => {
    if (!backendUrl || !token) return;

    console.log("🔌 Connecting to socket...");
    const s = ioClient(backendUrl, {
      transports: ["websocket"],
      auth: { token },
    });
    setSocket(s);

    // Real-time event handlers
    s.on("connect", () => {
      console.log("✅ Socket connected");
      s.emit('user-online', { socketId: s.id });
    });

    s.on("newMessage", (msg) => {
      console.log("📨 New message received:", msg);
      handleNewMessage(msg);
    });

    s.on("messageStatus", (data) => {
      console.log("📊 Message status update:", data);
      updateMessageStatus(data.messageId, data.status);
    });

    s.on("userTyping", (data) => {
      console.log("⌨️ Typing indicator:", data);
      handleTypingIndicator(data);
    });

    s.on("userOnline", (data) => {
      console.log("🟢 User online:", data);
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    });

    s.on("userOffline", (data) => {
      console.log("🔴 User offline:", data);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });

    s.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    s.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      setError("Connection error. Please refresh the page.");
    });

    return () => {
      console.log("🧹 Cleaning up socket connection");
      s.disconnect();
    };
  }, [backendUrl, token]);

  // 🔹 Handle new incoming messages
  const handleNewMessage = (newMsg) => {
    if (activeChat && shouldAddToActiveChat(newMsg)) {
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    }

    updateConversationsWithNewMessage(newMsg);
  };

  const shouldAddToActiveChat = (msg) => {
    if (activeChat.type === 'individual') {
      return msg.sender?._id === activeChat.user?._id || 
             msg.recipient === activeChat.user?._id;
    } else {
      return msg.eventId === activeChat.eventId;
    }
  };

  // 🔹 Update conversations list with new message
  const updateConversationsWithNewMessage = (newMsg) => {
    setConversations(prev => {
      const updated = [...prev];
      const conversationIndex = updated.findIndex(conv => 
        conv.type === 'individual' 
          ? conv.user?._id === newMsg.sender?._id || conv.user?._id === newMsg.recipient
          : conv.eventId === newMsg.eventId
      );

      if (conversationIndex !== -1) {
        const updatedConv = {
          ...updated[conversationIndex],
          lastMessage: {
            body: newMsg.body,
            type: newMsg.type,
            createdAt: newMsg.createdAt
          },
          lastMessageAt: newMsg.createdAt,
          unreadCount: newMsg.recipient === user?._id && !activeChat
            ? (updated[conversationIndex].unreadCount || 0) + 1 
            : updated[conversationIndex].unreadCount
        };
        
        updated.splice(conversationIndex, 1);
        return [updatedConv, ...updated];
      }
      return prev;
    });
  };

  // 🔹 Handle typing indicators
  const handleTypingIndicator = (data) => {
    setTypingUsers(prev => ({
      ...prev,
      [data.userId]: data.isTyping
    }));

    if (!data.isTyping) {
      setTimeout(() => {
        setTypingUsers(prev => ({
          ...prev,
          [data.userId]: false
        }));
      }, 3000);
    }
  };

  // 🔹 Update message status
  const updateMessageStatus = (messageId, status) => {
    setMessages(prev => prev.map(msg => 
      msg._id === messageId ? { ...msg, status } : msg
    ));
  };

  // 🔹 Scroll to bottom when new message
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // 🔹 Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // 🔹 Open chat and fetch conversation history
  const openChat = async (chat) => {
    console.log('openChat called, chat:', chat);
    const targetId = chat.type === 'individual' ? chat.user?._id : chat.eventId;
    console.log('→ requesting history for:', targetId, 'type:', chat.type);
    
    setActiveChat(chat);
    setLoadingMessages(true);
    setMessages([]);
    setError(null);
    
    if (isMobile) {
      setShowChatWindow(true);
    }
    
    try {
      let res;
      if (chat.type === 'individual') {
        res = await messageService.getChatHistory(chat.user._id, "individual");
      } else if (chat.type === 'event') {
        res = await messageService.getChatHistory(chat.eventId, "event");
      }
      
      console.log("📜 Chat history response:", res);
      const messagesData = res?.data?.messages || [];
      setMessages(messagesData);

      if (chat.unreadCount > 0) {
        setConversations(prev => prev.map(conv => 
          (conv.type === 'individual' && conv.user?._id === chat.user?._id) || 
          (conv.type === 'event' && conv.eventId === chat.eventId)
            ? { ...conv, unreadCount: 0 }
            : conv
        ));
      }
    } catch (err) {
      console.error("❌ Failed to load messages:", err);
      setError("Failed to load messages. Please try again.");
    } finally {
      setLoadingMessages(false);
    }
  };

  // 🔹 Start new chat with user
  const startNewChat = async (userContact) => {
    console.log("🆕 Starting new chat with:", userContact);
    const newChat = {
      type: 'individual',
      user: userContact,
      lastMessage: null,
      lastMessageAt: new Date(),
      unreadCount: 0
    };
    
    setActiveChat(newChat);
    setMessages([]);
    
    if (isMobile) {
      setShowChatWindow(true);
    }
    
    setConversations(prev => {
      const exists = prev.some(conv => 
        conv.type === 'individual' && conv.user?._id === userContact._id
      );
      if (!exists) {
        return [newChat, ...prev];
      }
      return prev;
    });
  };

  // 🔹 Close chat window (mobile only)
  const closeChatWindow = () => {
    setShowChatWindow(false);
    setActiveChat(null);
    setMessages([]);
  };

  // 🔹 Send text message
  const sendTextMessage = async () => {
    const text = newMessage.trim();
    if (!text || !activeChat) return;
    
    try {
      const payload = {
        body: text,
        type: "text",
      };

      if (activeChat.type === 'individual') {
        payload.recipientId = activeChat.user._id;
      } else if (activeChat.type === 'event') {
        payload.eventId = activeChat.eventId;
      }
      
      console.log("📤 Sending message:", payload);
      const res = await messageService.sendMessage(payload);
      
      const newMessageObj = res.data;
      setMessages((prev) => [...prev, newMessageObj]);
      setNewMessage("");
      
      updateConversationsWithNewMessage(newMessageObj);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } catch (err) {
      console.error("❌ Send message error:", err);
      setError("Failed to send message. Please try again.");
    }
  };

  // 🔹 Handle input key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  // 🔹 Filter conversations and users based on search
  const filteredConversations = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter(conv => 
      conv.type === 'individual'
        ? conv.user?.name?.toLowerCase().includes(q) || conv.user?.email?.toLowerCase().includes(q)
        : conv.name?.toLowerCase().includes(q)
    );
  }, [search, conversations]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => 
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [search, users]);

  // 🔹 Format last message preview
  const formatLastMessage = (conversation) => {
    if (!conversation.lastMessage && !conversation.lastMessageText) {
      return "No messages yet";
    }
    
    const message = conversation.lastMessage || { 
      body: conversation.lastMessageText,
      type: conversation.lastMessageType 
    };
    
    if (message.type === 'image') return '📷 Photo';
    if (message.type === 'audio') return '🎤 Audio message';
    if (message.type === 'video') return '🎥 Video';
    if (message.type === 'document') return '📄 Document';
    
    const text = message.body || '';
    return text.length > 30 ? text.substring(0, 30) + '...' : text;
  };

  // 🔹 Format time for conversation list
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      return '';
    }
  };

  // 🔹 Check if user is online
  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  // 🔹 Render conversations/contacts list
  const renderConversationsList = () => (
    <div className={clsx(
      "bg-white rounded-lg shadow-sm flex flex-col h-full",
      isMobile ? "w-full" : "w-80 border-r border-gray-200"
    )}>
      {/* Header with tabs */}
      <div className="p-4 border-b bg-white flex-shrink-0">
        {isMobile && showChatWindow ? (
          <div className="flex items-center">
            <button
              onClick={closeChatWindow}
              className="p-2 text-gray-600 hover:text-gray-800 mr-2"
            >
              <FaArrowLeft size={16} />
            </button>
            <div className="flex-1 text-center font-semibold text-gray-800">
              {activeChat?.type === 'individual' ? activeChat.user?.name : activeChat?.name}
            </div>
          </div>
        ) : (
          <>
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setActiveTab("chats")}
                className={clsx(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                  activeTab === "chats"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Chats
              </button>
              <button
                onClick={() => setActiveTab("contacts")}
                className={clsx(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                  activeTab === "contacts"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Contacts
              </button>
            </div>
            
            {/* Search bar */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" size={14} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeTab === 'chats' ? 'chats' : 'contacts'}...`}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            {/* Debug counts */}
            <div className="text-xs text-gray-500 mt-2">
              Conversations: <strong>{conversations.length}</strong> • Contacts: <strong>{users.length}</strong>
            </div>
          </>
        )}
      </div>

      {/* Conversations/Contacts list */}
      <div className="flex-1 overflow-y-auto">
        {!isMobile || !showChatWindow ? (
          activeTab === "chats" ? (
            // Conversations Tab
            loadingConversations ? (
              <div className="flex justify-center items-center h-20">
                <div className="text-gray-500 text-sm">Loading conversations...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center">
                <FaComments size={48} className="mb-3 opacity-50" />
                <div className="text-lg mb-2">No conversations</div>
                <div className="text-sm mb-4">Start a new conversation from the Contacts tab</div>
                <button 
                  onClick={fetchConversations}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm flex items-center space-x-2"
                >
                  <FaSync size={14} />
                  <span>Refresh</span>
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.type === 'individual' ? `user-${conv.user?._id}` : `event-${conv.eventId}`}
                  onClick={() => openChat(conv)}
                  className={clsx(
                    "flex items-center p-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50",
                    activeChat?.user?._id === conv.user?._id && activeChat?.type === conv.type
                      ? "bg-blue-50 border-l-4 border-l-blue-500"
                      : ""
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={conv.type === 'individual' 
                        ? conv.user?.avatar || "/default-avatar.png"
                        : "/group-avatar.png"
                      }
                      alt={conv.type === 'individual' ? conv.user?.name : conv.name}
                      className="w-12 h-12 rounded-full object-cover border border-gray-200"
                    />
                    {conv.type === 'individual' && isUserOnline(conv.user?._id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 ml-3">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-gray-800 truncate text-sm">
                        {conv.type === 'individual' ? conv.user?.name : conv.name}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {formatTime(conv.lastMessageAt || conv.lastMessage?.createdAt)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-sm text-gray-600 truncate flex-1">
                        {formatLastMessage(conv)}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 ml-2">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            // Contacts Tab
            loadingUsers ? (
              <div className="flex justify-center items-center h-20">
                <div className="text-gray-500 text-sm">Loading contacts...</div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center">
                <FaUsers size={48} className="mb-3 opacity-50" />
                <div className="text-lg mb-2">No contacts found</div>
                <div className="text-sm">Try adjusting your search</div>
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u._id}
                  onClick={() => startNewChat(u)}
                  className="flex items-center p-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <div className="relative">
                    <img
                      src={u.avatar || "/default-avatar.png"}
                      alt={u.name}
                      className="w-12 h-12 rounded-full object-cover border border-gray-200"
                    />
                    {isUserOnline(u._id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 ml-3">
                    <div className="font-semibold text-gray-800 truncate text-sm">{u.name}</div>
                    <div className="text-sm text-gray-600 truncate">{u.email}</div>
                  </div>
                </div>
              ))
            )
          )
        ) : null}
      </div>
    </div>
  );

  // 🔹 Render chat window
  const renderChatWindow = () => (
    <div className={clsx(
      "flex-1 flex flex-col bg-white rounded-lg shadow-sm h-full",
      isMobile && !showChatWindow && "hidden"
    )}>
      {activeChat ? (
        <>
          {/* Fixed Chat Header */}
          <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
            <div className="flex items-center space-x-3">
              {isMobile && (
                <button
                  onClick={closeChatWindow}
                  className="p-2 text-gray-600 hover:text-gray-800"
                >
                  <FaArrowLeft size={16} />
                </button>
              )}
              <div className="relative">
                <img
                  src={activeChat.type === 'individual' 
                    ? activeChat.user?.avatar || "/default-avatar.png"
                    : "/group-avatar.png"
                  }
                  alt={activeChat.type === 'individual' ? activeChat.user?.name : activeChat.name}
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                />
                {activeChat.type === 'individual' && isUserOnline(activeChat.user?._id) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-800">
                  {activeChat.type === 'individual' ? activeChat.user?.name : activeChat.name}
                </div>
                <div className="text-sm text-gray-500">
                  {activeChat.type === 'individual' 
                    ? (isUserOnline(activeChat.user?._id) ? "Online" : "Offline")
                    : `${activeChat.participantsCount} participants`
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Messages Area - Takes remaining space */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto bg-gray-50 relative"
          >
            <div className="absolute inset-0 p-4">
              {loadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-gray-500 text-sm">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FaComments size={64} className="mb-4 opacity-30" />
                  <div className="text-lg mb-2">No messages yet</div>
                  <div className="text-sm text-center">
                    Start a conversation with {activeChat.type === 'individual' ? activeChat.user?.name : 'the group'} 👋
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, idx) => {
                    const mine = m.sender?._id === user?._id;
                    return (
                      <div 
                        key={m._id || idx} 
                        className={clsx("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={clsx(
                            "max-w-[70%] p-3 rounded-2xl",
                            mine 
                              ? "bg-blue-500 text-white rounded-br-none" 
                              : "bg-white text-gray-900 rounded-bl-none shadow-sm"
                          )}
                        >
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {m.body}
                          </div>
                          <div 
                            className={clsx(
                              "text-xs mt-1 text-right",
                              mine ? "text-blue-100" : "text-gray-500"
                            )}
                          >
                            {new Date(m.createdAt || m.sentAt).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Fixed Message Input at Bottom */}
          <div className="border-t bg-white p-4 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                <FaPlus size={16} />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                <FaSmile size={16} />
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  className="w-full border border-gray-300 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <button
                onClick={sendTextMessage}
                disabled={!newMessage.trim()}
                className={clsx(
                  "p-3 rounded-full transition-colors",
                  newMessage.trim()
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                <FaPaperPlane size={14} />
              </button>
            </div>
          </div>
        </>
      ) : (
        // Empty State - Centered
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <FaComments size={64} className="mx-auto mb-4 opacity-30" />
            <div className="text-xl mb-2">💬</div>
            <div className="text-lg mb-1 font-medium">
              {activeTab === 'chats' ? 'Select a conversation' : 'Select a contact'} to start chatting
            </div>
            <div className="text-sm">Your messages will appear here</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full bg-gray-100 p-4">
      {/* Error Display */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <FaExclamationTriangle />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      <div className={clsx(
        "h-full bg-white rounded-lg shadow-sm",
        isMobile ? "relative overflow-hidden" : "flex"
      )}>
        {/* Mobile: Show either list or chat */}
        {isMobile ? (
          <>
            {!showChatWindow && renderConversationsList()}
            {showChatWindow && renderChatWindow()}
          </>
        ) : (
          /* Desktop: Show both side by side */
          <>
            {renderConversationsList()}
            {renderChatWindow()}
          </>
        )}
      </div>
    </div>
  );
};

export default UserMessage;