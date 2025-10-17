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
  FaCircle, FaRegCircle, FaPhoneSlash, FaVideoSlash,
  FaCheck, FaCopy, FaEdit, FaUsers
} from "react-icons/fa";
import { IoMdSend } from "react-icons/io";
import { BsMicFill, BsStopFill } from "react-icons/bs";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { io as ioClient } from "socket.io-client";
import clsx from "clsx";
import { useAppContext } from "../../../context/AppContext";
import useMessageService, { voiceMessageUtils, callUtils } from "../../../services/messageService";
import useAdminService from "../../../services/adminService";

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
  const adminService = useAdminService();
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
  
  // Call states
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callModal, setCallModal] = useState(null);
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
  
  // Message selection states
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [forwardingMultiple, setForwardingMultiple] = useState(false);
  const [availableChats, setAvailableChats] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedForwardTargets, setSelectedForwardTargets] = useState(new Set());
  
  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioRefs = useRef({});
  const recordingIntervalRef = useRef(null);
  const callDurationIntervalRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // ==================== LIFECYCLE & INITIALIZATION ====================

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

  useEffect(() => {
    if (propActiveChat && propActiveChat !== activeChat) {
      setActiveChat(propActiveChat);
      setMessages([]);
      setNewMessage("");
      setReplyingTo(null);
      setSelectedFiles([]);
      setFilePreviews([]);
      clearSelection();
    }
  }, [propActiveChat, activeChat]);

  useEffect(() => {
    if (!isMobile && activeChat) {
      const chatPath = `/messages/chat/${activeChat.type === "individual" ? activeChat.user?._id : activeChat.eventId}`;
      window.history.replaceState({}, '', chatPath);
    }
  }, [isMobile, activeChat]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);


  useEffect(() => {
    if (!isMobile && activeChat) {
      const chatPath = `/messages/chat/${activeChat.type === "individual" ? activeChat.user?._id : activeChat.eventId}`;
      window.history.replaceState({}, '', chatPath);
    }
  }, [isMobile, activeChat]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

// Enhanced Socket connection with all features
useEffect(() => {
  if (!backendUrl || !token || !activeChat || !user?._id) return;

  console.log("🔌 Connecting to socket...");
  const s = ioClient(backendUrl, {
    transports: ["websocket"],
    auth: { 
      token,
      userId: user._id  // ADD THIS - crucial for backend room joining
    },
  });
  setSocket(s);

  // Real-time event handlers
  s.on("connect", () => {
    console.log("✅ Socket connected with ID:", s.id);
    // The backend should automatically handle room joining with the userId from auth
    // But you can also explicitly emit if needed:
    s.emit('user-online', { 
      userId: user._id,
      socketId: s.id 
    });
  });

  s.on("disconnect", (reason) => {
    console.log("🔴 Socket disconnected:", reason);
  });

  s.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error);
  });

 // Add this to see all incoming events for debugging
  s.onAny((eventName, ...args) => {
    console.log("📡 Incoming socket event:", eventName, args);
  });

  s.on("newMessage", (msg) => {
    console.log("📨 New message received:", msg);
    handleNewMessage(msg);
  });

  s.on("forwardedMessage", (data) => {
    console.log("📨 Forwarded message received via forwardedMessage event:", data);
    if (data.message) {
      handleNewMessage(data.message);
    }
  });

  s.on("forwardedToGroup", (data) => {
    console.log("📨 Forwarded group message received:", data);
    if (data.message && activeChat?.eventId === data.eventId) {
      handleNewMessage(data.message);
    }
  });

  s.on("messageForwarded", (data) => {
    console.log("🔄 Message forwarding completed:", data);
    // Update optimistic messages with real message data
    setMessages(prev => 
      prev.map(msg => 
        msg.isOptimistic && msg._id === data.optimisticId 
          ? { ...data.message, isOptimistic: false }
          : msg
      )
    );
  });

  // ADD THIS - Forward error handling
  s.on("forwardError", (data) => {
    console.error("❌ Forward error:", data);
    setError(data.error || "Failed to forward message");
    
    // Remove optimistic messages on error
    setMessages(prev => prev.filter(msg => !msg.isOptimistic));
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

  // Call events - FIXED EVENT NAME CONSISTENCY
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

  // Reaction events
  s.on("messageReaction", (data) => {
    console.log("🎭 Message reaction:", data);
    handleMessageReaction(data);
  });

  // Message status events
  s.on("messageStatus", (data) => {
    console.log("📊 Message status update:", data);
    handleMessageStatusUpdate(data);
  });

  s.on("messagesRead", (data) => {
    console.log("👀 Messages read:", data);
    handleMessagesRead(data);
  });

  return () => {
    console.log("🧹 Cleaning up socket connection");
    s.disconnect();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
  };
}, [backendUrl, token, activeChat, user]);

  useEffect(() => {
    if (activeChat) {
      loadMessages();
      loadStarredMessages();
    }
  }, [activeChat]);

  // ==================== VOICE MESSAGING FUNCTIONS ====================

  const getAudioDuration = (blob) => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.src = url;
      const onLoaded = () => {
        cleanup();
        resolve(audio.duration);
      };
      const onError = (e) => {
        cleanup();
        reject(e);
      };
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        URL.revokeObjectURL(url);
      };
      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);
    });
  };
