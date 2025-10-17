import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  FaPaperPlane, FaSmile, FaPlus, FaSearch, FaImage, FaFile, 
  FaMicrophone, FaVideo, FaReply, FaStar, FaTrash, FaPhone,
  FaVideo as FaVideoCall, FaInfoCircle, FaTimes, FaDownload,
  FaRegCheckCircle, FaCheckCircle, FaRegImage, FaFileAudio,
  FaVideo as FaVideoIcon, FaRegFilePdf, FaRegFileWord, 
  FaRegFileExcel, FaRegFilePowerpoint, FaArchive, FaPlay, 
  FaPause, FaShare, FaArrowLeft, FaExclamationTriangle,
  FaPaperclip, FaComments, FaHeart, FaThumbsUp, FaLaugh,
  FaSadTear, FaAngry, FaSurprise, FaEllipsisH, FaUser,
  FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaStop,
  FaCircle, FaRegCircle, FaPhoneSlash, FaVideoSlash
} from "react-icons/fa";
import { IoMdSend } from "react-icons/io";
import { BsMicFill, BsStopFill } from "react-icons/bs";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { io as ioClient } from "socket.io-client";
import clsx from "clsx";
import { useAppContext } from "../../../context/AppContext";
import useMessageService, { voiceMessageUtils, callUtils } from "../../../services/messageService";

