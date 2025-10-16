import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  FaPaperPlane, FaSmile, FaPlus, FaSearch, FaImage, FaFile, 
  FaMicrophone, FaVideo, FaReply, FaStar, FaTrash, FaPhone,
  FaVideo as FaVideoCall, FaInfoCircle, FaTimes, FaDownload,
  FaRegCheckCircle, FaCheckCircle, FaRegImage, FaFileAudio,
  FaVideo as FaVideoIcon, FaRegFilePdf, FaRegFileWord, 
  FaRegFileExcel, FaRegFilePowerpoint, FaArchive, FaPlay, 
  FaPause, FaShare, FaArrowLeft, FaExclamationTriangle,
  FaPaperclip, FaComments
} from "react-icons/fa";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { io as ioClient } from "socket.io-client";
import clsx from "clsx";
import { useAppContext } from "../../../context/AppContext";
import useMessageService from "../../../services/messageService";

const ChatWindow = ({ activeChat: propActiveChat, onBack, onChatClose }) => {
  const { backendUrl, token, user, isMobile } = useAppContext();
  const messageService = useMessageService();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get chat data from navigation state or props
  const initialChat = location.state?.chat || propActiveChat;

  // State variables
  const [activeChat, setActiveChat] = useState(initialChat);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [error, setError] = useState(null);
  
  // Enhanced file handling states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [pagination, setPagination] = useState({ hasMore: false, page: 1 });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showFileModal, setShowFileModal] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioRefs = useRef({});
  const recordingIntervalRef = useRef(null);

  // 🔹 Initialize chat if not provided
  useEffect(() => {
    if (!activeChat && chatId) {
      // Reconstruct chat object from URL
      const reconstructedChat = {
        type: 'individual',
        user: { _id: chatId },
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0
      };
      setActiveChat(reconstructedChat);
    }
  }, [chatId, activeChat]);

  // 🔹 Update activeChat when prop changes (desktop)
  useEffect(() => {
    if (propActiveChat && propActiveChat !== activeChat) {
      setActiveChat(propActiveChat);
      setMessages([]);
      setNewMessage("");
      setReplyingTo(null);
      setSelectedFiles([]);
      setFilePreviews([]);
    }
  }, [propActiveChat, activeChat]);

  // 🔹 Update URL when active chat changes (desktop)
  useEffect(() => {
    if (!isMobile && activeChat) {
      const chatPath = `/messages/chat/${activeChat.type === "individual" ? activeChat.user?._id : activeChat.eventId}`;
      window.history.replaceState({}, '', chatPath);
    }
  }, [isMobile, activeChat]);

  // 🔹 Socket connection for real-time features
  useEffect(() => {
    if (!backendUrl || !token || !activeChat) return;

    console.log("🔌 Connecting to socket...");
    const s = ioClient(backendUrl, {
      transports: ["websocket"],
      auth: { token },
    });
    setSocket(s);

    // Real-time event handlers
    s.on("connect", () => {
      console.log("✅ Socket connected");
      s.emit('user-online', { 
        userId: user?._id,
        socketId: s.id 
      });
    });

    s.on("newMessage", (msg) => {
      console.log("📨 New message received:", msg);
      handleNewMessage(msg);
    });

    s.on("typing", (data) => {
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

    return () => {
      console.log("🧹 Cleaning up socket connection");
      s.disconnect();
    };
  }, [backendUrl, token, activeChat, user]);

  // 🔹 Load messages when active chat changes
  useEffect(() => {
    if (activeChat) {
      loadMessages();
    }
  }, [activeChat]);

  // 🔹 Enhanced file handling
  const handleFileSelect = (e, fileType = 'all') => {
    const files = Array.from(e.target.files);
    
    // Create previews for images and videos
    const previews = files.map(file => {
      const preview = {
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('video/') ? 'video' : 
              file.type.startsWith('audio/') ? 'audio' : 'document',
        name: file.name,
        size: file.size
      };
      return preview;
    });

    setSelectedFiles(files);
    setFilePreviews(previews);
    setShowAttachments(false);
  };

  // 🔹 Send files
  const sendFiles = async () => {
    if (selectedFiles.length === 0 || !activeChat) return;

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));

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
      setFilePreviews([]);
      setReplyingTo(null);
      
    } catch (err) {
      console.error("❌ Send file message error:", err);
      setError("Failed to send files. Please try again.");
    }
  };

  // 🔹 Remove file preview
  const removeFilePreview = (index) => {
    const newFiles = [...selectedFiles];
    const newPreviews = [...filePreviews];
    
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(newPreviews[index].url);
    
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    
    setSelectedFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  // 🔹 Load messages
  const loadMessages = async (loadMore = false) => {
    if (!activeChat) return;
    
    const targetId = activeChat.type === 'individual' ? activeChat.user?._id : activeChat.eventId;
    if (!targetId) return;

    setLoadingMessages(true);
    setError(null);
    
    try {
      const page = loadMore ? pagination.page + 1 : 1;
      const res = await messageService.getChatHistory(
        targetId, 
        activeChat.type, 
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

    } catch (err) {
      console.error("❌ Failed to load messages:", err);
      setError("Failed to load messages. Please try again.");
    } finally {
      setLoadingMessages(false);
    }
  };

  // 🔹 Handle new incoming messages
  const handleNewMessage = (newMsg) => {
    if (shouldAddToActiveChat(newMsg)) {
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    }
  };

  const shouldAddToActiveChat = (msg) => {
    if (activeChat.type === 'individual') {
      return msg.sender?._id === activeChat.user?._id || 
             msg.recipient === activeChat.user?._id;
    } else {
      return msg.eventId === activeChat.eventId;
    }
  };

  // 🔹 Typing indicators
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

  // 🔹 Send message
  const sendMessage = async (text = null, attachments = []) => {
    const messageText = text || newMessage.trim();
    if ((!messageText && attachments.length === 0 && selectedFiles.length === 0) || !activeChat) return;
    
    // If files are selected, send them instead
    if (selectedFiles.length > 0) {
      await sendFiles();
      return;
    }
    
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
      setFilePreviews([]);
      
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

  // 🔹 Handle input with typing indicator
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

  // 🔹 Audio recording
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
  };

  // 🔹 Navigate back in mobile
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  // 🔹 Handle chat close in desktop
  const handleChatClose = () => {
    if (onChatClose) {
      onChatClose();
    }
    // Update URL to remove chat ID
    if (!isMobile) {
      window.history.replaceState({}, '', '/messages');
    }
  };

  // 🔹 Enhanced message rendering with file support
  const renderMessage = (message) => {
    const mine = message.sender?._id === user?._id;
    const hasAttachments = message.attachments && message.attachments.length > 0;

    return (
      <div 
        key={message._id} 
        className={clsx("flex group", mine ? "justify-end" : "justify-start")}
      >
        <div className={clsx("max-w-[85%] relative", mine ? "flex flex-col items-end" : "")}>
          {/* Message bubble */}
          <div
            className={clsx(
              "p-3 rounded-2xl relative group",
              mine 
                ? "bg-blue-500 text-white rounded-br-none" 
                : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none shadow-sm border border-gray-200 dark:border-gray-600"
            )}
          >
            {/* Message content */}
            {hasAttachments && renderAttachments(message.attachments, message._id)}
            
            {message.body && (
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.body}
              </div>
            )}

            {/* Message status and time */}
            <div className={clsx(
              "flex items-center justify-end space-x-1 mt-1 text-xs",
              mine ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
            )}>
              <span>
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
          </div>
        </div>
      </div>
    );
  };

  // 🔹 Enhanced attachments rendering with click handlers
  const renderAttachments = (attachments, messageId) => {
    return (
      <div className="space-y-2 mb-2">
        {attachments.map((attachment, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-600">
            {attachment.type === 'image' && (
              <img
                src={`${backendUrl}${attachment.url}`}
                alt={attachment.filename}
                className="max-w-full max-h-64 object-cover cursor-pointer"
                onClick={() => setShowFileModal(attachment)}
              />
            )}
            
            {attachment.type === 'audio' && (
              <div className="p-3 flex items-center space-x-3">
                <button
                  onClick={() => toggleAudioPlayback(messageId, attachment.url)}
                  className={clsx(
                    "p-3 rounded-full transition-colors",
                    audioPlaying === messageId 
                      ? "bg-red-500 text-white" 
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  )}
                >
                  {audioPlaying === messageId ? <FaPause size={14} /> : <FaPlay size={14} />}
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {attachment.filename || 'Audio message'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-300">
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
                  className="max-w-full max-h-64 cursor-pointer"
                  poster={attachment.thumbnail}
                  onClick={() => setShowFileModal(attachment)}
                >
                  <source src={`${backendUrl}${attachment.url}`} type={attachment.mimeType} />
                </video>
              </div>
            )}
            
            {(attachment.type === 'document' || attachment.type === 'other') && (
              <div className="p-3 flex items-center space-x-3">
                <div className="text-2xl text-gray-400 dark:text-gray-300">
                  {getFileIcon(attachment.mimeType, attachment.filename)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {attachment.filename}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    {attachment.size ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                  </div>
                </div>
                <a
                  href={`${backendUrl}${attachment.url}`}
                  download={attachment.filename}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors"
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

  // 🔹 File modal for viewing images/videos
  const renderFileModal = () => {
    if (!showFileModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
        <div className="relative max-w-4xl max-h-full">
          <button
            onClick={() => setShowFileModal(null)}
            className="absolute top-4 right-4 text-white text-2xl z-10 bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-colors"
          >
            <FaTimes />
          </button>
          
          {showFileModal.type === 'image' && (
            <img
              src={`${backendUrl}${showFileModal.url}`}
              alt={showFileModal.filename}
              className="max-w-full max-h-screen object-contain"
            />
          )}
          
          {showFileModal.type === 'video' && (
            <video
              controls
              autoPlay
              className="max-w-full max-h-screen"
            >
              <source src={`${backendUrl}${showFileModal.url}`} type={showFileModal.mimeType} />
            </video>
          )}
          
          <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 rounded-lg p-2">
            <div className="text-sm">{showFileModal.filename}</div>
          </div>
        </div>
      </div>
    );
  };

  // 🔹 File previews for selected files
  const renderFilePreviews = () => {
    if (filePreviews.length === 0) return null;

    return (
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {filePreviews.length} file{filePreviews.length > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => {
              setSelectedFiles([]);
              setFilePreviews([]);
            }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Clear all
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {filePreviews.map((preview, index) => (
            <div key={index} className="relative rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-700">
              {preview.type === 'image' && (
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="w-full h-32 object-cover"
                />
              )}
              
              {preview.type === 'video' && (
                <video className="w-full h-32 object-cover">
                  <source src={preview.url} type={preview.file.type} />
                </video>
              )}
              
              {(preview.type === 'audio' || preview.type === 'document') && (
                <div className="p-3 flex items-center space-x-2">
                  <div className="text-2xl text-gray-400 dark:text-gray-300">
                    {getFileIcon(preview.file.type, preview.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {preview.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-300">
                      {(preview.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={() => removeFilePreview(index)}
                className="absolute top-1 right-1 p-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={sendFiles}
          className="w-full mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
        >
          Send {filePreviews.length} file{filePreviews.length > 1 ? 's' : ''}
        </button>
      </div>
    );
  };

  // 🔹 Get file icon
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

  // 🔹 Enhanced message input with file support
  const renderMessageInput = () => (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex-shrink-0">
      {/* File Previews */}
      {renderFilePreviews()}

      {/* Reply preview */}
      {replyingTo && (
        <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-500 p-2 mb-3 rounded flex justify-between items-center">
          <div className="flex-1">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-200">
              Replying to {replyingTo.sender?.name}
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-300 truncate">
              {replyingTo.body}
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 ml-2 transition-colors"
          >
            <FaTimes />
          </button>
        </div>
      )}

      <div className="flex items-center space-x-2">
        {/* Attachment button with dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowAttachments(!showAttachments)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <FaPlus size={16} />
          </button>
          
          {showAttachments && (
            <div className="absolute bottom-12 left-0 bg-white dark:bg-gray-700 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 p-2 min-w-48 z-10">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm text-gray-900 dark:text-white transition-colors"
              >
                <FaImage className="text-green-500" />
                <span>Photo & Video</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm text-gray-900 dark:text-white transition-colors"
              >
                <FaFile className="text-blue-500" />
                <span>Document</span>
              </button>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={clsx(
                  "flex items-center space-x-2 w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm transition-colors",
                  isRecording ? "text-red-500" : "text-gray-900 dark:text-white"
                )}
              >
                <FaMicrophone className={isRecording ? "text-red-500" : "text-red-500"} />
                <span>{isRecording ? 'Stop Recording' : 'Audio'}</span>
              </button>
              
              {/* Hidden file inputs */}
              <input
                type="file"
                ref={imageInputRef}
                onChange={(e) => handleFileSelect(e, 'image')}
                multiple
                accept="image/*,video/*"
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e, 'file')}
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                className="hidden"
              />
            </div>
          )}
        </div>

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
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
          />
        </div>

        {/* Send button */}
        <button
          onClick={sendTextMessage}
          disabled={!newMessage.trim() && selectedFiles.length === 0}
          className={clsx(
            "p-3 rounded-full transition-colors",
            (newMessage.trim() || selectedFiles.length > 0)
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed"
          )}
        >
          <FaPaperPlane size={14} />
        </button>
      </div>
    </div>
  );

  if (!activeChat) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex items-center justify-center">
        <div className="text-center text-gray-400 dark:text-gray-500">
          <FaComments size={64} className="mx-auto mb-4 opacity-30" />
          <div className="text-lg">Select a chat to start messaging</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      {/* Error Display */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <FaExclamationTriangle />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 transition-colors"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 rounded-t-lg">
        <div className="flex items-center space-x-3">
          {(isMobile || (!isMobile && onChatClose)) && (
            <button
              onClick={isMobile ? handleBack : handleChatClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
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
              className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
            />
            {activeChat.type === 'individual' && onlineUsers.has(activeChat.user?._id) && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-800 dark:text-white">
              {activeChat.type === 'individual' ? activeChat.user?.name : activeChat.name}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {activeChat.type === 'individual' 
                ? (onlineUsers.has(activeChat.user?._id) ? "Online" : "Offline")
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
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <FaPhone size={16} />
          </button>
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <FaVideoCall size={16} />
          </button>
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <FaInfoCircle size={16} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 relative"
      >
        <div className="absolute inset-0 p-4">
          {loadingMessages ? (
            <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-sm">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
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
                    onClick={() => loadMessages(true)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
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

      {/* File Modal */}
      {renderFileModal()}

      {/* Close overlays when clicking outside */}
      {showAttachments && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setShowAttachments(false)}
        />
      )}
      
      {showEmojiPicker && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
};

export default ChatWindow;