const startVoiceRecording = async () => {
  try {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onerror = (err) => {
      console.error('Recorder error:', err);
      cleanupRecording();
      setError('Recording failed');
    };

    recorder.onstart = () => {
      setIsRecording(true);
      setShowVoiceRecorder(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
        // Generate random waveform for visualization
        setRecordingWaveform(prev => [...prev.slice(-49), Math.random() * 0.8 + 0.2]);
      }, 100);
      console.log('Recorder started');
    };

    // REMOVED: Don't define onstop here - define it in stopVoiceRecording only

    recorder.start();
  } catch (err) {
    console.error('Error starting recording', err);
    setError('Microphone access denied or not available.');
    cleanupRecording();
  }
};

const stopVoiceRecording = async () => {
  const recorder = mediaRecorderRef.current;
  if (recorder && recorder.state !== 'inactive') {
    // Set the onstop handler BEFORE stopping
    recorder.onstop = async () => {
      try {
        clearInterval(recordingIntervalRef.current);

        const chunks = chunksRef.current;
        if (!chunks || chunks.length === 0) {
          console.warn('No audio data recorded');
          cleanupRecording();
          return;
        }

        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const duration = await getAudioDuration(audioBlob);

        if (duration < 0.3) {
          console.warn('Recording too short, ignoring');
          cleanupRecording();
          return;
        }

        // Create proper File object
        const fileName = `voice-message-${Date.now()}.webm`;
        const voiceFile = new File([audioBlob], fileName, { 
          type: 'audio/webm',
          lastModified: Date.now()
        });

        console.log('Voice file details:', {
          name: voiceFile.name,
          size: voiceFile.size,
          type: voiceFile.type,
          lastModified: voiceFile.lastModified
        });

        // Prepare data for service call
        const voiceData = {
          voiceFile: voiceFile,
          duration: Math.round(duration),
        };

        // Add optional fields
        if (activeChat?.type === 'individual') {
          voiceData.recipientId = activeChat.user._id;
        }
        if (activeChat?.type === 'event') {
          voiceData.eventId = activeChat.eventId;
        }
        if (replyingTo) {
          voiceData.replyTo = replyingTo._id;
        }

        try {
          const waveform = await voiceMessageUtils.generateWaveformSafe(audioBlob);
          voiceData.waveform = waveform;
        } catch (wfErr) {
          console.warn('Waveform generation failed', wfErr);
        }

        // Call the service with proper object structure
        console.log('Sending voice message with data:', voiceData);
        const res = await messageService.sendVoiceMessage(voiceData);
        const newMessageObj = res.data;
        setMessages(prev => [...prev, newMessageObj]);
        setReplyingTo(null);
        
      } catch (err) {
        console.error('Error processing voice on stop:', err);
        setError('Failed to process recorded audio: ' + err.message);
      } finally {
        cleanupRecording();
      }
    };

    // Now stop the recorder
    recorder.stop();
  } else {
    cleanupRecording();
  }
};

const cancelVoiceRecording = () => {
  const recorder = mediaRecorderRef.current;
  if (recorder && recorder.state !== 'inactive') {
    // Set a simple cleanup handler for cancellation
    recorder.onstop = () => {
      console.log('Recording cancelled');
      cleanupRecording();
    };
    recorder.stop();
  } else {
    cleanupRecording();
  }
};