// Emoji data for reactions
const EMOJI_REACTIONS = [
  { emoji: "❤️", label: "heart", icon: <FaHeart className="text-red-500" /> },
  { emoji: "👍", label: "thumbs up", icon: <FaThumbsUp className="text-blue-500" /> },
  { emoji: "😂", label: "laugh", icon: <FaLaugh className="text-yellow-500" /> },
  { emoji: "😮", label: "surprise", icon: <FaSurprise className="text-orange-500" /> },
  { emoji: "😢", label: "sad", icon: <FaSadTear className="text-blue-300" /> },
  { emoji: "😠", label: "angry", icon: <FaAngry className="text-red-600" /> }
];

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
  
  // Voice messaging states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState([]);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  
  // Call states
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callModal, setCallModal] = useState(null); // 'incoming', 'outgoing', 'active'
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  // Message interaction states
  const [showFileModal, setShowFileModal] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [reactingToMessage, setReactingToMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [starredMessages, setStarredMessages] = useState(new Set());
  const [showChatInfo, setShowChatInfo] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioRefs = useRef({});
  const audioRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const callDurationIntervalRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // 🔹 Initialize chat if not provided
  useEffect(() => {
    if (!activeChat && chatId) {
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

  // 🔹 Auto-scroll to bottom when messages change - ADD THIS
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // 🔹 Enhanced Socket connection for real-time features
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

    // Voice message events
    s.on("voiceMessageSent", (data) => {
      console.log("🎤 Voice message sent:", data);
    });

    s.on("voiceMessagePlayback", (data) => {
      console.log("🎵 Voice message playback:", data);
      handleVoicePlaybackUpdate(data);
    });

    // Call events
    s.on("incomingCall", (data) => {
      console.log("📞 Incoming call:", data);
      handleIncomingCall(data);
    });

    s.on("callAccepted", (data) => {
      console.log("✅ Call accepted:", data);
      handleCallAccepted(data);
    });

    s.on("callRejected", (data) => {
      console.log("❌ Call rejected:", data);
      handleCallRejected(data);
    });

    s.on("callEnded", (data) => {
      console.log("📵 Call ended:", data);
      handleCallEnded(data);
    });

    s.on("establishPeerConnection", (data) => {
      console.log("🔗 Establishing peer connection:", data);
      establishPeerConnection(data.callId);
    });

    // WebRTC signaling events
    s.on("rtcSignal", (data) => {
      console.log("📡 RTC signal received:", data);
      handleRTCSignal(data);
    });

    s.on("iceCandidate", (data) => {
      console.log("🧊 ICE candidate received:", data);
      handleICECandidate(data);
    });

    return () => {
      console.log("🧹 Cleaning up socket connection");
      s.disconnect();
      // Clean up media streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [backendUrl, token, activeChat, user]);

  // 🔹 Load messages when active chat changes
  useEffect(() => {
    if (activeChat) {
      loadMessages();
      loadStarredMessages();
    }
  }, [activeChat]);

  // 🔹 Initialize WebRTC when call starts
  useEffect(() => {
    if (callModal === 'active' && localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [callModal, localStream]);

  // ==================== MESSAGE HANDLING FUNCTIONS ====================

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

  const sendTextMessage = () => {
    sendMessage();
  };

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

  const handleNewMessage = (newMsg) => {
    if (shouldAddToActiveChat(newMsg)) {
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    }
  };

  const shouldAddToActiveChat = (msg) => {
    if (!activeChat) return false;
    
    if (activeChat.type === 'individual') {
      return msg.sender?._id === activeChat.user?._id || 
             msg.recipient === activeChat.user?._id;
    } else {
      return msg.eventId === activeChat.eventId;
    }
  };

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

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleChatClose = () => {
    if (onChatClose) {
      onChatClose();
    }
    // Update URL to remove chat ID
    if (!isMobile) {
      window.history.replaceState({}, '', '/messages');
    }
  };

  // ==================== VOICE MESSAGING FUNCTIONS ====================

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const waveform = await voiceMessageUtils.generateWaveform(audioBlob);
        setRecordingWaveform(waveform);
        
        // Create file from blob
        const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, {
          type: 'audio/webm'
        });
        
        // Send voice message
        await sendVoiceMessage(audioFile, recordingTime, waveform);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        setAudioChunks([]);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      setRecordingTime(0);
      setShowVoiceRecorder(true);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("❌ Error starting voice recording:", error);
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      setShowVoiceRecorder(false);
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      setShowVoiceRecorder(false);
      setRecordingTime(0);
      setRecordingWaveform([]);
      
      // Clean up media tracks
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const sendVoiceMessage = async (audioFile, duration, waveform) => {
    try {
      const voiceData = {
        voiceFile: audioFile,
        duration: duration,
        waveform: waveform
      };

      if (activeChat.type === 'individual') {
        voiceData.recipientId = activeChat.user._id;
      } else if (activeChat.type === 'event') {
        voiceData.eventId = activeChat.eventId;
      }

      if (replyingTo) {
        voiceData.replyTo = replyingTo._id;
      }

      const res = await messageService.sendVoiceMessage(voiceData);
      const newMessageObj = res.data;
      
      setMessages((prev) => [...prev, newMessageObj]);
      setReplyingTo(null);
      
    } catch (err) {
      console.error("❌ Send voice message error:", err);
      setError("Failed to send voice message. Please try again.");
    }
  };

  const handleVoicePlaybackUpdate = (data) => {
    // Update voice message playback status in UI
    setMessages(prev => prev.map(msg => 
      msg._id === data.messageId 
        ? { ...msg, voiceMessage: { ...msg.voiceMessage, isPlaying: data.isPlaying } }
        : msg
    ));
  };

  // ==================== CALL MANAGEMENT FUNCTIONS ====================

  const initiateCall = async (callType = 'audio') => {
    if (!activeChat || activeChat.type !== 'individual' || !activeChat.user) {
      setError("Cannot initiate call. Please select a valid chat.");
      return;
    }

    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      
      setLocalStream(stream);
      
      const callData = {
        recipientId: activeChat.user._id,
        callType: callType
      };

      const res = await messageService.initiateCall(callData);
      const { callId, callMessage } = res.data;
      
      setActiveCall({
        callId,
        callType,
        caller: user,
        recipient: activeChat.user,
        status: 'initiated'
      });
      
      setCallModal('outgoing');
      
      // Notify via socket
      if (socket) {
        socket.emit('initiate-call', {
          callId,
          recipientId: activeChat.user._id,
          callType,
          caller: user
        });
      }
      
    } catch (error) {
      console.error("❌ Error initiating call:", error);
      setError(`Failed to start ${callType} call. Please check permissions.`);
    }
  };

  const handleIncomingCall = (data) => {
    setIncomingCall(data);
    setCallModal('incoming');
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === 'video'
      });
      
      setLocalStream(stream);
      
      await messageService.acceptCall({ callId: incomingCall.callId });
      
      setActiveCall({
        ...incomingCall,
        status: 'ongoing'
      });
      
      setCallModal('active');
      setIncomingCall(null);
      
      // Start call timer
      setCallDuration(0);
      callDurationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
      // Notify caller
      if (socket) {
        socket.emit('accept-call', {
          callId: incomingCall.callId,
          callerId: incomingCall.caller._id
        });
      }
      
    } catch (error) {
      console.error("❌ Error accepting call:", error);
      setError("Failed to accept call. Please try again.");
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;

    try {
      await messageService.rejectCall({ 
        callId: incomingCall.callId, 
        reason: 'rejected' 
      });
      
      setIncomingCall(null);
      setCallModal(null);
      
      // Notify caller
      if (socket) {
        socket.emit('reject-call', {
          callId: incomingCall.callId,
          callerId: incomingCall.caller._id,
          reason: 'rejected'
        });
      }
      
    } catch (error) {
      console.error("❌ Error rejecting call:", error);
    }
  };

  const endCall = async () => {
    if (!activeCall) return;

    try {
      await messageService.endCall({ 
        callId: activeCall.callId, 
        duration: callDuration 
      });
      
      // Clean up
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      clearInterval(callDurationIntervalRef.current);
      setActiveCall(null);
      setCallModal(null);
      setCallDuration(0);
      setLocalStream(null);
      setRemoteStream(null);
      
      // Notify other participant
      if (socket) {
        socket.emit('end-call', {
          callId: activeCall.callId,
          participants: [activeCall.caller._id, activeCall.recipient._id],
          endedBy: user._id,
          duration: callDuration
        });
      }
      
    } catch (error) {
      console.error("❌ Error ending call:", error);
    }
  };

  const handleCallAccepted = (data) => {
    if (activeCall && activeCall.callId === data.callId) {
      setActiveCall(prev => ({ ...prev, status: 'ongoing' }));
      setCallModal('active');
      
      // Start call timer
      setCallDuration(0);
      callDurationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const handleCallRejected = (data) => {
    if (activeCall && activeCall.callId === data.callId) {
      setError(`Call was ${data.reason} by ${data.rejectedBy}`);
      setActiveCall(null);
      setCallModal(null);
      
      // Clean up local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
  };

  const handleCallEnded = (data) => {
    if (activeCall && activeCall.callId === data.callId) {
      setActiveCall(null);
      setCallModal(null);
      setCallDuration(0);
      clearInterval(callDurationIntervalRef.current);
      
      // Clean up streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        setRemoteStream(null);
      }
    }
  };

  // ==================== WEBRTC FUNCTIONS ====================

  const establishPeerConnection = async (callId) => {
    try {
      const peerConnection = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = peerConnection;

      // Add local stream to connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle incoming remote stream
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            targetUserId: activeChat.user._id,
            candidate: event.candidate,
            callId: callId
          });
        }
      };

      // Create and set local description
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer to other peer
      if (socket) {
        socket.emit('rtc-signal', {
          targetUserId: activeChat.user._id,
          signal: offer,
          callId: callId
        });
      }

    } catch (error) {
      console.error("❌ Error establishing peer connection:", error);
    }
  };

  const handleRTCSignal = async (data) => {
    if (!peerConnectionRef.current) return;

    try {
      if (data.signal.type === 'offer') {
        await peerConnectionRef.current.setRemoteDescription(data.signal);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        if (socket) {
          socket.emit('rtc-signal', {
            targetUserId: data.fromUserId,
            signal: answer,
            callId: data.callId
          });
        }
      } else if (data.signal.type === 'answer') {
        await peerConnectionRef.current.setRemoteDescription(data.signal);
      }
    } catch (error) {
      console.error("❌ Error handling RTC signal:", error);
    }
  };

  const handleICECandidate = async (data) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(data.candidate);
    } catch (error) {
      console.error("❌ Error adding ICE candidate:", error);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // ==================== MESSAGE INTERACTION FUNCTIONS ====================

  const reactToMessage = async (messageId, emoji) => {
    try {
      await messageService.reactToMessage(messageId, emoji);
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg._id === messageId 
          ? { 
              ...msg, 
              reactions: [...(msg.reactions || []), { 
                userId: user._id, 
                emoji, 
                reactedAt: new Date() 
              }] 
            }
          : msg
      ));
      
      setReactingToMessage(null);
      
    } catch (error) {
      console.error("❌ Error reacting to message:", error);
      setError("Failed to add reaction. Please try again.");
    }
  };

  const forwardMessage = async (messageId, targets) => {
    try {
      await messageService.forwardMessage(messageId, targets);
      setForwardingMessage(null);
      setError("Message forwarded successfully!");
      
      setTimeout(() => setError(null), 3000);
      
    } catch (error) {
      console.error("❌ Error forwarding message:", error);
      setError("Failed to forward message. Please try again.");
    }
  };

  const toggleStarMessage = async (messageId, action = 'star') => {
    try {
      await messageService.toggleStarMessage(messageId, action);
      
      // Update local state
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
      console.error("❌ Error starring message:", error);
      setError("Failed to update star. Please try again.");
    }
  };

  const loadStarredMessages = async () => {
    try {
      const res = await messageService.getStarredMessages();
      const starred = new Set(res.data.map(msg => msg._id));
      setStarredMessages(starred);
    } catch (error) {
      console.error("❌ Error loading starred messages:", error);
    }
  };

  // ==================== RENDER FUNCTIONS ====================
