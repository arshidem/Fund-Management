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

  // Gets online users snapshot (GET /api/messages/online)
  const getOnlineUsers = (userIds = []) =>
    createRequest('GET', '/messages/online', null, { params: { userIds } });

  const getMessageStats = () =>
    createRequest('GET', '/messages/stats');

  // Note: updating user's online status is typically done via socket events.
  // If you still want an HTTP route you need to add `/messages/user-status` backend route.

  // ======== CONVERSATIONS ========
  const getConversations = async (filters = {}) =>
    createRequest('GET', '/messages/conversations', null, { params: filters });

  // updated to match route: GET /api/messages/history/:type/:chatId
  const getChatHistory = async (chatId, type = 'individual', filters = {}) =>
    createRequest('GET', `/messages/history/${type}/${chatId}`, null, { params: filters });

  // ======== MESSAGES ========
  const sendMessage = async (messageData) =>
    createRequest('POST', '/messages/send', messageData);

  // files -> POST /api/messages/send-with-files (form-data)
  // Use `eventId` for event-group messages (instead of groupId)
  const sendMessageWithFiles = async (messageData) => {
    const formData = new FormData();

    // Attach files (field name 'files')
    messageData.files?.forEach(file => formData.append('files', file));

    // Attach other fields (use eventId instead of groupId)
    ['recipientId', 'eventId', 'body', 'replyTo', 'type'].forEach(field => {
      if (messageData[field] !== undefined && messageData[field] !== null) {
        formData.append(field, messageData[field]);
      }
    });

    return createRequest('POST', '/messages/send-with-files', formData, { isFormData: true });
  };

  // audio -> POST /api/messages/send-audio (form-data)
  const sendAudioMessage = async (audioData) => {
    const formData = new FormData();
    if (audioData.audioFile) formData.append('audio', audioData.audioFile); // field name 'audio'
    if (audioData.recipientId) formData.append('recipientId', audioData.recipientId);
    if (audioData.eventId) formData.append('eventId', audioData.eventId);
    if (audioData.duration) formData.append('duration', audioData.duration);
    if (audioData.waveform) formData.append('waveform', JSON.stringify(audioData.waveform));
    return createRequest('POST', '/messages/send-audio', formData, { isFormData: true });
  };

  // reply uses route: POST /api/messages/:messageId/reply
  const replyToMessage = (messageId, replyData) =>
    createRequest('POST', `/messages/${messageId}/reply`, replyData);

  // react uses route: POST /api/messages/:messageId/react
  const reactToMessage = (messageId, emoji) =>
    createRequest('POST', `/messages/${messageId}/react`, { emoji });

  // forward uses route: POST /api/messages/:messageId/forward
  // payload example: { recipients: ['id1','id2'], events: ['eventId1'] }
  const forwardMessage = (messageId, targets) =>
    createRequest('POST', `/messages/${messageId}/forward`, targets);

  // star/unstar uses route: POST /api/messages/:messageId/star
  const toggleStarMessage = (messageId, action = 'star') =>
    createRequest('POST', `/messages/${messageId}/star`, { action });

  // delete message uses route: DELETE /api/messages/:messageId
  // send body { deleteForEveryone: true } if needed
  const deleteMessage = (messageId, deleteForEveryone = false) =>
    createRequest('DELETE', `/messages/${messageId}`, { deleteForEveryone });

  // mark read uses POST /api/messages/mark-read
  // body: { chatId, type, messageIds }
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

  // ======== (legacy/removed) Group management endpoints are not present in your messageRoutes.js
  // If you need group endpoints add them backend-side; for event-based groups use event endpoints and eventId.

  // ======== FILE HELPERS ========
  // If you later add standalone upload endpoints, implement uploadFile/uploadFiles accordingly.
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

    // Quick
    quickSendText,
    quickSendFile,

    // File helpers
    getFilePreviewUrl,
    downloadFile
  };
};

// ======== SOCKET EVENT HANDLERS ========
// Note: use socket events for presence; the server should listen to these events and update online status.
export const setupMessageSocketHandlers = (socket, messageService) => {
  // Presence via socket events — backend must handle these
  socket.emit('user-online', { socketId: socket.id }); // notify server on connect

  socket.on('disconnect', () => {
    socket.emit('user-offline', { socketId: socket.id });
  });

  // Typing indicators (local socket emission to room)
  socket.on('start-typing', (data) => {
    // data: { room } where room is e.g. 'user-<id>' or 'event-<id>'
    socket.to(data.room).emit('user-typing', { userId: data.userId, isTyping: true });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.room).emit('user-typing', { userId: data.userId, isTyping: false });
  });

  // Message delivery/read events (emit to server socket — server should persist/read receipts)
  socket.on('message-delivered', (data) => {
    // data: { messageId }
    socket.emit('message-delivered', data);
  });

  socket.on('message-read', (data) => {
    socket.emit('message-read', data);
  });
};

// ======== UTILITY ========
const getFileTypeFromUrl = (url) => {
  if (!url) return 'other';
  const extension = url.split('.').pop().toLowerCase();
  const types = {
    image: ['jpg','jpeg','png','gif','webp','bmp','svg'],
    video: ['mp4','avi','mov','wmv','flv','webm','mkv'],
    audio: ['mp3','wav','ogg','m4a','aac','flac'],
    document: ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv']
  };
  for (const type in types) if (types[type].includes(extension)) return type;
  return 'other';
};

export default useMessageService;
