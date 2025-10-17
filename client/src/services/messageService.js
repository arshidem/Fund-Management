import axios from 'axios';
import { useAppContext } from '../context/AppContext';

export const useMessageService = () => {
  const { token, backendUrl } = useAppContext();

  const createRequest = async (method, endpoint, data = null, options = {}) => {
    try {
      const config = {
        method,
        url: `${backendUrl}/api${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.isFormData ? {} : { 'Content-Type': 'application/json' })
        },
        params: options.params || undefined,
        data: data || undefined
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Message API Error:', error.response?.data || error.message);
      throw error;
    }
  };

  // ======== REAL-TIME FEATURES / LIGHT HTTP ========
  const sendTypingIndicator = (chatId, type = 'individual', isTyping = true) =>
    createRequest('POST', '/messages/typing', { chatId, type, isTyping });

  const updateMessageStatus = (messageId, status) =>
    createRequest('POST', '/messages/status', { messageId, status });

  const getOnlineUsers = (userIds = []) =>
    createRequest('GET', '/messages/online', null, { params: { userIds } });

  const getMessageStats = () =>
    createRequest('GET', '/messages/stats');

  // ======== CONVERSATIONS ========
  const getConversations = async (filters = {}) =>
    createRequest('GET', '/messages/conversations', null, { params: filters });

  const getChatHistory = async (chatId, type = 'individual', filters = {}) =>
    createRequest('GET', `/messages/history/${type}/${chatId}`, null, { params: filters });

  // ======== MESSAGES ========
  const sendMessage = async (messageData) =>
    createRequest('POST', '/messages/send', messageData);

  const sendMessageWithFiles = async (messageData) => {
    const formData = new FormData();
    messageData.files?.forEach(file => formData.append('files', file));
    ['recipientId', 'eventId', 'body', 'replyTo', 'type'].forEach(field => {
      if (messageData[field] !== undefined && messageData[field] !== null) {
        formData.append(field, messageData[field]);
      }
    });
    return createRequest('POST', '/messages/send-with-files', formData, { isFormData: true });
  };

  const sendAudioMessage = async (audioData) => {
    const formData = new FormData();
    if (audioData.audioFile) formData.append('audio', audioData.audioFile);
    if (audioData.recipientId) formData.append('recipientId', audioData.recipientId);
    if (audioData.eventId) formData.append('eventId', audioData.eventId);
    if (audioData.duration) formData.append('duration', audioData.duration);
    if (audioData.waveform) formData.append('waveform', JSON.stringify(audioData.waveform));
    return createRequest('POST', '/messages/send-audio', formData, { isFormData: true });
  };

  // ======== VOICE MESSAGES ========
  const sendVoiceMessage = async (voiceData) => {
    const formData = new FormData();
    if (voiceData.voiceFile) formData.append('voice', voiceData.voiceFile);
    if (voiceData.recipientId) formData.append('recipientId', voiceData.recipientId);
    if (voiceData.eventId) formData.append('eventId', voiceData.eventId);
    if (voiceData.duration) formData.append('duration', voiceData.duration.toString());
    if (voiceData.waveform) formData.append('waveform', JSON.stringify(voiceData.waveform));
    return createRequest('POST', '/messages/send-voice', formData, { isFormData: true });
  };

  const getVoiceMessages = async (chatId, type = 'individual', filters = {}) =>
    createRequest('GET', '/messages/voice-messages', null, { 
      params: { chatId, type, ...filters } 
    });

  const updateVoiceMessageStatus = async (messageId, statusData) =>
    createRequest('PATCH', `/messages/voice-messages/${messageId}/status`, statusData);

  // ======== CALL MANAGEMENT ========
  const initiateCall = async (callData) =>
    createRequest('POST', '/messages/calls/initiate', callData);

  const acceptCall = async (callId) =>
    createRequest('POST', '/messages/calls/accept', { callId });

  const rejectCall = async (callId, reason = 'rejected') =>
    createRequest('POST', '/messages/calls/reject', { callId, reason });

  const endCall = async (callId, duration = 0) =>
    createRequest('POST', '/messages/calls/end', { callId, duration });

  const getCallHistory = async (filters = {}) =>
    createRequest('GET', '/messages/calls/history', null, { params: filters });

  const getActiveCalls = async () =>
    createRequest('GET', '/messages/calls/active');

  // ======== MESSAGE ACTIONS ========
  const replyToMessage = (messageId, replyData) =>
    createRequest('POST', `/messages/${messageId}/reply`, replyData);

  const reactToMessage = (messageId, emoji) =>
    createRequest('POST', `/messages/${messageId}/react`, { emoji });

  const forwardMessage = (messageId, targets) =>
    createRequest('POST', `/messages/${messageId}/forward`, targets);

  const toggleStarMessage = (messageId, action = 'star') =>
    createRequest('POST', `/messages/${messageId}/star`, { action });

  const deleteMessage = (messageId, deleteForEveryone = false) =>
    createRequest('DELETE', `/messages/${messageId}`, { deleteForEveryone });

  const markAsRead = (chatId, type = 'individual', messageIds = []) =>
    createRequest('POST', '/messages/mark-read', { chatId, type, messageIds });

  const searchMessages = (query, filters = {}) =>
    createRequest('GET', '/messages/search', null, { params: { query, ...filters } });

  const getStarredMessages = (filters = {}) =>
    createRequest('GET', '/messages/starred', null, { params: filters });

  // ======== ADMIN ========
  const addInternalNote = (chatId, note, isPrivate = true) =>
    createRequest('POST', '/messages/internal-note', { chatId, note, isPrivate });

  // ======== QUICK MESSAGES ========
  const quickSendText = (recipientId, body) =>
    sendMessage({ recipientId, body, type: 'text' });

  const quickSendFile = (recipientId, file, body = '', type = 'files') => {
    const formData = new FormData();
    formData.append(type === 'audio' ? 'audio' : 'files', file);
    formData.append('recipientId', recipientId);
    formData.append('body', body);
    return createRequest('POST', type === 'audio' ? '/messages/send-audio' : '/messages/send-with-files', formData, { isFormData: true });
  };

  const quickSendVoice = (recipientId, voiceFile, duration, waveform = []) =>
    sendVoiceMessage({ recipientId, voiceFile, duration, waveform });

  // ======== FILE HELPERS ========
  const getFilePreviewUrl = (fileUrl, options = {}) => `${backendUrl}${fileUrl}?${new URLSearchParams(options)}`;
  const downloadFile = (fileUrl) => createRequest('GET', `/upload/download`, null, { params: { url: fileUrl } });

  return {
    // Real-time / light HTTP
    sendTypingIndicator,
    updateMessageStatus,
    getOnlineUsers,
    getMessageStats,

    // Conversations
    getConversations,
    getChatHistory,

    // Messages
    sendMessage,
    sendMessageWithFiles,
    sendAudioMessage,

    // Voice Messages
    sendVoiceMessage,
    getVoiceMessages,
    updateVoiceMessageStatus,

    // Call Management
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    getCallHistory,
    getActiveCalls,

    // Message Actions
    replyToMessage,
    reactToMessage,
    forwardMessage,
    toggleStarMessage,
    deleteMessage,
    markAsRead,
    searchMessages,
    getStarredMessages,

    // Admin
    addInternalNote,

    // Quick Messages
    quickSendText,
    quickSendFile,
    quickSendVoice,

    // File helpers
    getFilePreviewUrl,
    downloadFile
  };
};

// ======== SOCKET EVENT HANDLERS ========
export const setupMessageSocketHandlers = (socket, messageService) => {
  // Presence via socket events
  socket.emit('user-online', { socketId: socket.id });

  socket.on('disconnect', () => {
    socket.emit('user-offline', { socketId: socket.id });
  });

  // Typing indicators
  socket.on('start-typing', (data) => {
    socket.to(data.room).emit('user-typing', { userId: data.userId, isTyping: true });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.room).emit('user-typing', { userId: data.userId, isTyping: false });
  });

  // Message delivery/read events
  socket.on('message-delivered', (data) => {
    socket.emit('message-delivered', data);
  });

  socket.on('message-read', (data) => {
    socket.emit('message-read', data);
  });

  // ======== VOICE MESSAGE EVENTS ========
  socket.on('voice-message-playback', (data) => {
    socket.to(data.room).emit('voice-message-playback-update', data);
  });

  socket.on('voice-message-played', (data) => {
    // Update playback stats when voice message is played
    const { messageId, playTime } = data;
    messageService.updateVoiceMessageStatus(messageId, { 
      isPlaying: false, 
      playbackStats: { lastPlayedAt: new Date(), totalPlayTime: playTime } 
    });
  });

  // ======== CALL EVENTS ========
  socket.on('initiate-call', (data) => {
    const { recipientId, callType } = data;
    socket.to(`user-${recipientId}`).emit('incoming-call', {
      callId: data.callId,
      caller: data.caller,
      callType,
      timestamp: new Date()
    });
  });

  socket.on('accept-call', (data) => {
    const { callId, callerId } = data;
    socket.to(`user-${callerId}`).emit('call-accepted', {
      callId,
      acceptedBy: data.userId,
      timestamp: new Date()
    });
  });

  socket.on('reject-call', (data) => {
    const { callId, callerId } = data;
    socket.to(`user-${callerId}`).emit('call-rejected', {
      callId,
      rejectedBy: data.userId,
      reason: data.reason,
      timestamp: new Date()
    });
  });

  socket.on('end-call', (data) => {
    const { callId, participants } = data;
    participants.forEach(participantId => {
      socket.to(`user-${participantId}`).emit('call-ended', {
        callId,
        endedBy: data.endedBy,
        duration: data.duration,
        timestamp: new Date()
      });
    });
  });

  // WebRTC Signaling
  socket.on('rtc-signal', (data) => {
    const { targetUserId, signal, callId } = data;
    socket.to(`user-${targetUserId}`).emit('rtc-signal', {
      signal,
      callId,
      fromUserId: data.userId
    });
  });

  socket.on('ice-candidate', (data) => {
    const { targetUserId, candidate } = data;
    socket.to(`user-${targetUserId}`).emit('ice-candidate', {
      candidate,
      fromUserId: data.userId
    });
  });

  // ======== INCOMING EVENT HANDLERS ========
  socket.on('new-voice-message', (data) => {
    // Handle incoming voice message notification
    console.log('New voice message received:', data);
  });

  socket.on('incoming-call', (data) => {
    // Handle incoming call notification
    console.log('Incoming call:', data);
  });

  socket.on('call-ended', (data) => {
    // Handle call ended notification
    console.log('Call ended:', data);
  });

  socket.on('voice-message-playback-update', (data) => {
    // Handle voice message playback status updates from other users
    console.log('Voice message playback update:', data);
  });
};

// ======== VOICE MESSAGE UTILITIES ========
export const voiceMessageUtils = {
  // Generate waveform data from audio blob with robust error handling
  generateWaveform: async (audioBlob, samples = 100) => {
    return new Promise((resolve, reject) => {
      // Check if AudioContext is supported
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.warn('AudioContext not supported in this browser');
        resolve(Array(samples).fill(0.1));
        return;
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          
          // Validate array buffer
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error('Empty audio file');
          }
          
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Validate audio buffer
          if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('Invalid audio data');
          }
          
          const channelData = audioBuffer.getChannelData(0);
          
          // Handle very short audio files
          if (channelData.length < samples) {
            const shortWaveform = Array.from(
              { length: samples }, 
              (_, i) => i < channelData.length ? Math.abs(channelData[i]) : 0.1
            );
            audioContext.close();
            resolve(shortWaveform);
            return;
          }
          
          const blockSize = Math.floor(channelData.length / samples);
          const waveform = [];
          
          for (let i = 0; i < samples; i++) {
            let blockStart = i * blockSize;
            let sum = 0;
            let validSamples = 0;
            
            for (let j = 0; j < blockSize && blockStart + j < channelData.length; j++) {
              const value = channelData[blockStart + j];
              // Check for valid finite numbers
              if (isFinite(value)) {
                sum += Math.abs(value);
                validSamples++;
              }
            }
            
            // Avoid division by zero and ensure minimum amplitude for visibility
            const average = validSamples > 0 ? sum / validSamples : 0.01;
            waveform.push(Math.max(average, 0.01));
          }
          
          // Normalize waveform to make it more visible
          const maxVal = Math.max(...waveform);
          if (maxVal > 0) {
            const normalizedWaveform = waveform.map(val => val / maxVal);
            audioContext.close();
            resolve(normalizedWaveform);
          } else {
            audioContext.close();
            resolve(Array(samples).fill(0.1));
          }
          
        } catch (error) {
          console.error('Waveform generation error:', error);
          // Always close audio context even on error
          if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().catch(e => console.warn('Error closing audio context:', e));
          }
          
          // Use the local function instead of this.
          const fallbackWaveform = generateFallbackWaveform(samples, 
            error.name === 'EncodingError' || error.message.includes('decode') ? 'decoding' : 'generic'
          );
          resolve(fallbackWaveform);
        }
      };
      
      fileReader.onerror = (error) => {
        console.error('FileReader error:', error);
        audioContext.close().catch(e => console.warn('Error closing audio context:', e));
        resolve(generateFallbackWaveform(samples, 'file-reader'));
      };
      
      fileReader.onabort = () => {
        console.warn('File reading aborted');
        audioContext.close().catch(e => console.warn('Error closing audio context:', e));
        resolve(generateFallbackWaveform(samples, 'aborted'));
      };
      
      // Set a timeout for file reading
      const timeoutId = setTimeout(() => {
        fileReader.abort();
        audioContext.close().catch(e => console.warn('Error closing audio context:', e));
        resolve(generateFallbackWaveform(samples, 'timeout'));
      }, 10000); // 10 second timeout
      
      fileReader.onloadend = () => {
        clearTimeout(timeoutId);
      };
      
      try {
        fileReader.readAsArrayBuffer(audioBlob);
      } catch (error) {
        console.error('Error reading blob:', error);
        clearTimeout(timeoutId);
        audioContext.close().catch(e => console.warn('Error closing audio context:', e));
        resolve(generateFallbackWaveform(samples, 'blob-read'));
      }
    });
  },

  // Generate fallback waveform when audio decoding fails
  generateFallbackWaveform: (samples, type = 'generic') => {
    const waveform = [];
    
    switch (type) {
      case 'decoding':
        // Sine wave pattern for decoding errors
        for (let i = 0; i < samples; i++) {
          const value = Math.sin((i / samples) * Math.PI * 4) * 0.5 + 0.5;
          waveform.push(value * 0.3 + 0.1); // Scale to reasonable values
        }
        break;
        
      case 'silent':
        // Almost flat line for silent/empty files
        for (let i = 0; i < samples; i++) {
          waveform.push(0.1 + Math.random() * 0.05); // Slight variation
        }
        break;
        
      default:
        // Random gentle waveform for generic errors
        for (let i = 0; i < samples; i++) {
          waveform.push(0.2 + Math.random() * 0.3);
        }
    }
    
    return waveform;
  },

  // Validate audio blob before processing
  validateAudioBlob: (blob) => {
    if (!blob || !(blob instanceof Blob)) {
      return { isValid: false, error: 'Invalid blob object' };
    }
    
    if (blob.size === 0) {
      return { isValid: false, error: 'Empty audio file' };
    }
    
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/ogg', 'audio/webm', 'audio/aac'];
    const isAllowedType = allowedTypes.some(type => blob.type.includes(type.replace('audio/', '')));
    
    if (!isAllowedType && blob.type !== '') {
      console.warn(`Unsupported audio type: ${blob.type}`);
    }
    
    return { isValid: true };
  },

  // Enhanced waveform generation with validation
  generateWaveformSafe: async (audioBlob, samples = 100) => {
    const validation = voiceMessageUtils.validateAudioBlob(audioBlob);
    if (!validation.isValid) {
      console.warn('Audio blob validation failed:', validation.error);
      return voiceMessageUtils.generateFallbackWaveform(samples, 'silent');
    }
    
    return voiceMessageUtils.generateWaveform(audioBlob, samples);
  },

  // Format duration for display
  formatDuration: (seconds) => {
    if (!seconds || seconds < 0) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  // Calculate waveform dimensions for display with safety checks
  calculateWaveformDimensions: (waveform, maxWidth = 200, maxHeight = 30) => {
    if (!waveform || !waveform.length || !Array.isArray(waveform)) {
      // Return default dimensions for empty state
      return Array(50).fill(0).map(() => ({
        width: maxWidth / 50,
        height: maxHeight * 0.1
      }));
    }
    
    const validWaveform = waveform.filter(val => 
      isFinite(val) && val >= 0 && val <= 1
    );
    
    if (validWaveform.length === 0) {
      return Array(waveform.length).fill(0).map(() => ({
        width: maxWidth / waveform.length,
        height: maxHeight * 0.1
      }));
    }
    
    const maxAmplitude = Math.max(...validWaveform);
    const minDisplayHeight = maxHeight * 0.1; // Minimum 10% height for visibility
    
    return waveform.map(amplitude => {
      const normalizedAmplitude = isFinite(amplitude) && amplitude >= 0 ? amplitude : 0;
      const height = Math.max(
        (normalizedAmplitude / Math.max(maxAmplitude, 0.1)) * maxHeight,
        minDisplayHeight
      );
      
      return {
        width: maxWidth / waveform.length,
        height: height
      };
    });
  }
};

// Local helper function to avoid 'this' context issues
const generateFallbackWaveform = (samples, type = 'generic') => {
  const waveform = [];
  
  switch (type) {
    case 'decoding':
      // Sine wave pattern for decoding errors
      for (let i = 0; i < samples; i++) {
        const value = Math.sin((i / samples) * Math.PI * 4) * 0.5 + 0.5;
        waveform.push(value * 0.3 + 0.1);
      }
      break;
      
    case 'silent':
      // Almost flat line for silent/empty files
      for (let i = 0; i < samples; i++) {
        waveform.push(0.1 + Math.random() * 0.05);
      }
      break;
      
    default:
      // Random gentle waveform for generic errors
      for (let i = 0; i < samples; i++) {
        waveform.push(0.2 + Math.random() * 0.3);
      }
  }
  
  return waveform;
};

// ======== CALL UTILITIES ========
export const callUtils = {
  // Format call duration
  formatCallDuration: (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  },

  // Get call status text
  getCallStatusText: (status, callType) => {
    const type = callType === 'video' ? 'Video' : 'Audio';
    switch (status) {
      case 'initiated': return `${type} call initiated`;
      case 'ongoing': return `${type} call in progress`;
      case 'completed': return `${type} call completed`;
      case 'missed': return `Missed ${type.toLowerCase()} call`;
      case 'rejected': return `${type} call declined`;
      case 'cancelled': return `${type} call cancelled`;
      default: return `${type} call`;
    }
  },

  // Check if call can be initiated
  canInitiateCall: (recipientStatus, callType = 'audio') => {
    return recipientStatus.isOnline && !recipientStatus.inCall;
  }
};

// ======== UTILITY ========
const getFileTypeFromUrl = (url) => {
  if (!url) return 'other';
  const extension = url.split('.').pop().toLowerCase();
  const types = {
    image: ['jpg','jpeg','png','gif','webp','bmp','svg'],
    video: ['mp4','avi','mov','wmv','flv','webm','mkv'],
    audio: ['mp3','wav','ogg','m4a','aac','flac'],
    document: ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv'],
    voice: ['webm', 'mp4', 'm4a'] // Voice message specific formats
  };
  for (const type in types) if (types[type].includes(extension)) return type;
  return 'other';
};

export default useMessageService;