// ==================== RENDER FUNCTIONS ====================

const renderMessage = (message) => {
  const mine = message.sender?._id === user?._id;
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const isVoiceMessage = message.type === 'voice' || (hasAttachments && message.attachments.some(a => a.type === 'voice'));
  const messageReactions = message.reactions || [];
  const reactionCounts = {};

  // Count reactions by emoji
  messageReactions.forEach(reaction => {
    reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
  });

  return (
    <div 
      key={message._id} 
      className={clsx("flex group mb-4", mine ? "justify-end" : "justify-start")}
    >
      <div className={clsx("max-w-[85%] relative", mine ? "flex flex-col items-end" : "")}>
        
        {/* Reply preview */}
        {message.replyTo && (
          <div className={clsx(
            "mb-1 p-2 rounded-lg border-l-4 text-xs max-w-full",
            mine 
              ? "bg-blue-50 dark:bg-blue-900 border-blue-400 text-blue-700 dark:text-blue-200" 
              : "bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-600 dark:text-gray-300"
          )}>
            <div className="font-medium">{message.replyTo.senderName || 'User'}</div>
            <div className="truncate">{message.replyTo.snippet}</div>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={clsx(
            "p-3 rounded-2xl relative group",
            mine 
              ? "bg-blue-500 text-white rounded-br-none" 
              : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none shadow-sm border border-gray-200 dark:border-gray-600"
          )}
        >
          {/* Forwarded label */}
          {message.forwardedFrom && (
            <div className={clsx(
              "text-xs mb-1 flex items-center space-x-1",
              mine ? "text-blue-200" : "text-gray-500 dark:text-gray-400"
            )}>
              <FaShare size={10} />
              <span>Forwarded</span>
            </div>
          )}

          {/* Sender name for group chats */}
          {!mine && activeChat?.type === 'event' && (
            <div className="text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
              {message.sender?.name}
            </div>
          )}

          {/* Message content */}
          {hasAttachments && renderAttachments(message.attachments, message._id)}
          
          {message.body && message.body !== 'Voice message' && (
            <div className={clsx(
              "text-sm whitespace-pre-wrap break-words",
              isVoiceMessage && "italic text-gray-600 dark:text-gray-400"
            )}>
              {message.body}
            </div>
          )}

          {/* Reactions */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className={clsx(
              "flex flex-wrap gap-1 mt-2",
              mine ? "justify-end" : "justify-start"
            )}>
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <div
                  key={emoji}
                  className={clsx(
                    "px-2 py-1 rounded-full text-xs flex items-center space-x-1",
                    mine 
                      ? "bg-blue-400 text-white" 
                      : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                  )}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span>{count}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Message actions hover menu */}
          <div className={clsx(
            "absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-1",
            mine 
              ? "-top-2 -right-2" 
              : "-top-2 -left-2"
          )}>
            <button
              onClick={() => setReactingToMessage(message)}
              className="p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              <FaSmile size={12} />
            </button>
            <button
              onClick={() => setReplyingTo(message)}
              className="p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-green-500 dark:hover:text-green-400 transition-colors"
            >
              <FaReply size={12} />
            </button>
            <button
              onClick={() => setForwardingMessage(message)}
              className="p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
            >
              <FaShare size={12} />
            </button>
            <button
              onClick={() => toggleStarMessage(message._id, starredMessages.has(message._id) ? 'unstar' : 'star')}
              className={clsx(
                "p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 transition-colors",
                starredMessages.has(message._id) 
                  ? "text-yellow-500" 
                  : "text-gray-600 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400"
              )}
            >
              <FaStar size={12} />
            </button>
          </div>
        </div>

        {/* Message status and time */}
        <div className={clsx(
          "flex items-center space-x-1 mt-1 text-xs px-1",
          mine ? "justify-end" : "justify-start",
          mine ? "text-blue-400" : "text-gray-500 dark:text-gray-400"
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
  );
};

const renderAttachments = (attachments, messageId) => {
  return (
    <div className="space-y-2 mb-2">
      {attachments.map((attachment, index) => (
        <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-600">
          {attachment.type === 'image' && (
            <img
              src={`${backendUrl}${attachment.url}`}
              alt={attachment.filename}
              className="max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setShowFileModal(attachment)}
            />
          )}
          
          {attachment.type === 'audio' && (
            <div className="p-3 flex items-center space-x-3">
              <button
                onClick={() => toggleAudioPlayback(messageId, attachment.url)}
                className={clsx(
                  "p-3 rounded-full transition-colors flex-shrink-0",
                  audioPlaying === messageId 
                    ? "bg-red-500 text-white" 
                    : "bg-blue-500 text-white hover:bg-blue-600"
                )}
              >
                {audioPlaying === messageId ? <FaPause size={14} /> : <FaPlay size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {attachment.filename || 'Audio message'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  {Math.floor((attachment.duration || 0) / 60)}:{((attachment.duration || 0) % 60).toString().padStart(2, '0')}
                </div>
                {/* Audio progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all duration-100"
                    style={{ width: `${getAudioProgress(messageId)}%` }}
                  />
                </div>
              </div>
              <audio
                ref={el => audioRefs.current[messageId] = el}
                src={`${backendUrl}${attachment.url}`}
                preload="metadata"
                onTimeUpdate={(e) => handleAudioTimeUpdate(messageId, e)}
              />
            </div>
          )}

          {attachment.type === 'voice' && (
            <div className="p-3 flex items-center space-x-3">
              <button
                onClick={() => toggleAudioPlayback(messageId, attachment.url)}
                className={clsx(
                  "p-3 rounded-full transition-colors flex-shrink-0",
                  audioPlaying === messageId 
                    ? "bg-red-500 text-white" 
                    : "bg-green-500 text-white hover:bg-green-600"
                )}
              >
                {audioPlaying === messageId ? <FaPause size={14} /> : <FaPlay size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center space-x-2">
                  <BsMicFill className="text-green-500" />
                  <span>Voice message</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  {voiceMessageUtils.formatDuration(attachment.duration || 0)}
                </div>
                {/* Voice waveform visualization */}
                {attachment.waveform && attachment.waveform.length > 0 && (
                  <div className="flex items-end space-x-px h-4 mt-1">
                    {attachment.waveform.slice(0, 50).map((amplitude, idx) => (
                      <div
                        key={idx}
                        className={clsx(
                          "w-1 rounded-full transition-all duration-200",
                          audioPlaying === messageId ? "bg-green-400" : "bg-green-300 dark:bg-green-600"
                        )}
                        style={{ height: `${Math.max(2, amplitude * 12)}px` }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <audio
                ref={el => audioRefs.current[messageId] = el}
                src={`${backendUrl}${attachment.url}`}
                preload="metadata"
                onTimeUpdate={(e) => handleAudioTimeUpdate(messageId, e)}
                onEnded={() => setAudioPlaying(null)}
              />
            </div>
          )}
          
          {attachment.type === 'video' && (
            <div className="relative">
              <video
                controls
                className="max-w-full max-h-64 cursor-pointer"
                poster={attachment.thumbnail ? `${backendUrl}${attachment.thumbnail}` : undefined}
                onClick={() => setShowFileModal(attachment)}
              >
                <source src={`${backendUrl}${attachment.url}`} type={attachment.mimeType} />
              </video>
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 rounded px-2 py-1 text-white text-xs">
                {Math.floor((attachment.duration || 0) / 60)}:{((attachment.duration || 0) % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}
          
          {(attachment.type === 'document' || attachment.type === 'other') && (
            <div className="p-3 flex items-center space-x-3">
              <div className="text-2xl text-gray-400 dark:text-gray-300 flex-shrink-0">
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
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors flex-shrink-0"
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

const renderFileModal = () => {
  if (!showFileModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="relative max-w-4xl max-h-full w-full">
        <button
          onClick={() => setShowFileModal(null)}
          className="absolute top-4 right-4 text-white text-2xl z-10 bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75 transition-colors"
        >
          <FaTimes />
        </button>
        
        {showFileModal.type === 'image' && (
          <div className="flex items-center justify-center h-full">
            <img
              src={`${backendUrl}${showFileModal.url}`}
              alt={showFileModal.filename}
              className="max-w-full max-h-screen object-contain"
            />
          </div>
        )}
        
        {showFileModal.type === 'video' && (
          <div className="flex items-center justify-center h-full">
            <video
              controls
              autoPlay
              className="max-w-full max-h-screen"
            >
              <source src={`${backendUrl}${showFileModal.url}`} type={showFileModal.mimeType} />
            </video>
          </div>
        )}

        {showFileModal.type === 'document' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
            <div className="text-6xl text-gray-400 dark:text-gray-300 mb-4 flex justify-center">
              {getFileIcon(showFileModal.mimeType, showFileModal.filename)}
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {showFileModal.filename}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {showFileModal.size ? `${(showFileModal.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
              </div>
              <a
                href={`${backendUrl}${showFileModal.url}`}
                download={showFileModal.filename}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <FaDownload />
                <span>Download File</span>
              </a>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 rounded-lg p-3">
          <div className="text-sm font-medium">{showFileModal.filename}</div>
          {showFileModal.size && (
            <div className="text-xs opacity-75">
              {showFileModal.size ? `${(showFileModal.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const renderVoiceRecorder = () => {
  if (!showVoiceRecorder) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-80 shadow-xl">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className={clsx(
              "w-3 h-3 rounded-full animate-pulse",
              isRecording ? "bg-red-500" : "bg-gray-400"
            )} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isRecording ? "Recording..." : "Processing..."}
            </span>
          </div>
          
          <div className="text-2xl font-mono text-gray-800 dark:text-white mb-4">
            {voiceMessageUtils.formatDuration(recordingTime)}
          </div>

          {/* Waveform visualization */}
          <div className="flex items-end justify-center h-12 space-x-1 mb-4">
            {recordingWaveform.map((amplitude, index) => (
              <div
                key={index}
                className="w-1 bg-blue-500 rounded-full transition-all duration-100"
                style={{ height: `${amplitude * 40}px` }}
              />
            ))}
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={cancelVoiceRecording}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={stopVoiceRecording}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <BsStopFill />
              <span>Stop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const renderCallModal = () => {
  if (!callModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 max-w-full mx-4 shadow-xl">
        {/* Incoming Call */}
        {callModal === 'incoming' && incomingCall && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl">
              <FaUser />
            </div>
            
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              {incomingCall.caller.name}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              {incomingCall.callType === 'video' ? 'Video' : 'Audio'} Call...
            </p>
            
            <div className="flex justify-center space-x-4 mt-6">
              <button
                onClick={rejectCall}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <FaPhoneSlash size={20} />
              </button>
              
              <button
                onClick={acceptCall}
                className="w-12 h-12 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <FaPhone size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Outgoing Call */}
        {callModal === 'outgoing' && activeCall && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl">
              <FaUser />
            </div>
            
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              {activeCall.recipient.name}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Calling...
            </p>
            
            <div className="flex justify-center mt-6">
              <button
                onClick={endCall}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <FaPhoneSlash size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Active Call */}
        {callModal === 'active' && activeCall && (
          <div className="text-center">
            {/* Video feeds */}
            <div className="relative bg-black rounded-lg mb-4 h-48">
              {remoteStream && (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                />
              )}
              
              {localStream && activeCall.callType === 'video' && (
                <div className="absolute bottom-2 right-2 w-20 h-32 bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">
              {activeCall.recipient.name}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {callUtils.formatCallDuration(callDuration)}
            </p>

            <div className="flex justify-center space-x-4">
              <button
                onClick={toggleMute}
                className={clsx(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                  isMuted 
                    ? "bg-red-500 hover:bg-red-600 text-white" 
                    : "bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                )}
              >
                {isMuted ? <FaVolumeMute size={20} /> : <FaVolumeUp size={20} />}
              </button>

              {activeCall.callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={clsx(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    isVideoOff
                      ? "bg-red-500 hover:bg-red-600 text-white" 
                      : "bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                  )}
                >
                  {isVideoOff ? <FaVideoSlash size={20} /> : <FaVideo size={20} />}
                </button>
              )}

              <button
                onClick={endCall}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <FaPhoneSlash size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const renderReactionModal = () => {
  if (!reactingToMessage) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl">
        <div className="text-center mb-3">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Add reaction
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded p-2">
            {reactingToMessage.body?.substring(0, 50)}{reactingToMessage.body?.length > 50 ? '...' : ''}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {EMOJI_REACTIONS.map(({ emoji, label, icon }) => (
            <button
              key={emoji}
              onClick={() => reactToMessage(reactingToMessage._id, emoji)}
              className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-2xl"
              title={label}
            >
              {emoji}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setReactingToMessage(null)}
          className="w-full mt-3 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const renderForwardModal = () => {
  if (!forwardingMessage) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 max-w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Forward Message
        </h3>
        
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {forwardingMessage.body?.substring(0, 100)}{forwardingMessage.body?.length > 100 ? '...' : ''}
          </div>
          {forwardingMessage.attachments && forwardingMessage.attachments.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {forwardingMessage.attachments.length} attachment{forwardingMessage.attachments.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
        
        <div className="flex space-x-3 mt-6">
          <button
            onClick={() => setForwardingMessage(null)}
            className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => forwardMessage(forwardingMessage._id, { recipients: [], events: [] })}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Forward
          </button>
        </div>
      </div>
    </div>
  );
};

// Utility Functions
const getFileIcon = (mimeType, filename) => {
  if (mimeType?.startsWith('image/')) return <FaRegImage />;
  if (mimeType?.startsWith('audio/')) return <FaFileAudio />;
  if (mimeType?.startsWith('video/')) return <FaVideoIcon />;
  
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FaRegFilePdf />;
  if (['doc', 'docx'].includes(ext)) return <FaRegFileWord />;
  if (['xls', 'xlsx'].includes(ext)) return <FaRegFileExcel />;
  if (['ppt', 'pptx'].includes(ext)) return <FaRegFilePowerpoint />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FaArchive />;
  if (['txt', 'rtf', 'md'].includes(ext)) return <FaFile />;
  
  return <FaFile />;
};

const toggleAudioPlayback = async (messageId, audioUrl) => {
  try {
    setError(null);
    
    if (audioPlaying === messageId) {
      if (audioRef.current) {
        audioRef.current.pause();
        setAudioPlaying(null);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audioElement = audioRef.current;
      
      // Use environment variable for backend URL
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const fullAudioUrl = audioUrl.startsWith('http') 
        ? audioUrl 
        : `${backendBaseUrl}${audioUrl}`;

      console.log('Audio URL:', fullAudioUrl);

      // Test if file exists before trying to play
      try {
        const response = await fetch(fullAudioUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Audio file not found (${response.status})`);
        }
        console.log('✅ Audio file is accessible');
      } catch (fetchError) {
        console.error('❌ Audio file not accessible:', fetchError);
        setError('Audio file not found on server');
        return;
      }

      audioElement.src = fullAudioUrl;
      
      audioElement.onended = () => {
        setAudioPlaying(null);
      };
      
      audioElement.onerror = (e) => {
        console.error('Audio error:', e);
        setError('Failed to play audio format');
        setAudioPlaying(null);
      };

      await audioElement.play();
      setAudioPlaying(messageId);
    }
  } catch (error) {
    console.error('Error in toggleAudioPlayback:', error);
    setError(`Playback failed: ${error.message}`);
    setAudioPlaying(null);
  }
};

const getAudioProgress = (messageId) => {
  const audio = audioRefs.current[messageId];
  if (!audio || !audio.duration) return 0;
  return (audio.currentTime / audio.duration) * 100;
};

const handleAudioTimeUpdate = (messageId, event) => {
  // This function is called when audio playback time updates
  // We can use this to update progress bars if needed
};
  // ... (All the render functions from the previous response remain the same)
  // renderMessage, renderAttachments, renderFileModal, renderFilePreviews, 
  // renderVoiceRecorder, renderCallModal, renderReactionModal, renderForwardModal
  // getFileIcon, toggleAudioPlayback, getAudioProgress, handleAudioTimeUpdate

  // Due to character limits, I'm including the most critical render functions:

  const renderChatHeader = () => {
    if (!activeChat) return null;

    return (
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
                ? (activeChat.user?.avatar || "/default-avatar.png")
                : "/group-avatar.png"
              }
              alt={activeChat.type === 'individual' ? (activeChat.user?.name || 'User') : (activeChat.name || 'Group')}
              className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
            />
            {activeChat.type === 'individual' && activeChat.user && onlineUsers.has(activeChat.user._id) && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-800 dark:text-white">
              {activeChat.type === 'individual' ? (activeChat.user?.name || 'Unknown User') : (activeChat.name || 'Group Chat')}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {activeChat.type === 'individual' 
                ? (activeChat.user ? (onlineUsers.has(activeChat.user._id) ? "Online" : "Offline") : "User")
                : `${activeChat.participantsCount || 0} participants`
              }
              {typingUsers[activeChat.type === 'individual' ? (activeChat.user?._id || '') : 'group'] && (
                <span className="text-blue-500 ml-2">typing...</span>
              )}
            </div>
          </div>
        </div>
        
        {activeChat.type === 'individual' && activeChat.user && (
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => initiateCall('audio')}
              className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-full transition-colors"
            >
              <FaPhone size={16} />
            </button>
            <button 
              onClick={() => initiateCall('video')}
              className="p-2 text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900 rounded-full transition-colors"
            >
              <FaVideoCall size={16} />
            </button>
            <button 
              onClick={() => setShowChatInfo(true)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <FaInfoCircle size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderMessageInput = () => {
    if (!activeChat) return null;

    return (
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex-shrink-0">
        {/* File Previews */}
        {filePreviews.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {filePreviews.length} file{filePreviews.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => {
                  setSelectedFiles([]);
                  setFilePreviews([]);
                  filePreviews.forEach(preview => URL.revokeObjectURL(preview.url));
                }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Clear all
              </button>
            </div>
            <button
              onClick={sendFiles}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
            >
              Send {filePreviews.length} file{filePreviews.length > 1 ? 's' : ''}
            </button>
          </div>
        )}

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
          {/* Voice recording button */}
          <button
            onMouseDown={startVoiceRecording}
            onMouseUp={stopVoiceRecording}
            onTouchStart={startVoiceRecording}
            onTouchEnd={stopVoiceRecording}
            onMouseLeave={cancelVoiceRecording}
            className={clsx(
              "p-2 rounded-full transition-colors",
              isRecording 
                ? "bg-red-500 text-white animate-pulse" 
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            <BsMicFill size={16} />
          </button>

          {/* Attachment button */}
          <button 
            onClick={() => setShowAttachments(!showAttachments)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <FaPlus size={16} />
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
            <IoMdSend size={16} />
          </button>
        </div>

        {/* Attachment dropdown */}
        {showAttachments && (
          <div className="absolute bottom-16 left-4 bg-white dark:bg-gray-700 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 p-2 min-w-48 z-10">
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
    );
  };

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
      {renderChatHeader()}

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 relative"
      >
        <div className="absolute inset-0 p-4">
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <FaComments size={64} className="mb-4 opacity-30" />
              <div className="text-lg mb-2">Select a chat to start messaging</div>
              <div className="text-sm text-center">
                Choose a conversation from the sidebar to begin chatting
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-sm">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <FaComments size={64} className="mb-4 opacity-30" />
              <div className="text-lg mb-2">No messages yet</div>
              <div className="text-sm text-center">
                Start a conversation with {activeChat.type === 'individual' ? (activeChat.user?.name || 'this user') : 'the group'} 👋
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

      {/* Voice Recorder Modal */}
      {renderVoiceRecorder()}

      {/* Call Modal */}
      {renderCallModal()}

      {/* File Modal */}
      {renderFileModal()}

      {/* Reaction Modal */}
      {renderReactionModal()}

      {/* Forward Modal */}
      {renderForwardModal()}

      {/* Close overlays when clicking outside */}
      {showAttachments && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setShowAttachments(false)}
        />
      )}
    </div>
  );
};

export default ChatWindow;