const cleanupRecording = () => {
  clearInterval(recordingIntervalRef.current);
  setRecordingTime(0);
  setIsRecording(false);
  setShowVoiceRecorder(false);
  setRecordingWaveform([]);

  if (streamRef.current) {
    streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  mediaRecorderRef.current = null;
  chunksRef.current = [];
};

  // ==================== CALL MANAGEMENT FUNCTIONS ====================

  const initiateCall = async (callType = 'audio') => {
    if (!activeChat || activeChat.type !== 'individual' || !activeChat.user) {
      setError("Cannot initiate call. Please select a valid chat.");
      return;
    }

    try {
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
      
      setCallDuration(0);
      callDurationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
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

      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            targetUserId: activeChat.user._id,
            candidate: event.candidate,
            callId: callId
          });
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

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

  // ==================== REACTION FUNCTIONS ====================

  const handleMessageReaction = (data) => {
    setMessages(prev => prev.map(msg => 
      msg._id === data.messageId 
        ? { 
            ...msg, 
            reactions: [...(msg.reactions || []).filter(r => r.userId !== data.userId), { 
              userId: data.userId, 
              emoji: data.emoji, 
              reactedAt: new Date() 
            }] 
          }
        : msg
    ));
  };

  const reactToMessage = async (messageId, emoji) => {
    try {
      await messageService.reactToMessage(messageId, emoji);
      
      setMessages(prev => prev.map(msg => 
        msg._id === messageId 
          ? { 
              ...msg, 
              reactions: [...(msg.reactions || []).filter(r => r.userId !== user._id), { 
                userId: user._id, 
                emoji, 
                reactedAt: new Date() 
              }] 
            }
          : msg
      ));
      
      if (socket) {
        socket.emit('messageReaction', {
          messageId,
          emoji,
          userId: user._id
        });
      }
      
      setReactingToMessage(null);
      
    } catch (error) {
      console.error("❌ Error reacting to message:", error);
      setError("Failed to add reaction. Please try again.");
    }
  };

  // ==================== MESSAGE SELECTION FUNCTIONS ====================

  const toggleMessageSelection = (messageId) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      
      if (newSet.size > 0 && !isSelectionMode) {
        setIsSelectionMode(true);
      } else if (newSet.size === 0 && isSelectionMode) {
        setIsSelectionMode(false);
      }
      
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  const selectAllMessages = () => {
    const allMessageIds = new Set(messages.map(msg => msg._id));
    setSelectedMessages(allMessageIds);
    setIsSelectionMode(true);
  };

const deleteSelectedMessages = async (deleteForEveryone = false) => {
  if (selectedMessages.size === 0) return;

  try {
    const messageIds = Array.from(selectedMessages);
    
    // Call the bulk delete endpoint with delete option
    const response = await messageService.deleteMessages(messageIds, deleteForEveryone);
    
    // Handle the response based on deletion type
    const { data } = response;
    
    if (deleteForEveryone) {
      // Remove messages completely from state
      setMessages(prev => prev.filter(msg => !selectedMessages.has(msg._id)));
    } else {
      // For "delete for me only", you might want to mark them as deleted visually
      // or filter them out based on your UI needs
      setMessages(prev => prev.filter(msg => !selectedMessages.has(msg._id)));
    }
    
    clearSelection();
    setShowDeleteConfirm(false);
    
    const successMessage = data?.message || 
      `Successfully deleted ${data?.data?.totalDeleted || messageIds.length} message${(data?.data?.totalDeleted || messageIds.length) > 1 ? 's' : ''}`;
    
    setError(successMessage);
    setTimeout(() => setError(null), 3000);
    
  } catch (error) {
    console.error("❌ Error deleting messages:", error);
    const errorMessage = error.response?.data?.message || "Failed to delete messages. Please try again.";
    setError(errorMessage);
  }
};

const forwardSelectedMessages = async () => {
  if (selectedMessages.size === 0) return;

  try {
    setForwardingMultiple(true);
    
    let usersData = [];
    let conversationsData = [];

    try {
      // Get all users from admin service
      const usersRes = await adminService.getAllUsers();
      usersData = usersRes.data?.data || usersRes.data || [];
      console.log(`✅ Loaded ${usersData.length} users from admin service`);
    } catch (userError) {
      console.error("❌ Error loading users:", userError);
      usersData = [];
    }

    try {
      // Get conversations (which includes individual chats and events)
      if (messageService.getConversations) {
        const conversationsRes = await messageService.getConversations();
        conversationsData = conversationsRes.data?.data || conversationsRes.data || [];
        console.log(`✅ Loaded ${conversationsData.length} conversations`);
      } else {
        console.log("ℹ️ getConversations method not available");
        conversationsData = [];
      }
    } catch (conversationError) {
      console.error("❌ Error loading conversations:", conversationError);
      conversationsData = [];
    }

    // Process the data
    const processedData = processForwardTargets(usersData, conversationsData);
    
    setAvailableUsers(processedData.users);
    setAvailableChats(processedData.events);
    setSelectedForwardTargets(new Set());

    // Show info if no targets available
    if (processedData.users.length === 0 && processedData.events.length === 0) {
      console.warn("⚠️ No users or events available for forwarding");
    }
    
  } catch (error) {
    console.error("❌ Unexpected error preparing to forward messages:", error);
    setError("An unexpected error occurred while loading forwarding options.");
    setForwardingMultiple(false);
  }
};

// Helper function to process forward targets
const processForwardTargets = (usersData, conversationsData) => {
  // Extract individual users from conversations
  const individualUsersFromConversations = conversationsData
    .filter(conv => conv.type === 'individual' && conv.user)
    .map(conv => ({
      ...conv.user,
      // Ensure we have all required fields
      _id: conv.user._id,
      name: conv.user.name || 'Unknown User',
      email: conv.user.email || '',
      avatar: conv.user.avatar || '/default-avatar.png'
    }));

  // Extract events/groups from conversations
  const eventsFromConversations = conversationsData
    .filter(conv => conv.type === 'event')
    .map(conv => ({
      _id: conv.eventId || conv._id,
      name: conv.name || 'Unnamed Event',
      description: conv.description || '',
      participantsCount: conv.participantsCount || 0,
      participantsInfo: conv.participantsInfo || [],
      type: 'event',
      avatar: '/group-avatar.png' // Default group avatar
    }));

  // Combine all users and remove duplicates
  const allUsers = [...usersData, ...individualUsersFromConversations];
  const uniqueUsers = allUsers.filter((user, index, self) => 
    index === self.findIndex(u => u._id === user._id)
  );

  return {
    users: uniqueUsers,
    events: eventsFromConversations
  };
};

const toggleTargetSelection = (targetId) => {
  setSelectedForwardTargets(prev => {
    const newSet = new Set(prev);
    if (newSet.has(targetId)) {
      newSet.delete(targetId);
    } else {
      newSet.add(targetId);
    }
    return newSet;
  });
};
const createOptimisticForwardedMessages = (originalMessages, recipients, events) => {
  const optimisticMessages = [];
  const timestamp = Date.now();
  
  originalMessages.forEach((originalMsg, index) => {
    // Create optimistic messages for each recipient
    recipients.forEach(recipientId => {
      const optimisticId = `optimistic-${timestamp}-${recipientId}-${originalMsg._id}-${index}`;
      const optimisticMsg = {
        _id: optimisticId,
        optimisticId: optimisticId, // Keep reference for replacement
        sender: user,
        recipient: recipientId,
        body: originalMsg.body,
        type: originalMsg.type,
        attachments: originalMsg.attachments ? [...originalMsg.attachments] : [],
        forwardedFrom: {
          messageId: originalMsg._id,
          originalSender: originalMsg.sender,
          originalMessage: originalMsg.body?.substring(0, 100),
          forwardedAt: new Date(),
          forwardedBy: user.name
        },
        status: 'sent',
        sentAt: new Date(),
        isOptimistic: true,
        createdAt: new Date(),
        // Include all necessary fields for rendering
        ...(originalMsg.type === 'voice' && { 
          attachments: originalMsg.attachments?.map(att => ({
            ...att,
            type: 'voice'
          }))
        })
      };
      optimisticMessages.push(optimisticMsg);
    });

    // Create optimistic messages for each event
    events.forEach(eventId => {
      const optimisticId = `optimistic-${timestamp}-${eventId}-${originalMsg._id}-${index}`;
      const optimisticMsg = {
        _id: optimisticId,
        optimisticId: optimisticId, // Keep reference for replacement
        sender: user,
        eventId: eventId,
        body: originalMsg.body,
        type: originalMsg.type,
        attachments: originalMsg.attachments ? [...originalMsg.attachments] : [],
        forwardedFrom: {
          messageId: originalMsg._id,
          originalSender: originalMsg.sender,
          originalMessage: originalMsg.body?.substring(0, 100),
          forwardedAt: new Date(),
          forwardedBy: user.name
        },
        status: 'sent',
        sentAt: new Date(),
        isOptimistic: true,
        createdAt: new Date(),
        // Include all necessary fields for rendering
        ...(originalMsg.type === 'voice' && { 
          attachments: originalMsg.attachments?.map(att => ({
            ...att,
            type: 'voice'
          }))
        })
      };
      optimisticMessages.push(optimisticMsg);
    });
  });
  
  return optimisticMessages;
};
const executeForward = async () => {
  if (selectedMessages.size === 0 || selectedForwardTargets.size === 0) return;

  try {
    const messageIds = Array.from(selectedMessages);
    const targets = Array.from(selectedForwardTargets);
    
    const recipients = targets.filter(target => 
      availableUsers.some(user => user._id === target)
    );
    const events = targets.filter(target => 
      availableChats.some(chat => chat._id === target)
    );

    console.log("🚀 STARTING FORWARD PROCESS");
    console.log("📤 Forwarding details:", { 
      messageIds, 
      recipients, 
      events,
      socketConnected: !!socket,
      socketId: socket?.id 
    });

    // Create optimistic updates
    const originalMessages = messages.filter(msg => selectedMessages.has(msg._id));
    const optimisticMessages = createOptimisticForwardedMessages(originalMessages, recipients, events);

    console.log("🎯 Created optimistic messages:", optimisticMessages.length);

    // Add optimistic messages to current chat
    optimisticMessages.forEach(msg => {
      if (shouldAddToActiveChat(msg)) {
        console.log("➕ Adding optimistic message to current chat:", msg._id);
        setMessages(prev => [...prev, msg]);
      }
      
      // EMIT SOCKET EVENTS FOR REAL-TIME DELIVERY
      if (socket) {
        if (msg.recipient) {
          console.log("📤 Emitting forwardedMessage to recipient:", msg.recipient);
          socket.emit('forwardedMessage', {
            message: msg,
            recipientId: msg.recipient,
            forwardedBy: user
          });
        } else if (msg.eventId) {
          console.log("📤 Emitting forwardedToGroup to event:", msg.eventId);
          socket.emit('forwardedToGroup', {
            message: msg,
            eventId: msg.eventId,
            forwardedBy: user
          });
        }
      } else {
        console.error("❌ No socket connection available!");
      }
    });

    scrollToBottom();
    setError(`🔄 Forwarding ${messageIds.length} message${messageIds.length > 1 ? 's' : ''}...`);

    // API call
    let response;
    if (messageIds.length === 1) {
      console.log("📡 Calling forwardMessage API");
      response = await messageService.forwardMessage(messageIds[0], { recipients, events });
    } else {
      console.log("📡 Calling forwardMessages API");
      response = await messageService.forwardMessages(messageIds, { recipients, events });
    }

    console.log("✅ Forward API response:", response.data);

    // Close modal and reset
    setForwardingMultiple(false);
    clearSelection();
    setAvailableChats([]);
    setAvailableUsers([]);
    setSelectedForwardTargets(new Set());

    setError(`✅ Successfully forwarded ${messageIds.length} message${messageIds.length > 1 ? 's' : ''}`);
    setTimeout(() => setError(null), 3000);

  } catch (error) {
    console.error("❌ Error forwarding messages:", error);
    setMessages(prev => prev.filter(msg => !msg.isOptimistic));
    setError(error.response?.data?.message || "Failed to forward messages");
  }
};
  const copySelectedMessages = () => {
    if (selectedMessages.size === 0) return;

    const selectedMessagesText = messages
      .filter(msg => selectedMessages.has(msg._id))
      .map(msg => {
        const sender = msg.sender?.name || 'You';
        const time = new Date(msg.createdAt).toLocaleTimeString();
        return `[${time}] ${sender}: ${msg.body || '📎 Attachment'}`;
      })
      .join('\n');

    navigator.clipboard.writeText(selectedMessagesText)
      .then(() => {
        setError('Messages copied to clipboard');
        setTimeout(() => setError(null), 2000);
      })
      .catch(() => {
        setError('Failed to copy messages');
      });
  };

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

  const sendMessage = async (text = null, attachments = []) => {
    const messageText = text || newMessage.trim();
    if ((!messageText && attachments.length === 0 && selectedFiles.length === 0) || !activeChat) return;
    
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
  
  // For optimistic messages, check if they belong to current chat
  if (msg.isOptimistic) {
    if (activeChat.type === 'individual') {
      return msg.recipient === activeChat.user?._id;
    } else {
      return msg.eventId === activeChat.eventId;
    }
  }
  
  // Regular message logic
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
        clearSelection();
      }

    } catch (err) {
      console.error("❌ Failed to load messages:", err);
      setError("Failed to load messages. Please try again.");
    } finally {
      setLoadingMessages(false);
    }
  };

