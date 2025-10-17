const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { uploadFiles, uploadAudio, uploadVoice } = require('../middleware/upload');

// Auth middlewares
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ------------------ Conversations & History ------------------
router.get('/conversations', protect, messageController.getConversations);
router.get('/history/:type/:chatId', protect, messageController.getChatHistory);

// ------------------ Sending Messages ------------------
router.post('/send-with-files', protect, uploadFiles, messageController.sendMessageWithFiles);
router.post('/send-audio', protect, uploadAudio, messageController.sendAudioMessage);
router.post('/send-voice', protect, uploadVoice, messageController.sendVoiceMessage);
router.post('/send', protect, messageController.sendMessage);

// ------------------ Voice Message Routes ------------------
router.get('/voice-messages', protect, messageController.getVoiceMessages);
router.patch('/voice-messages/:messageId/status', protect, messageController.updateVoiceMessageStatus);

// ------------------ Call Routes ------------------
router.post('/calls/initiate', protect, messageController.initiateCall);
router.post('/calls/accept', protect, messageController.acceptCall);
router.post('/calls/reject', protect, messageController.rejectCall);
router.post('/calls/end', protect, messageController.endCall);
router.get('/calls/history', protect, messageController.getCallHistory);
router.get('/calls/active', protect, messageController.getActiveCalls);

// ------------------ Message Actions ------------------
router.post('/:messageId/react', protect, messageController.reactToMessage);
router.post('/:messageId/reply', protect, messageController.replyToMessage);
router.post('/:messageId/forward', protect, messageController.forwardMessage);
router.post('/:messageId/star', protect, messageController.toggleStarMessage);
router.delete('/:messageId', protect, messageController.deleteMessage);

// ------------------ Read / Typing / Status ------------------
router.post('/mark-read', protect, messageController.markAsRead);
router.post('/status', protect, messageController.updateMessageStatus);
router.post('/typing', protect, messageController.handleTyping);

// ------------------ Search / Starred / Notes ------------------
router.get('/search', protect, messageController.searchMessages);
router.get('/starred', protect, messageController.getStarredMessages);
router.post('/internal-note', protect, adminOnly, messageController.addInternalNote);

// ------------------ Online / Stats ------------------
router.get('/online', protect, messageController.getOnlineUsers);
router.get('/stats', protect, messageController.getMessageStats);

module.exports = router;