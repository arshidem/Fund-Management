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
  try {
    // Validate input
    if (!voiceData.voiceFile) {
      throw new Error('No voice file provided');
    }

    // Ensure we have a proper File object
    if (!(voiceData.voiceFile instanceof File) && !(voiceData.voiceFile instanceof Blob)) {
      throw new Error('Invalid voice file type');
    }

    const formData = new FormData();
    
    // Append file with explicit filename - THIS IS THE KEY FIX
    const fileName = voiceData.voiceFile.name || `voice-message-${Date.now()}.webm`;
    formData.append('voice', voiceData.voiceFile, fileName);
    
    // Append other data
    if (voiceData.recipientId) formData.append('recipientId', voiceData.recipientId);
    if (voiceData.eventId) formData.append('eventId', voiceData.eventId);
    if (voiceData.duration) formData.append('duration', voiceData.duration.toString());
    if (voiceData.waveform) formData.append('waveform', JSON.stringify(voiceData.waveform));

    // Debug log to verify data
    console.log('Sending voice message with:', {
      fileName: fileName,
      size: voiceData.voiceFile.size,
      type: voiceData.voiceFile.type,
      recipientId: voiceData.recipientId,
      duration: voiceData.duration,
      hasWaveform: !!voiceData.waveform
    });

    // Verify FormData contents
    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: File - ${value.name} (${value.size} bytes, ${value.type})`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }

    return await createRequest('POST', '/messages/send-voice', formData, { isFormData: true });
    
  } catch (error) {
    console.error('Error in sendVoiceMessage:', error);
    throw error;
  }
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

// Forward single message
const forwardMessage = async (messageId, { recipients = [], events = [] }) => {
  return createRequest('POST', `/messages/${messageId}/forward`, {
    recipients,
    events
  });
};

// Forward multiple messages (for bulk forwarding)
const forwardMessages = async (messageIds, { recipients = [], events = [] }) => {
  return createRequest('POST', '/messages/forward', {
    messageIds,
    recipients,
    events
  });
};
  const toggleStarMessage = (messageId, action = 'star') =>
    createRequest('POST', `/messages/${messageId}/star`, { action });

// In messageService.js
const deleteMessages = async (messageIds, deleteForEveryone = false) => {
  return createRequest('DELETE', '/messages', { // Changed from '/messages/bulk' to '/messages'
    messageIds,
    deleteForEveryone
  });
};

const deleteMessage = async (messageId, deleteForEveryone = false) => {
  return createRequest('DELETE', `/messages/${messageId}`, {
    deleteForEveryone
  });
};
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
    forwardMessages,
    forwardMessage,
    toggleStarMessage,
    deleteMessage,
    deleteMessages,
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
  console.log('🔌 New socket connection:', socket.id);

  // Extract user ID from socket auth (assuming JWT token in handshake)
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
  
  if (!userId) {
    console.error('❌ No user ID provided for socket connection');
    socket.disconnect();
    return;
  }

  // Join user to their personal room
  socket.join(`user-${userId}`);
  console.log(`✅ User ${userId} joined room: user-${userId}`);

  // ======== PRESENCE & CONNECTION ========
  socket.emit('user-online', { socketId: socket.id, userId });

  // Notify others that this user is online
  socket.broadcast.emit('userOnline', { userId, socketId: socket.id });

  socket.on('disconnect', (reason) => {
    console.log(`🔴 User ${userId} disconnected:`, reason);
    socket.broadcast.emit('userOffline', { userId });
  });

  // ======== TYPING INDICATORS ========
  socket.on('typing', (data) => {
    const { chatId, type, isTyping } = data;
    
    if (type === 'individual') {
      // Send to specific user
      socket.to(`user-${chatId}`).emit('typing', {
        userId,
        chatId,
        isTyping,
        type: 'individual'
      });
    } else if (type === 'event') {
      // Send to all event participants
      socket.to(`event-${chatId}`).emit('typing', {
        userId,
        chatId,
        isTyping,
        type: 'event'
      });
    }
  });

  // ======== MESSAGE STATUS EVENTS ========
  socket.on('message-delivered', async (data) => {
    try {
      const { messageId, recipientId } = data;
      
      // Update in database
      await messageService.updateMessageStatus(messageId, 'delivered');
      
      // Notify sender
      socket.to(`user-${recipientId}`).emit('messageStatus', {
        messageId,
        status: 'delivered',
        deliveredAt: new Date()
      });
    } catch (error) {
      console.error('Error updating message delivery status:', error);
    }
  });

  socket.on('message-read', async (data) => {
    try {
      const { messageIds, readerId, chatId } = data;
      
      // Update in database
      await messageService.markMessagesAsRead(messageIds, readerId);
      
      // Notify sender(s)
      socket.emit('messagesRead', {
        messageIds,
        readerId,
        readAt: new Date(),
        chatId
      });
    } catch (error) {
      console.error('Error updating message read status:', error);
    }
  });

  // ======== FORWARDED MESSAGES ========
socket.on('forwardedMessage', async (data) => {
  try {
    console.log('🔍 DEBUG forwardedMessage event received:', {
      fromUser: socket.handshake.auth?.userId,
      toUser: data.recipientId,
      hasMessage: !!data.message,
      hasForwardedBy: !!data.forwardedBy,
      socketId: socket.id
    });

    const { message, recipientId, forwardedBy } = data;
    
    if (!recipientId) {
      console.error('❌ Missing recipientId in forwardedMessage');
      return socket.emit('forwardError', { error: 'Missing recipient ID' });
    }

    if (!message) {
      console.error('❌ Missing message in forwardedMessage');
      return socket.emit('forwardError', { error: 'Missing message' });
    }
    
    console.log(`📨 Forwarding message from user ${socket.handshake.auth?.userId} to user: ${recipientId}`);
    
    // Generate proper message ID for the forwarded message
    const forwardedMessageId = generateMessageId();
    
    // Create the forwarded message object
    const forwardedMessageData = {
      ...message,
      _id: forwardedMessageId,
      isOptimistic: false,
      createdAt: new Date(),
      status: 'sent',
      // Ensure these critical fields are set
      sender: forwardedBy, // The person who forwarded it
      recipient: recipientId, // The recipient
      // Preserve forwarding info
      forwardedFrom: {
        messageId: message._id,
        originalSender: message.sender,
        forwardedAt: new Date(),
        forwardedBy: forwardedBy.name || 'User'
      }
    };

    console.log('💾 Saving forwarded message to database...', {
      messageId: forwardedMessageId,
      recipientId: recipientId,
      senderId: forwardedBy._id
    });
    
    // Save to database
    const savedMessage = await messageService.saveMessage(forwardedMessageData);
    
    console.log('✅ Message saved to database:', savedMessage._id);

    const recipientRoom = `user-${recipientId}`;
    console.log(`📤 Emitting to recipient room: ${recipientRoom}`);
    console.log(`📤 Current socket rooms:`, socket.rooms);
    
    // Emit to the specific recipient - using socket.to for broadcasting
    socket.to(recipientRoom).emit('newMessage', savedMessage);
    
    // Also emit a specific forwarded event for UI updates
    socket.to(recipientRoom).emit('forwardedMessage', {
      message: savedMessage,
      forwardedBy
    });

    console.log(`✅ Forwarded message delivered to ${recipientRoom}`);
    
    // Confirm to sender that forward was successful
    socket.emit('forwardSuccess', {
      messageId: savedMessage._id,
      recipientId: recipientId
    });
    
  } catch (error) {
    console.error('❌ Error handling forwarded message:', error);
    socket.emit('forwardError', { 
      error: 'Failed to forward message',
      details: error.message 
    });
  }
});

socket.on('forwardedToGroup', async (data) => {
  try {
    console.log('🔍 DEBUG forwardedToGroup event received:', {
      fromUser: socket.handshake.auth?.userId,
      toEvent: data.eventId,
      hasMessage: !!data.message,
      socketId: socket.id
    });

    const { message, eventId, forwardedBy } = data;
    
    if (!eventId) {
      console.error('❌ Missing eventId in forwardedToGroup');
      return;
    }

    if (!message) {
      console.error('❌ Missing message in forwardedToGroup');
      return;
    }
    
    console.log(`📨 Forwarding message to event: ${eventId}`);
    
    // Generate proper message ID
    const forwardedMessageId = generateMessageId();
    
    // Create group message
    const groupMessageData = {
      ...message,
      _id: forwardedMessageId,
      isOptimistic: false,
      createdAt: new Date(),
      status: 'sent',
      eventId: eventId,
      sender: forwardedBy,
      // Remove recipient for group messages
      recipient: undefined,
      forwardedFrom: {
        messageId: message._id,
        originalSender: message.sender,
        forwardedAt: new Date(),
        forwardedBy: forwardedBy.name || 'User'
      }
    };
    
    console.log('💾 Saving group forwarded message to database...', {
      messageId: forwardedMessageId,
      eventId: eventId
    });

    // Save to database
    const savedMessage = await messageService.saveMessage(groupMessageData);
    
    console.log('✅ Group message saved to database:', savedMessage._id);

    const eventRoom = `event-${eventId}`;
    console.log(`📤 Emitting to event room: ${eventRoom}`);
    
    // Emit to all participants in the group/event (except sender)
    socket.to(eventRoom).emit('newMessage', savedMessage);
    
    // Also emit specific forwarded event
    socket.to(eventRoom).emit('forwardedToGroup', {
      message: savedMessage,
      eventId,
      forwardedBy
    });

    console.log(`✅ Forwarded message delivered to event ${eventId}`);
    
  } catch (error) {
    console.error('❌ Error handling group forwarded message:', error);
    socket.emit('forwardError', { 
      error: 'Failed to forward message to group',
      details: error.message 
    });
  }
});

  // ======== MESSAGE REACTIONS ========
  socket.on('messageReaction', async (data) => {
    try {
      const { messageId, emoji, userId } = data;
      
      // Save reaction to database
      await messageService.addReaction(messageId, userId, emoji);
      
      // Broadcast to all users in the chat
      const message = await messageService.getMessage(messageId);
      const chatRoom = message.eventId ? `event-${message.eventId}` : `user-${message.recipient}`;
      
      socket.to(chatRoom).emit('messageReaction', {
        messageId,
        emoji,
        userId,
        reactedAt: new Date()
      });
      
    } catch (error) {
      console.error('Error handling message reaction:', error);
    }
  });

  // ======== VOICE MESSAGE EVENTS ========
  socket.on('voiceMessagePlayback', (data) => {
    const { messageId, isPlaying, currentTime } = data;
    
    // Broadcast playback status to other users in the chat
    socket.broadcast.emit('voiceMessagePlayback', {
      messageId,
      isPlaying,
      currentTime,
      userId
    });
  });

  socket.on('voiceMessagePlayed', async (data) => {
    try {
      const { messageId, playTime } = data;
      
      // Update playback stats in database
      await messageService.updateVoiceMessageStatus(messageId, { 
        lastPlayedAt: new Date(), 
        totalPlayTime: playTime 
      });
    } catch (error) {
      console.error('Error updating voice message status:', error);
    }
  });

  // ======== CALL EVENTS ========
  socket.on('initiate-call', (data) => {
    const { recipientId, callType, callId, caller } = data;
    
    console.log(`📞 Initiating ${callType} call to ${recipientId}`);
    
    socket.to(`user-${recipientId}`).emit('incomingCall', {
      callId,
      caller,
      callType,
      timestamp: new Date()
    });
  });

  socket.on('accept-call', (data) => {
    const { callId, callerId } = data;
    
    socket.to(`user-${callerId}`).emit('callAccepted', {
      callId,
      acceptedBy: userId,
      timestamp: new Date()
    });
  });

  socket.on('reject-call', (data) => {
    const { callId, callerId, reason } = data;
    
    socket.to(`user-${callerId}`).emit('callRejected', {
      callId,
      rejectedBy: userId,
      reason: reason || 'rejected',
      timestamp: new Date()
    });
  });

  socket.on('end-call', (data) => {
    const { callId, participants } = data;
    
    participants.forEach(participantId => {
      if (participantId !== userId) {
        socket.to(`user-${participantId}`).emit('callEnded', {
          callId,
          endedBy: userId,
          duration: data.duration,
          timestamp: new Date()
        });
      }
    });
  });

  // ======== WEBRTC SIGNALING ========
  socket.on('rtc-signal', (data) => {
    const { targetUserId, signal, callId } = data;
    
    socket.to(`user-${targetUserId}`).emit('rtcSignal', {
      signal,
      callId,
      fromUserId: userId
    });
  });

  socket.on('ice-candidate', (data) => {
    const { targetUserId, candidate, callId } = data;
    
    socket.to(`user-${targetUserId}`).emit('iceCandidate', {
      candidate,
      callId,
      fromUserId: userId
    });
  });

  // ======== ERROR HANDLING ========
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
};

// Helper function to generate message IDs
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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