const forwardMessage = async (messageId, targets) => {
  try {
    const { recipients = [], events = [] } = targets;
    
    console.log("📤 Forwarding single message:", { messageId, recipients, events });

    // Get the original message for optimistic update
    const originalMessage = messages.find(msg => msg._id === messageId);
    if (!originalMessage) {
      throw new Error("Original message not found");
    }

    // Create optimistic updates for immediate UI feedback
    const optimisticMessages = createOptimisticForwardedMessages([originalMessage], recipients, events);
    
    // Add optimistic messages to current chat if applicable
    optimisticMessages.forEach(msg => {
      if (shouldAddToActiveChat(msg)) {
        setMessages(prev => [...prev, msg]);
      }
      
      // EMIT SOCKET EVENT FOR REAL-TIME DELIVERY TO RECIPIENT
      if (socket && !msg.isOptimistic) {
        if (msg.recipient) {
          // Individual chat - emit to specific user
          socket.emit('forwardedMessage', {
            message: msg,
            recipientId: msg.recipient,
            forwardedBy: user
          });
        } else if (msg.eventId) {
          // Group/Event chat - emit to all participants
          socket.emit('forwardedToGroup', {
            message: msg,
            eventId: msg.eventId,
            forwardedBy: user
          });
        }
      }
    });

    scrollToBottom();

    // Show immediate feedback
    setError(`🔄 Forwarding message...`);

    // Use the single message forward endpoint
    const response = await messageService.forwardMessage(messageId, { recipients, events });
    
    console.log("✅ Forward message response:", response.data);

    // Replace optimistic messages with real ones from server
    const realMessages = response.data.forwardedMessages || [response.data];
    
    setMessages(prev => 
      prev.map(msg => 
        msg.isOptimistic && realMessages.find(realMsg => 
          realMsg.optimisticId === msg._id || realMsg.body === msg.body
        ) 
          ? realMessages.find(realMsg => realMsg.optimisticId === msg._id || realMsg.body === msg.body)
          : msg
      )
    );

    setForwardingMessage(null);
    setSelectedForwardTargets(new Set());

    // Show success message
    setError(`✅ Message forwarded to ${recipients.length + events.length} conversation${recipients.length + events.length > 1 ? 's' : ''}`);
    setTimeout(() => setError(null), 3000);
    
  } catch (error) {
    console.error("❌ Error forwarding message:", error);
    
    // Remove optimistic messages on error
    setMessages(prev => prev.filter(msg => !msg.isOptimistic));
    
    const errorMessage = error.response?.data?.message || "Failed to forward message. Please try again.";
    setError(errorMessage);
  }
};


