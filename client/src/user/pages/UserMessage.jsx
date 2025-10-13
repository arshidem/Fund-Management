import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { 
  FaPaperPlane, FaSmile, FaPlus, FaSearch, FaComments, 
  FaUsers, FaImage, FaFile, FaMicrophone, FaVideo,
  FaReply, FaStar, FaTrash, FaEllipsisV, FaPhone,
  FaVideo as FaVideoCall, FaInfoCircle, FaPaperclip,
  FaRegStar, FaRegSmile, FaTimes, FaDownload, FaCircle,
  FaExclamationTriangle, FaSync, FaArrowLeft, FaBars,
  FaHeart, FaThumbsUp, FaLaugh, FaSadTear, FaAngry,
  FaShare, FaEdit, FaRegCopy, FaCheck,
  FaRegCheckCircle, FaCheckCircle, FaRegImage,
  FaFileAudio, FaVideo as FaVideoIcon, FaFilePdf,
  FaRegFilePdf, FaRegFileWord, FaRegFileExcel,
  FaRegFilePowerpoint, FaArchive, FaMusic,
  FaPlay, FaPause, FaVolumeUp, FaExpand,
  FaRegCircle, FaCircle as FaSolidCircle
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

  // State variables
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
  
  // New feature states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [starredMessages, setStarredMessages] = useState(new Set());
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [messageActions, setMessageActions] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [pagination, setPagination] = useState({ hasMore: false, page: 1 });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioRefs = useRef({});
  const recordingIntervalRef = useRef(null);

  // Common emoji reactions
  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

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

  // 🔹 Enhanced socket connection with all features
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

    s.on("typing", (data) => {
      console.log("⌨️ Typing indicator:", data);
      handleTypingIndicator(data);
    });

    s.on("messageReaction", (data) => {
      console.log("🎭 Message reaction:", data);
      updateMessageReactions(data.messageId, data.reactions);
    });

    s.on("messageDeleted", (data) => {
      console.log("🗑️ Message deleted:", data);
      handleMessageDeleted(data);
    });

    s.on("messagesRead", (data) => {
      console.log("👀 Messages read:", data);
      handleMessagesRead(data);
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

  // 🔹 Enhanced message handling
  const handleNewMessage = (newMsg) => {
    if (activeChat && shouldAddToActiveChat(newMsg)) {
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
      
      // Mark as read if it's the active chat
      if (newMsg.sender?._id !== user?._id) {
        markMessagesAsRead([newMsg._id]);
      }
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

  // 🔹 Enhanced conversations update
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
      } else if (newMsg.sender?._id !== user?._id) {
        // New conversation
        const newConversation = {
          type: 'individual',
          user: newMsg.sender,
          lastMessage: {
            body: newMsg.body,
            type: newMsg.type,
            createdAt: newMsg.createdAt
          },
          lastMessageAt: newMsg.createdAt,
          unreadCount: 1
        };
        return [newConversation, ...updated];
      }
      return prev;
    });
  };

  // 🔹 Enhanced typing indicators
  const handleTypingIndicator = (data) => {
    const chatKey = data.type === 'individual' ? data.userId : 'group';
    setTypingUsers(prev => ({
      ...prev,
      [chatKey]: data.isTyping
    }));

    if (!data.isTyping) {
      setTimeout(() => {
        setTypingUsers(prev => ({
          ...prev,
          [chatKey]: false
        }));
      }, 3000);
    }
  };

  // 🔹 Send typing indicator
  const sendTypingIndicator = useCallback((isTyping) => {
    if (!socket || !activeChat) return;

    const data = {
      chatId: activeChat.type === 'individual' ? activeChat.user?._id : activeChat.eventId,
      type: activeChat.type,
      isTyping
    };

    socket.emit('typing', data);
    messageService.sendTypingIndicator(data.chatId, data.type, isTyping);
  }, [socket, activeChat, messageService]);

  // 🔹 Handle typing in input
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    sendTypingIndicator(true);
    
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 1000);
  };

  // 🔹 Enhanced message status updates
  const updateMessageStatus = (messageId, status) => {
    setMessages(prev => prev.map(msg => 
      msg._id === messageId ? { ...msg, status } : msg
    ));
  };

  const updateMessageReactions = (messageId, reactions) => {
    setMessages(prev => prev.map(msg => 
      msg._id === messageId ? { ...msg, reactions } : msg
    ));
  };

  const handleMessageDeleted = (data) => {
    setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
  };

  const handleMessagesRead = (data) => {
    setMessages(prev => prev.map(msg => 
      data.messageIds.includes(msg._id) 
        ? { ...msg, status: 'read', isRead: true, readAt: new Date() }
        : msg
    ));
  };

  // 🔹 Mark messages as read
  const markMessagesAsRead = async (messageIds = []) => {
    if (!activeChat) return;

    try {
      await messageService.markAsRead(
        activeChat.type === 'individual' ? activeChat.user?._id : activeChat.eventId,
        activeChat.type,
        messageIds
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // 🔹 Scroll to bottom
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

  // 🔹 Enhanced chat opening with pagination
  const openChat = async (chat, loadMore = false) => {
    console.log('openChat called, chat:', chat);
    const targetId = chat.type === 'individual' ? chat.user?._id : chat.eventId;
    
    if (!loadMore) {
      setActiveChat(chat);
      setMessages([]);
      setPagination({ hasMore: false, page: 1 });
      setShowSearchResults(false);
      
      if (isMobile) {
        setShowChatWindow(true);
      }
    }
    
    setLoadingMessages(true);
    setError(null);
    
    try {
      const page = loadMore ? pagination.page + 1 : 1;
      const res = await messageService.getChatHistory(
        targetId, 
        chat.type, 
        { page, limit: 50 }
      );
      
      console.log("📜 Chat history response:", res);
      const messagesData = res?.data?.messages || [];
      
      if (loadMore) {
        setMessages(prev => [...messagesData, ...prev]);
        setPagination(prev => ({
          ...prev,
          page,
          hasMore: res.data.pagination?.hasMore || false
        }));
      } else {
        setMessages(messagesData);
        setPagination({
          page: 1,
          hasMore: res.data.pagination?.hasMore || false
        });
      }

      // Mark as read
      if (chat.unreadCount > 0 && !loadMore) {
        setConversations(prev => prev.map(conv => 
          (conv.type === 'individual' && conv.user?._id === chat.user?._id) || 
          (conv.type === 'event' && conv.eventId === chat.eventId)
            ? { ...conv, unreadCount: 0 }
            : conv
        ));
        
        const unreadMessageIds = messagesData
          .filter(m => !m.isRead && m.sender?._id !== user?._id)
          .map(m => m._id);
        
        if (unreadMessageIds.length > 0) {
          markMessagesAsRead(unreadMessageIds);
        }
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
    setShowSearchResults(false);
    
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
    setShowSearchResults(false);
    setReplyingTo(null);
  };

  // 🔹 Enhanced message sending with all types
  const sendMessage = async (text = null, attachments = []) => {
    const messageText = text || newMessage.trim();
    if ((!messageText && attachments.length === 0) || !activeChat) return;
    
    try {
      const payload = {
        body: messageText,
        type: attachments.length > 0 ? (attachments[0].type || 'multiple') : 'text',
        attachments: attachments
      };

      if (replyingTo) {
        payload.replyTo = replyingTo._id;
      }

      if (activeChat.type === 'individual') {
        payload.recipientId = activeChat.user._id;
      } else if (activeChat.type === 'event') {
        payload.eventId = activeChat.eventId;
      }
      
      console.log("📤 Sending message:", payload);
      const res = await messageService.sendMessage(payload);
      
      const newMessageObj = res.data;
      setMessages((prev) => [...prev, newMessageObj]);
      
      if (!text) setNewMessage("");
      setReplyingTo(null);
      setSelectedFiles([]);
      
      updateConversationsWithNewMessage(newMessageObj);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      sendTypingIndicator(false);
    } catch (err) {
      console.error("❌ Send message error:", err);
      setError("Failed to send message. Please try again.");
    }
  };

  // 🔹 Send text message
  const sendTextMessage = () => {
    sendMessage();
  };

  // 🔹 Send file message
  const sendFileMessage = async (files) => {
    if (!activeChat) return;

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      if (activeChat.type === 'individual') {
        formData.append('recipientId', activeChat.user._id);
      } else if (activeChat.type === 'event') {
        formData.append('eventId', activeChat.eventId);
      }

      if (replyingTo) {
        formData.append('replyTo', replyingTo._id);
      }

      if (newMessage.trim()) {
        formData.append('body', newMessage);
      }

      const res = await messageService.sendMessageWithFiles(formData);
      const newMessageObj = res.data;
      
      setMessages((prev) => [...prev, newMessageObj]);
      setNewMessage("");
      setSelectedFiles([]);
      setReplyingTo(null);
      
      updateConversationsWithNewMessage(newMessageObj);
    } catch (err) {
      console.error("❌ Send file message error:", err);
      setError("Failed to send files. Please try again.");
    }
  };

  // 🔹 Send audio message
  const sendAudioMessage = async (audioFile, duration) => {
    if (!activeChat) return;

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('duration', duration);

      if (activeChat.type === 'individual') {
        formData.append('recipientId', activeChat.user._id);
      } else if (activeChat.type === 'event') {
        formData.append('eventId', activeChat.eventId);
      }

      const res = await messageService.sendAudioMessage(formData);
      const newMessageObj = res.data;
      
      setMessages((prev) => [...prev, newMessageObj]);
      updateConversationsWithNewMessage(newMessageObj);
    } catch (err) {
      console.error("❌ Send audio message error:", err);
      setError("Failed to send audio message. Please try again.");
    }
  };

  // 🔹 Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    
    if (files.length > 0) {
      sendFileMessage(files);
    }
  };

  // 🔹 Handle audio recording
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    
    // In a real app, you would integrate with Web Audio API here
  };

  const stopRecording = () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
    
    // Simulate sending audio - in real app, you'd send the actual recorded blob
    if (recordingTime > 1) {
      const fakeAudioFile = new File([], `recording-${Date.now()}.wav`, { 
        type: 'audio/wav' 
      });
      sendAudioMessage(fakeAudioFile, recordingTime);
    }
    
    setRecordingTime(0);
  };

  // 🔹 React to message
  const reactToMessage = async (messageId, emoji) => {
    try {
      await messageService.reactToMessage(messageId, emoji);
      setMessageActions(null);
    } catch (error) {
      console.error("Error reacting to message:", error);
      setError("Failed to react to message");
    }
  };

  // 🔹 Reply to message
  const replyToMessage = (message) => {
    setReplyingTo(message);
    scrollToBottom();
  };

  // 🔹 Forward message
  const forwardMessage = async (message, targets) => {
    try {
      await messageService.forwardMessage(message._id, targets);
      setForwardingMessage(null);
      setError("Message forwarded successfully");
    } catch (error) {
      console.error("Error forwarding message:", error);
      setError("Failed to forward message");
    }
  };

  // 🔹 Star message
  const toggleStarMessage = async (messageId, action = 'star') => {
    try {
      await messageService.toggleStarMessage(messageId, action);
      
      setStarredMessages(prev => {
        const newSet = new Set(prev);
        if (action === 'star') {
          newSet.add(messageId);
        } else {
          newSet.delete(messageId);
        }
        return newSet;
      });
    } catch (error) {
      console.error("Error starring message:", error);
      setError("Failed to star message");
    }
  };

  // 🔹 Delete message
  const deleteMessage = async (messageId, deleteForEveryone = false) => {
    try {
      await messageService.deleteMessage(messageId, { deleteForEveryone });
      setMessageActions(null);
      
      if (deleteForEveryone) {
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      setError("Failed to delete message");
    }
  };

  // 🔹 Search messages
  const searchMessages = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await messageService.searchMessages(query, {
        chatId: activeChat?.type === 'individual' ? activeChat.user?._id : activeChat?.eventId,
        type: activeChat?.type
      });
      setSearchResults(res.data || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Error searching messages:", error);
      setError("Failed to search messages");
    } finally {
      setIsSearching(false);
    }
  };

  // 🔹 Audio playback control
  const toggleAudioPlayback = (messageId, audioUrl) => {
    if (audioPlaying === messageId) {
      // Pause
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].pause();
      }
      setAudioPlaying(null);
    } else {
      // Stop any currently playing audio
      if (audioPlaying && audioRefs.current[audioPlaying]) {
        audioRefs.current[audioPlaying].pause();
      }
      
      // Play new audio
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].play();
        setAudioPlaying(messageId);
        
        audioRefs.current[messageId].onended = () => {
          setAudioPlaying(null);
        };
      }
    }
  };

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
    if (message.type === 'multiple') return '📎 Multiple files';
    
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

  // 🔹 Get file icon based on type
  const getFileIcon = (mimeType, filename) => {
    if (mimeType?.startsWith('image/')) return <FaRegImage />;
    if (mimeType?.startsWith('audio/')) return <FaFileAudio />;
    if (mimeType?.startsWith('video/')) return <FaVideoIcon />;
    
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FaRegFilePdf />;
    if (['doc', 'docx'].includes(ext)) return <FaRegFileWord />;
    if (['xls', 'xlsx'].includes(ext)) return <FaRegFileExcel />;
    if (['ppt', 'pptx'].includes(ext)) return <FaRegFilePowerpoint />;
    if (['zip', 'rar', '7z'].includes(ext)) return <FaArchive />;
    
    return <FaFile />;
  };

  // 🔹 Enhanced message rendering with all features
  const renderMessage = (message) => {
    const mine = message.sender?._id === user?._id;
    const isStarred = starredMessages.has(message._id);
    const hasReactions = message.reactions && message.reactions.length > 0;
    const isAudio = message.type === 'audio' || message.attachments?.some(a => a.type === 'audio');
    const hasAttachments = message.attachments && message.attachments.length > 0;
    const isPlaying = audioPlaying === message._id;

    return (
      <div 
        key={message._id} 
        className={clsx("flex group", mine ? "justify-end" : "justify-start")}
        onContextMenu={(e) => {
          e.preventDefault();
          setMessageActions(message._id);
        }}
      >
        <div className={clsx("max-w-[85%] relative", mine ? "flex flex-col items-end" : "")}>
          {/* Reply context */}
          {message.replyTo && (
            <div className={clsx(
              "text-xs p-2 mb-1 rounded-lg border-l-2 max-w-full",
              mine ? "border-l-blue-400 bg-blue-50" : "border-l-gray-400 bg-gray-100"
            )}>
              <div className="font-medium text-gray-600">
                {message.replyTo.senderName || 'User'}
              </div>
              <div className="text-gray-500 truncate">
                {message.replyTo.snippet}
              </div>
            </div>
          )}

          {/* Message bubble */}
          <div
            className={clsx(
              "p-3 rounded-2xl relative group",
              mine 
                ? "bg-blue-500 text-white rounded-br-none" 
                : "bg-white text-gray-900 rounded-bl-none shadow-sm"
            )}
          >
            {/* Forwarded label */}
            {message.forwardedFrom && (
              <div className={clsx(
                "text-xs mb-1 flex items-center",
                mine ? "text-blue-200" : "text-gray-500"
              )}>
                <FaShare size={10} className="mr-1" />
                Forwarded
              </div>
            )}

            {/* Message content */}
            {hasAttachments && renderAttachments(message.attachments, message._id)}
            
            {message.body && (
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.body}
              </div>
            )}

            {/* Reactions */}
            {hasReactions && (
              <div className={clsx(
                "flex flex-wrap gap-1 mt-2",
                mine ? "justify-end" : "justify-start"
              )}>
                {message.reactions.map((reaction, idx) => (
                  <span 
                    key={idx}
                    className={clsx(
                      "text-xs px-2 py-1 rounded-full border",
                      mine ? "bg-blue-400 border-blue-300" : "bg-gray-100 border-gray-200"
                    )}
                  >
                    {reaction.emoji}
                  </span>
                ))}
              </div>
            )}

            {/* Message status and time */}
            <div className={clsx(
              "flex items-center justify-end space-x-1 mt-1",
              mine ? "text-blue-100" : "text-gray-500"
            )}>
              <span className="text-xs">
                {new Date(message.createdAt || message.sentAt).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
              
              {mine && (
                <>
                  {message.status === 'sent' && <FaRegCheckCircle size={12} />}
                  {message.status === 'delivered' && <FaCheckCircle size={12} className="text-gray-400" />}
                  {message.status === 'read' && <FaCheckCircle size={12} className="text-blue-300" />}
                </>
              )}
            </div>

            {/* Message actions hover menu */}
            <div className={clsx(
              "absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
              mine ? "right-2" : "left-2"
            )}>
              <div className="bg-white shadow-lg rounded-lg border border-gray-200 flex">
                {commonReactions.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => reactToMessage(message._id, emoji)}
                    className="p-1 hover:bg-gray-100 rounded text-sm"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => replyToMessage(message)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-600"
                >
                  <FaReply size={12} />
                </button>
                <button
                  onClick={() => setForwardingMessage(message)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-600"
                >
                  <FaShare size={12} />
                </button>
                <button
                  onClick={() => toggleStarMessage(message._id, isStarred ? 'unstar' : 'star')}
                  className={clsx(
                    "p-1 hover:bg-gray-100 rounded",
                    isStarred ? "text-yellow-500" : "text-gray-600"
                  )}
                >
                  <FaStar size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Full message actions menu */}
          {messageActions === message._id && (
            <div className={clsx(
              "absolute z-10 bg-white shadow-xl rounded-lg border border-gray-200 p-2 min-w-32",
              mine ? "right-0 top-12" : "left-0 top-12"
            )}>
              <button
                onClick={() => replyToMessage(message)}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
              >
                <FaReply size={12} />
                <span>Reply</span>
              </button>
              <button
                onClick={() => setForwardingMessage(message)}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
              >
                <FaShare size={12} />
                <span>Forward</span>
              </button>
              <button
                onClick={() => toggleStarMessage(message._id, isStarred ? 'unstar' : 'star')}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
              >
                <FaStar size={12} />
                <span>{isStarred ? 'Unstar' : 'Star'}</span>
              </button>
              <button
                onClick={() => deleteMessage(message._id, false)}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm text-red-600"
              >
                <FaTrash size={12} />
                <span>Delete for me</span>
              </button>
              {mine && (
                <button
                  onClick={() => deleteMessage(message._id, true)}
                  className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm text-red-600"
                >
                  <FaTrash size={12} />
                  <span>Delete for everyone</span>
                </button>
              )}
              <button
                onClick={() => setMessageActions(null)}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
              >
                <FaTimes size={12} />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 🔹 Render message attachments
  const renderAttachments = (attachments, messageId) => {
    return (
      <div className="space-y-2 mb-2">
        {attachments.map((attachment, index) => (
          <div key={index} className="border rounded-lg overflow-hidden bg-gray-50">
            {attachment.type === 'image' && (
              <img
                src={`${backendUrl}${attachment.url}`}
                alt={attachment.filename}
                className="max-w-full max-h-64 object-cover cursor-pointer"
                onClick={() => window.open(`${backendUrl}${attachment.url}`, '_blank')}
              />
            )}
            
            {attachment.type === 'audio' && (
              <div className="p-3 flex items-center space-x-3">
                <button
                  onClick={() => toggleAudioPlayback(messageId, attachment.url)}
                  className={clsx(
                    "p-3 rounded-full hover:bg-gray-200 transition-colors",
                    audioPlaying === messageId ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                  )}
                >
                  {audioPlaying === messageId ? <FaPause size={14} /> : <FaPlay size={14} />}
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium">{attachment.filename || 'Audio message'}</div>
                  <div className="text-xs text-gray-500">
                    {Math.floor((attachment.duration || 0) / 60)}:{((attachment.duration || 0) % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <audio
                  ref={el => audioRefs.current[messageId] = el}
                  src={`${backendUrl}${attachment.url}`}
                  preload="metadata"
                />
              </div>
            )}
            
            {attachment.type === 'video' && (
              <div className="relative">
                <video
                  controls
                  className="max-w-full max-h-64"
                  poster={attachment.thumbnail}
                >
                  <source src={`${backendUrl}${attachment.url}`} type={attachment.mimeType} />
                </video>
              </div>
            )}
            
            {(attachment.type === 'document' || attachment.type === 'other') && (
              <div className="p-3 flex items-center space-x-3">
                <div className="text-2xl text-gray-400">
                  {getFileIcon(attachment.mimeType, attachment.filename)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{attachment.filename}</div>
                  <div className="text-xs text-gray-500">
                    {attachment.size ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                  </div>
                </div>
                <a
                  href={`${backendUrl}${attachment.url}`}
                  download={attachment.filename}
                  className="p-2 text-gray-600 hover:text-gray-800"
                >
                  <FaDownload size={16} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 🔹 Enhanced input with all features
  const renderMessageInput = () => (
    <div className="border-t bg-white p-4 flex-shrink-0">
      {/* Reply preview */}
      {replyingTo && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-2 mb-3 rounded flex justify-between items-center">
          <div className="flex-1">
            <div className="text-xs text-blue-600 font-medium">Replying to {replyingTo.sender?.name}</div>
            <div className="text-sm text-blue-800 truncate">{replyingTo.body}</div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-blue-600 hover:text-blue-800 ml-2"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="bg-red-50 border-l-4 border-red-500 p-2 mb-3 rounded flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <div className="text-sm text-red-600 font-medium">
              Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </div>
          </div>
          <button
            onClick={stopRecording}
            className="text-red-600 hover:text-red-800 ml-2"
          >
            <FaTimes />
          </button>
        </div>
      )}

      <div className="flex items-center space-x-2">
        {/* Attachment button */}
        <div className="relative">
          <button 
            onClick={() => setShowAttachments(!showAttachments)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FaPlus size={16} />
          </button>
          
          {showAttachments && (
            <div className="absolute bottom-12 left-0 bg-white shadow-xl rounded-lg border border-gray-200 p-2 min-w-48 z-10">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
              >
                <FaImage className="text-green-500" />
                <span>Photo & Video</span>
              </button>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={clsx(
                  "flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm",
                  isRecording ? "text-red-500" : ""
                )}
              >
                <FaMicrophone className={isRecording ? "text-red-500" : "text-red-500"} />
                <span>{isRecording ? 'Stop Recording' : 'Audio'}</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
              >
                <FaFile className="text-blue-500" />
                <span>Document</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Emoji button */}
        <button 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <FaSmile size={16} />
        </button>

        {/* Message input */}
        <div className="flex-1">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendTextMessage();
              }
            }}
            placeholder="Type a message..."
            className="w-full border border-gray-300 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Send button */}
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

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 bg-white shadow-xl rounded-lg border border-gray-200 p-3 grid grid-cols-8 gap-1 z-10">
          {commonReactions.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                setNewMessage(prev => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="p-1 hover:bg-gray-100 rounded text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // 🔹 Forward message modal
  const renderForwardModal = () => {
    if (!forwardingMessage) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">Forward Message</h3>
          <div className="mb-4 p-3 bg-gray-100 rounded">
            <div className="text-sm text-gray-600">
              {forwardingMessage.body || 'Media message'}
            </div>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {conversations.map(conv => (
              <label key={conv.type === 'individual' ? `user-${conv.user?._id}` : `event-${conv.eventId}`} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                <input type="checkbox" className="rounded" />
                <img
                  src={conv.type === 'individual' ? conv.user?.avatar || "/default-avatar.png" : "/group-avatar.png"}
                  alt={conv.type === 'individual' ? conv.user?.name : conv.name}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm">{conv.type === 'individual' ? conv.user?.name : conv.name}</span>
              </label>
            ))}
          </div>
          
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => setForwardingMessage(null)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => forwardMessage(forwardingMessage, { recipients: [] })}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Forward
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 🔹 Search results component
  const renderSearchResults = () => {
    if (!showSearchResults) return null;

    return (
      <div className="absolute inset-0 bg-white z-10">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSearchResults(false)}
              className="p-2 text-gray-600 hover:text-gray-800"
            >
              <FaArrowLeft size={16} />
            </button>
            <div className="flex-1">
              <div className="font-semibold">Search Results</div>
              <div className="text-sm text-gray-500">
                {searchResults.length} messages found
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {searchResults.map(message => (
            <div
              key={message._id}
              className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                // Scroll to message in chat
                setShowSearchResults(false);
                // You could implement scroll to specific message here
              }}
            >
              <div className="flex items-center space-x-2 mb-1">
                <img
                  src={message.sender?.avatar || "/default-avatar.png"}
                  alt={message.sender?.name}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm font-medium">{message.sender?.name}</span>
                <span className="text-xs text-gray-500">
                  {new Date(message.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-gray-700">{message.body}</div>
            </div>
          ))}
        </div>
      </div>
    );
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
      "flex-1 flex flex-col bg-white rounded-lg shadow-sm h-full relative",
      isMobile && !showChatWindow && "hidden"
    )}>
      {showSearchResults ? renderSearchResults() : (
        activeChat ? (
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
                    {typingUsers[activeChat.type === 'individual' ? activeChat.user?._id : 'group'] && (
                      <span className="text-blue-500 ml-2">typing...</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Chat actions */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => searchMessages('')}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                >
                  <FaSearch size={16} />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
                  <FaPhone size={16} />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
                  <FaVideoCall size={16} />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
                  <FaInfoCircle size={16} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
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
                  <>
                    {pagination.hasMore && (
                      <div className="flex justify-center mb-4">
                        <button
                          onClick={() => openChat(activeChat, true)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                        >
                          Load older messages
                        </button>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {messages.map(renderMessage)}
                      <div ref={messagesEndRef} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Message Input */}
            {renderMessageInput()}
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
        )
      )}
    </div>
  );

  // Filter conversations and users based on search
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

      {/* Modals */}
      {renderForwardModal()}

      {/* Close overlays when clicking outside */}
      {messageActions && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setMessageActions(null)}
        />
      )}
      
      {showEmojiPicker && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setShowEmojiPicker(false)}
        />
      )}
      
      {showAttachments && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setShowAttachments(false)}
        />
      )}
    </div>
  );
};

export default UserMessage;