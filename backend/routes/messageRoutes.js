const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { uploadFiles, uploadAudio } = require('../middleware/upload');

// Auth middlewares - adjust paths/names if your project uses different ones
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ------------------ Conversations & History ------------------
router.get('/conversations', protect, messageController.getConversations);
router.get('/history/:type/:chatId', protect, messageController.getChatHistory);

// ------------------ Sending Messages ------------------
// Send multiple files (field name: 'files')
router.post('/send-with-files', protect, uploadFiles, messageController.sendMessageWithFiles);

// Send audio (field name: 'audio')
router.post('/send-audio', protect, uploadAudio, messageController.sendAudioMessage);

// Send text/regular message
router.post('/send', protect, messageController.sendMessage);

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
router.post('/internal-note', protect, adminOnly, messageController.addInternalNote); // admin-only

// ------------------ Online / Stats ------------------
router.get('/online', protect, messageController.getOnlineUsers);
router.get('/stats', protect, messageController.getMessageStats);

module.exports = router;