const forwardMultipleMessages = async (messageIds, targets) => {
  try {
    const { recipients = [], events = [] } = targets;
    
    console.log("📤 Forwarding multiple messages:", { messageIds, recipients, events });

    // Get the original messages for optimistic updates
    const originalMessages = messages.filter(msg => messageIds.includes(msg._id));
    if (originalMessages.length === 0) {
      throw new Error("No original messages found");
    }

    // Create optimistic updates for immediate UI feedback
    const optimisticMessages = createOptimisticForwardedMessages(originalMessages, recipients, events);
    
    // Add optimistic messages to current chat if applicable
    optimisticMessages.forEach(msg => {
      if (shouldAddToActiveChat(msg)) {
        setMessages(prev => [...prev, msg]);
      }
    });

    scrollToBottom();

    // Show immediate feedback
    setError(`🔄 Forwarding ${messageIds.length} message${messageIds.length > 1 ? 's' : ''}...`);

    // Use bulk forward endpoint
    const response = await messageService.forwardMessages(messageIds, { recipients, events });
    
    console.log("✅ Forward multiple messages response:", response.data);

    setForwardingMultiple(false);
    clearSelection();
    setSelectedForwardTargets(new Set());

    // Show success message
    setError(`✅ Successfully forwarded ${messageIds.length} message${messageIds.length > 1 ? 's' : ''} to ${recipients.length + events.length} target${recipients.length + events.length > 1 ? 's' : ''}`);
    setTimeout(() => setError(null), 3000);
    
  } catch (error) {
    console.error("❌ Error forwarding messages:", error);
    
    // Remove optimistic messages on error
    setMessages(prev => prev.filter(msg => !msg.isOptimistic));
    
    const errorMessage = error.response?.data?.message || "Failed to forward messages. Please try again.";
    setError(errorMessage);
  }
};




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
    if (!isMobile) {
      window.history.replaceState({}, '', '/messages');
    }
  };

  const handleMessageStatusUpdate = (data) => {
    setMessages(prev => prev.map(msg => 
      msg._id === data.messageId 
        ? { 
            ...msg, 
            status: data.status,
            ...(data.status === 'delivered' && { deliveredAt: data.deliveredAt }),
            ...(data.status === 'read' && { readAt: data.readAt, isRead: true })
          }
        : msg
    ));
  };

  const handleMessagesRead = (data) => {
    setMessages(prev => prev.map(msg => 
      data.messageIds.includes(msg._id) 
        ? { ...msg, isRead: true, readAt: data.readAt, status: 'read' }
        : msg
    ));
  };

  // ==================== AUDIO PLAYBACK FUNCTIONS ====================

  const toggleAudioPlayback = async (messageId, audioUrl) => {
    try {
      setError(null);
      
      // Stop currently playing audio if different message
      if (audioPlaying && audioPlaying !== messageId) {
        const currentAudio = audioRefs.current[audioPlaying];
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }

      // If clicking the same message that's currently playing, pause it
      if (audioPlaying === messageId) {
        const audioElement = audioRefs.current[messageId];
        if (audioElement) {
          audioElement.pause();
          setAudioPlaying(null);
        }
        return;
      }

      // Create or get audio element for this message
      let audioElement = audioRefs.current[messageId];
      
      if (!audioElement) {
        audioElement = new Audio();
        audioRefs.current[messageId] = audioElement;
        
        // Set up event listeners
        audioElement.addEventListener('ended', () => {
          setAudioPlaying(null);
        });
        
        audioElement.addEventListener('error', (e) => {
          console.error('Audio playback error:', e);
          setError('Failed to play audio. The file may be corrupted or in an unsupported format.');
          setAudioPlaying(null);
        });
      }

      // Build the correct audio URL
      const fullAudioUrl = getAuthenticatedAudioUrl(audioUrl);

      console.log('Attempting to play audio from:', fullAudioUrl);

      // Check if the audio source is already set and different
      if (audioElement.src !== fullAudioUrl) {
        audioElement.src = fullAudioUrl;
      }

      // Add authentication token if needed
      if (token) {
        audioElement.crossOrigin = 'use-credentials';
      }

      try {
        await audioElement.play();
        setAudioPlaying(messageId);
        
      } catch (playError) {
        console.error('Play error:', playError);
        
        // Handle specific browser errors
        if (playError.name === 'NotSupportedError') {
          setError('Audio format not supported by your browser. Try using a different browser.');
        } else if (playError.name === 'NotAllowedError') {
          setError('Please allow audio playback in your browser settings.');
        } else {
          setError('Failed to play audio. The file may be corrupted or in an unsupported format.');
        }
        setAudioPlaying(null);
      }

    } catch (error) {
      console.error('Error in toggleAudioPlayback:', error);
      setError(`Playback failed: ${error.message}`);
      setAudioPlaying(null);
    }
  };

  const getAuthenticatedAudioUrl = (audioPath) => {
    if (!audioPath) return '';
    
    if (audioPath.startsWith('http')) {
      return audioPath;
    }
    
    // Ensure proper URL formatting
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    const cleanPath = audioPath.startsWith('/') ? audioPath : `/${audioPath}`;
    
    return `${baseUrl}${cleanPath}`;
  };

  // Audio element cleanup
  useEffect(() => {
    return () => {
      // Clean up all audio elements when component unmounts
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
          audio.load();
        }
      });
    };
  }, []);

  // ==================== RENDER FUNCTIONS ====================

  const renderSelectionToolbar = () => {
    if (!isSelectionMode || selectedMessages.size === 0) return null;

    return (
      <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white p-3 shadow-lg z-40">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={clearSelection}
              className="p-1 hover:bg-blue-600 rounded-full transition-colors"
            >
              <FaTimes size={16} />
            </button>
            <span className="font-medium">
              {selectedMessages.size} message{selectedMessages.size > 1 ? 's' : ''} selected
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={copySelectedMessages}
              className="p-2 hover:bg-blue-600 rounded-lg transition-colors flex items-center space-x-2 text-sm"
              title="Copy messages"
            >
              <FaCopy size={14} />
              <span>Copy</span>
            </button>
            
            <button
              onClick={forwardSelectedMessages}
              className="p-2 hover:bg-blue-600 rounded-lg transition-colors flex items-center space-x-2 text-sm"
              title="Forward messages"
            >
              <FaShare size={14} />
              <span>Forward</span>
            </button>
            
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 hover:bg-red-600 rounded-lg transition-colors flex items-center space-x-2 text-sm"
              title="Delete messages"
            >
              <FaTrash size={14} />
              <span>Delete</span>
            </button>
            
            {selectedMessages.size < messages.length && (
              <button
                onClick={selectAllMessages}
                className="p-2 hover:bg-blue-600 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                title="Select all messages"
              >
                <FaCheck size={14} />
                <span>Select All</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

const renderDeleteConfirmModal = () => {
  if (!showDeleteConfirm) return null;

  const canDeleteForEveryone = Array.from(selectedMessages).every(messageId => {
    const message = messages.find(msg => msg._id === messageId);
    return message?.sender?._id === user?._id;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 max-w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete Messages
        </h3>
        
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Are you sure you want to delete {selectedMessages.size} selected message{selectedMessages.size > 1 ? 's' : ''}?
        </p>

        {canDeleteForEveryone && (
          <div className="mb-4">
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                id="deleteForEveryone"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Delete for everyone</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This will remove the messages for all participants. Only available for messages you sent.
            </p>
          </div>
        )}
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const deleteForEveryone = document.getElementById('deleteForEveryone')?.checked || false;
              deleteSelectedMessages(deleteForEveryone);
            }}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

 const renderMultiForwardModal = () => {
  if (!forwardingMultiple) return null;

  const allTargets = [...availableUsers, ...availableChats];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 max-w-full mx-4 shadow-xl max-h-96 overflow-hidden flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Forward {selectedMessages.size} Message{selectedMessages.size > 1 ? 's' : ''}
        </h3>
        
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search users and groups..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => {
                // You can implement search filtering here
                const searchTerm = e.target.value.toLowerCase();
                // Filter logic would go here
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mb-4">
          {availableUsers.length === 0 && availableChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <div className="text-sm">Loading users and chats...</div>
            </div>
          ) : allTargets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <FaUsers size={32} className="mb-2 opacity-50" />
              <div className="text-sm">No users or chats available</div>
            </div>
          ) : (
            <div className="space-y-2">
              {allTargets.map(target => {
                const targetId = target._id;
                const targetName = target.name || 'Unknown';
                const targetAvatar = target.avatar || (target.type === 'event' ? '/group-avatar.png' : '/default-avatar.png');
                const targetType = target.type || 'user';
                const targetEmail = target.email || '';
                const participantsCount = target.participantsCount || 0;

                return (
                  <div
                    key={targetId}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                    onClick={() => toggleTargetSelection(targetId)}
                  >
                    <div className={clsx(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                      selectedForwardTargets.has(targetId)
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500"
                    )}>
                      {selectedForwardTargets.has(targetId) && <FaCheck size={8} />}
                    </div>
                    <img
                      src={targetAvatar}
                      alt={targetName}
                      className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                      onError={(e) => {
                        e.target.src = targetType === 'event' ? '/group-avatar.png' : '/default-avatar.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {targetName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center space-x-1">
                        {targetType === 'event' ? (
                          <>
                            <FaUsers size={10} />
                            <span>Group Chat • {participantsCount} members</span>
                          </>
                        ) : (
                          <>
                            <FaUser size={10} />
                            <span>{targetEmail || 'Direct Message'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {targetType === 'user' && onlineUsers.has(targetId) && (
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Online" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedForwardTargets.size} target{selectedForwardTargets.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setForwardingMultiple(false);
                setAvailableChats([]);
                setAvailableUsers([]);
                setSelectedForwardTargets(new Set());
              }}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={executeForward}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={selectedForwardTargets.size === 0}
            >
              Forward ({selectedForwardTargets.size})
            </button>
          </div>
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

  const allTargets = [...availableUsers, ...availableChats];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 max-w-full mx-4 shadow-xl max-h-96 overflow-hidden flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Forward Message
        </h3>
        
        {/* Message Preview */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {forwardingMessage.body?.substring(0, 100)}{forwardingMessage.body?.length > 100 ? '...' : ''}
          </div>
          {forwardingMessage.attachments && forwardingMessage.attachments.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
              <FaPaperclip size={10} />
              <span>{forwardingMessage.attachments.length} attachment{forwardingMessage.attachments.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {forwardingMessage.type === 'voice' && (
            <div className="text-xs text-blue-500 dark:text-blue-400 flex items-center space-x-1 mt-1">
              <BsMicFill size={10} />
              <span>Voice message</span>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search users and groups..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => {
                // You can implement search filtering here
                const searchTerm = e.target.value.toLowerCase();
                // Filter logic would go here
              }}
            />
          </div>
        </div>

        {/* Targets List */}
        <div className="flex-1 overflow-y-auto mb-4">
          {availableUsers.length === 0 && availableChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <div className="text-sm">Loading users and chats...</div>
            </div>
          ) : allTargets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <FaUsers size={32} className="mb-2 opacity-50" />
              <div className="text-sm">No users or chats available</div>
            </div>
          ) : (
            <div className="space-y-2">
              {allTargets.map(target => {
                const targetId = target._id;
                const targetName = target.name || 'Unknown';
                const targetAvatar = target.avatar || (target.type === 'event' ? '/group-avatar.png' : '/default-avatar.png');
                const targetType = target.type || 'user';
                const targetEmail = target.email || '';
                const participantsCount = target.participantsCount || 0;

                return (
                  <div
                    key={targetId}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                    onClick={() => toggleTargetSelection(targetId)}
                  >
                    <div className={clsx(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                      selectedForwardTargets.has(targetId)
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500"
                    )}>
                      {selectedForwardTargets.has(targetId) && <FaCheck size={8} />}
                    </div>
                    <img
                      src={targetAvatar}
                      alt={targetName}
                      className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                      onError={(e) => {
                        e.target.src = targetType === 'event' ? '/group-avatar.png' : '/default-avatar.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {targetName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center space-x-1">
                        {targetType === 'event' ? (
                          <>
                            <FaUsers size={10} />
                            <span>Group Chat • {participantsCount} members</span>
                          </>
                        ) : (
                          <>
                            <FaUser size={10} />
                            <span>{targetEmail || 'Direct Message'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {targetType === 'user' && onlineUsers.has(targetId) && (
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Online" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedForwardTargets.size} target{selectedForwardTargets.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setForwardingMessage(null);
                setSelectedForwardTargets(new Set());
              }}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const recipients = Array.from(selectedForwardTargets).filter(targetId => 
                  availableUsers.some(user => user._id === targetId)
                );
                const events = Array.from(selectedForwardTargets).filter(targetId => 
                  availableChats.some(chat => chat._id === targetId)
                );
                
                forwardMessage(forwardingMessage._id, { recipients, events });
              }}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={selectedForwardTargets.size === 0}
            >
              Forward ({selectedForwardTargets.size})
            </button>
          </div>
        </div>
      </div>
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

  const renderVoiceMessage = (attachment, messageId) => {
    const isPlaying = audioPlaying === messageId;
    
    return (
      <div className="p-3 flex items-center space-x-3">
        <button
          onClick={() => toggleAudioPlayback(messageId, attachment.url)}
          className={clsx(
            "p-3 rounded-full transition-colors flex-shrink-0",
            isPlaying 
              ? "bg-red-500 text-white" 
              : "bg-green-500 text-white hover:bg-green-600"
          )}
        >
          {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center space-x-2">
            <BsMicFill className="text-green-500" />
            <span>Voice message</span>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-300">
            {voiceMessageUtils.formatDuration(attachment.duration || 0)}
          </div>
          
          {attachment.waveform && attachment.waveform.length > 0 && (
            <div className="flex items-end space-x-px h-4 mt-1">
              {attachment.waveform.slice(0, 50).map((amplitude, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    "w-1 rounded-full transition-all duration-200",
                    isPlaying ? "bg-green-400" : "bg-green-300 dark:bg-green-600"
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
          onEnded={() => setAudioPlaying(null)}
          style={{ display: 'none' }}
        />
      </div>
    );
  };

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
                </div>
              </div>
            )}

            {attachment.type === 'voice' && renderVoiceMessage(attachment, messageId)}
            
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

  const renderMessage = (message) => {
    const mine = message.sender?._id === user?._id;
    const hasAttachments = message.attachments && message.attachments.length > 0;
    const isVoiceMessage = message.type === 'voice' || (hasAttachments && message.attachments.some(a => a.type === 'voice'));
    const messageReactions = message.reactions || [];
    const reactionCounts = {};
    const isSelected = selectedMessages.has(message._id);

    messageReactions.forEach(reaction => {
      reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
    });

    return (
      <div 
        key={message._id} 
        className={clsx(
          "flex group mb-4 relative",
          mine ? "justify-end" : "justify-start",
          isSelected && "bg-blue-50 dark:bg-blue-900 rounded-lg"
        )}
      >
        {isSelectionMode && (
          <div className={clsx(
            "absolute top-2 z-10",
            mine ? "right-2" : "left-2"
          )}>
            <button
              onClick={() => toggleMessageSelection(message._id)}
              className={clsx(
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                isSelected
                  ? "bg-blue-500 border-blue-500 text-white"
                  : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-500"
              )}
            >
              {isSelected && <FaCheck size={10} />}
            </button>
          </div>
        )}

        <div className={clsx("max-w-[85%] relative", mine ? "flex flex-col items-end" : "")}>
          
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

          <div
            className={clsx(
              "p-3 rounded-2xl relative group cursor-pointer",
              mine 
                ? "bg-blue-500 text-white rounded-br-none" 
                : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none shadow-sm border border-gray-200 dark:border-gray-600",
              isSelected && "ring-2 ring-blue-400"
            )}
            onClick={() => {
              if (isSelectionMode) {
                toggleMessageSelection(message._id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!isSelectionMode) {
                toggleMessageSelection(message._id);
              }
            }}
          >
            {message.forwardedFrom && (
              <div className={clsx(
                "text-xs mb-1 flex items-center space-x-1",
                mine ? "text-blue-200" : "text-gray-500 dark:text-gray-400"
              )}>
                <FaShare size={10} />
                <span>Forwarded</span>
              </div>
            )}

            {!mine && activeChat?.type === 'event' && (
              <div className="text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                {message.sender?.name}
              </div>
            )}

            {hasAttachments && renderAttachments(message.attachments, message._id)}
            
            {message.body && message.body !== 'Voice message' && (
              <div className={clsx(
                "text-sm whitespace-pre-wrap break-words",
                isVoiceMessage && "italic text-gray-600 dark:text-gray-400"
              )}>
                {message.body}
              </div>
            )}

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

            {!isSelectionMode && (
              <div className={clsx(
                "absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-1",
                mine 
                  ? "-top-2 -right-2" 
                  : "-top-2 -left-2"
              )}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReactingToMessage(message);
                  }}
                  className="p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                >
                  <FaSmile size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplyingTo(message);
                  }}
                  className="p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-green-500 dark:hover:text-green-400 transition-colors"
                >
                  <FaReply size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setForwardingMessage(message);
                  }}
                  className="p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                >
                  <FaShare size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStarMessage(message._id, starredMessages.has(message._id) ? 'unstar' : 'star');
                  }}
                  className={clsx(
                    "p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 transition-colors",
                    starredMessages.has(message._id) 
                      ? "text-yellow-500" 
                      : "text-gray-600 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400"
                  )}
                >
                  <FaStar size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMessageSelection(message._id);
                    setIsSelectionMode(true);
                  }}
                  className="p-1 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                >
                  <FaCheck size={12} />
                </button>
              </div>
            )}
          </div>

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
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
            />
          </div>

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
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

  // ==================== MAIN RENDER ====================

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      {/* Selection Toolbar */}
      {renderSelectionToolbar()}

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
        style={{ marginTop: isSelectionMode ? '60px' : '0' }}
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

      {/* All Modals */}
      {renderVoiceRecorder()}
      {renderCallModal()}
      {renderFileModal()}
      {renderReactionModal()}
      {renderForwardModal()}
      {renderDeleteConfirmModal()}
      {renderMultiForwardModal()}

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