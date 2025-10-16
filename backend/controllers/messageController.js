const Message = require('../models/Message');
const User = require('../models/User');
const Event = require('../models/Event'); // <-- use Event instead of Group
const AudioMessage = require('../models/AudioMessage');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const { sendMessageNotification, sendGroupMessageNotification } = require('../services/notificationService');
const { log } = require('console');

// In-memory online users map (socketId info). Keep this file's onlineUsers map consistent with your socket setup.
const onlineUsers = new Map(); // if you already keep it elsewhere, import/replace accordingly

// ---------------------- HELPERS ----------------------

// ---------------------- HELPERS ----------------------
const isUserOnline = (userId) => {
  return onlineUsers.has(userId.toString());
};

const mapIdToString = (id) => (id ? id.toString() : id);

// ---------------------- CONTROLLERS ----------------------

// @desc    Get all conversations for user (individual + event groups)
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const userId = req.userId;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search query for users
    let userQuery = {};
    if (search) {
      userQuery = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // ---------------- Individual conversations ----------------
    const individualConvos = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) }, // FIXED: Use 'new' keyword
            { recipient: new mongoose.Types.ObjectId(userId) }
          ],
          // FIXED: Use $and with $or for eventId exclusion
          $and: [
            {
              $or: [
                { eventId: { $exists: false } },
                { eventId: null }
              ]
            }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] }, // FIXED
              '$recipient',
              '$sender'
            ]
          },
          lastMessageAt: { $first: '$createdAt' },
          lastMessageText: { $first: '$body' },
          lastMessageType: { $first: '$type' },
          lastMessageStatus: { $first: '$status' },
          hasAttachments: { 
            $first: { 
              $gt: [{ $size: { $ifNull: ['$attachments', []] } }, 0] 
            } 
          },
          lastSenderId: { $first: '$sender' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient', new mongoose.Types.ObjectId(userId)] }, // FIXED
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $match: userQuery },
      {
        $project: {
          _id: 0,
          user: {
            _id: '$user._id',
            name: '$user.name',
            email: '$user.email',
            avatar: '$user.avatar',
            isOnline: '$user.isOnline',
            lastSeen: '$user.lastSeen'
          },
          lastMessageAt: 1,
          lastMessageText: 1,
          lastMessageType: 1,
          lastMessageStatus: 1,
          hasAttachments: 1,
          lastSenderId: 1,
          unreadCount: 1,
          type: { $literal: 'individual' }
        }
      },
      {
        $sort: { lastMessageAt: -1 }
      }
    ]);

    // Process online status
    const processedIndividual = individualConvos.map(row => {
      const uid = row.user._id.toString();
      return {
        ...row,
        user: {
          ...row.user,
          isOnline: isUserOnline(uid)
        }
      };
    });

    // ---------------- Event group conversations ----------------
    const eventConvos = await Event.aggregate([
      {
        $match: {
          participants: new mongoose.Types.ObjectId(userId), // FIXED
          ...(search && { name: { $regex: search, $options: 'i' } })
        }
      },
      {
        $lookup: {
          from: 'messages',
          let: { eventId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { $eq: ['$eventId', '$$eventId'] } 
              } 
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                body: 1, 
                type: 1, 
                createdAt: 1, 
                sender: 1, 
                attachments: 1, 
                status: 1
              }
            }
          ],
          as: 'lastMessage'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participantsInfo'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          date: 1,
          participants: 1,
          participantsInfo: { 
            _id: 1, 
            name: 1, 
            avatar: 1, 
            isOnline: 1 
          },
          participantsCount: { $size: '$participants' },
          lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
          admins: 1,
          createdAt: 1,
          type: { $literal: 'event' }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1, createdAt: -1 }
      }
    ]);

    // Process event online counts
    const processedEvents = eventConvos.map(evt => {
      const onlineCount = (evt.participants || []).reduce((acc, pid) => {
        return acc + (isUserOnline(pid.toString()) ? 1 : 0);
      }, 0);

      return {
        eventId: evt._id,
        name: evt.name,
        description: evt.description,
        date: evt.date,
        participantsCount: evt.participantsCount,
        onlineParticipants: onlineCount,
        lastMessage: evt.lastMessage,
        participantsInfo: evt.participantsInfo || [],
        admins: evt.admins || [],
        createdAt: evt.createdAt,
        type: 'event'
      };
    });

    // Combine and paginate
    const allConversations = [...processedIndividual, ...processedEvents]
      .sort((a, b) => {
        const getDate = (conv) => {
          if (conv.lastMessage?.createdAt) return new Date(conv.lastMessage.createdAt);
          if (conv.lastMessageAt) return new Date(conv.lastMessageAt);
          return new Date(conv.createdAt || 0);
        };
        return getDate(b) - getDate(a);
      });

    const paged = allConversations.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: paged,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: allConversations.length,
        pages: Math.ceil(allConversations.length / limitNum)
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching conversations',
      error: error.message 
    });
  }
};

// @desc    Get chat history (individual or event)
// @access  Private
// At top of controller file:


exports.getChatHistory = async (req, res) => {
  try {
    const { type, chatId } = req.params;
    const { page = 1, limit = 50, before = null } = req.query;

    // Defensive userId resolution
    const userId = req.userId || (req.user && req.user._id) || null;

    console.log('[getChatHistory] called with:', { type, chatId, page, limit, before, userId });

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: user not identified' });
    }

    if (!['individual', 'event'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid chat type. Must be either "individual" or "event".' });
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum; // Moved this up

    // Validate and build ObjectId instances with `new`
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid authenticated user id' });
    }
    const userObjId = new mongoose.Types.ObjectId(userId);

    let messages = [];
    let chatInfo = null;
    let total = 0;

    if (type === 'individual') {
      if (!chatId) return res.status(400).json({ success: false, message: 'chatId required' });
      if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ success: false, message: 'Invalid chatId' });

      const otherObjId = new mongoose.Types.ObjectId(chatId);

      console.log('[getChatHistory] individual query between', userObjId.toString(), 'and', otherObjId.toString());

      // **FIXED QUERY: Use eventId: null instead of $exists: false**
      const query = {
        $or: [
          { sender: userObjId, recipient: otherObjId },
          { sender: otherObjId, recipient: userObjId }
        ],
        eventId: null // CHANGED THIS LINE - This is the fix!
      };
      
      if (before) query.createdAt = { $lt: new Date(before) };

      total = await Message.countDocuments(query);
      console.log('[getChatHistory] individual message count =', total);

      const messagesResult = await Message.find(query)
        .populate('sender', 'name email avatar')
        .populate('recipient', 'name email avatar')
        .populate('replyTo.messageId')
        .populate('reactions.userId', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      messages = messagesResult || [];
      chatInfo = await User.findById(chatId).select('name email avatar isOnline lastSeen').lean();

      // Mark as read (non-blocking)
      Message.updateMany({
        sender: chatId,
        recipient: userId,
        isRead: false
      }, {
        isRead: true,
        readAt: new Date(),
        status: 'read'
      }).exec();

    } else { // event chat
      if (!chatId) return res.status(400).json({ success: false, message: 'chatId required' });
      if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ success: false, message: 'Invalid chatId' });

      console.log('[getChatHistory] event query for eventId=', chatId, 'participant=', userId);

      const event = await Event.findOne({ _id: chatId, participants: userId }).populate('participants', 'name email avatar');
      if (!event) return res.status(404).json({ success: false, message: 'Event not found or access denied' });

      const query = { eventId: new mongoose.Types.ObjectId(chatId) };
      if (before) query.createdAt = { $lt: new Date(before) };

      total = await Message.countDocuments(query);
      console.log('[getChatHistory] event message count =', total);

      const messagesResult = await Message.find(query)
        .populate('sender', 'name email avatar')
        .populate('replyTo.messageId')
        .populate('reactions.userId', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      messages = messagesResult || [];
      chatInfo = event;
    }

    return res.json({
      success: true,
      data: {
        chatInfo: {
          ...(chatInfo || {}),
          ...(type === 'individual' ? { isOnline: isUserOnline(chatId) } : {})
        },
        messages: messages.reverse(),
        type,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
          hasMore: skip + messages.length < total
        }
      }
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching chat history', error: error.message });
  }
};
// @desc    Send message with files
// @access  Private
exports.sendMessageWithFiles = async (req, res) => {
  try {
    const { recipientId, eventId, body, replyTo } = req.body;
    const senderId = req.userId;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Validate recipient/event
    if (recipientId) {
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
        return res.status(404).json({ success: false, message: 'Recipient not found' });
      }
    } else if (eventId) {
      const event = await Event.findOne({ _id: eventId, participants: senderId });
      if (!event) {
        files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
        return res.status(404).json({ success: false, message: 'Event not found or access denied' });
      }
    } else {
      // neither recipient nor event specified
      files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, message: 'recipientId or eventId required' });
    }

    const attachments = files.map(file => {
      const fileType = getFileType(file.mimetype);
      return {
        type: fileType,
        url: `/uploads/${file.path.replace(/^uploads[\\/]/, '')}`,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      };
    });

    const messageData = {
      sender: senderId,
      body: body || `Sent ${files.length} file(s)`,
      type: attachments.length === 1 ? attachments[0].type : 'multiple',
      attachments,
      status: 'sent',
      sentAt: new Date()
    };

    if (recipientId) messageData.recipient = recipientId;
    else if (eventId) messageData.eventId = eventId;

    if (replyTo) {
      const repliedMessage = await Message.findById(replyTo).populate('sender', 'name');
      if (repliedMessage) {
        messageData.replyTo = {
          messageId: repliedMessage._id,
          snippet: (repliedMessage.body || '').substring(0, 100),
          senderName: repliedMessage.sender?.name || ''
        };
      }
    }

    const message = await Message.create(messageData);
    await message.populate('sender', 'name email avatar');
    if (recipientId) await message.populate('recipient', 'name email avatar');
    if (replyTo) await message.populate('replyTo.messageId');

    // Real-time emission
    if (req.io) {
      const room = recipientId ? `user-${recipientId}` : `event-${eventId}`;
      req.io.to(room).emit('newMessage', message);
    }

    // Notifications
    if (recipientId) {
      await sendMessageNotification(recipientId, {
        messageId: message._id,
        senderId,
        body: message.body
      }, req);
    } else if (eventId) {
      await sendGroupMessageNotification(eventId, { // pass eventId to existing service
        messageId: message._id,
        senderId,
        body: message.body
      }, req);
    }

    res.status(201).json({ success: true, message: `Message with ${files.length} file(s) sent successfully`, data: message });

  } catch (error) {
    console.error('Send message with files error:', error);
    if (req.files) req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    res.status(500).json({ success: false, message: 'Error sending message with files' });
  }
};

// @desc    Send audio message
// @access  Private
exports.sendAudioMessage = async (req, res) => {
  try {
    const { recipientId, eventId, duration, waveform } = req.body;
    const audioFile = req.file;
    const senderId = req.userId;

    if (!audioFile) return res.status(400).json({ success: false, message: 'Audio file is required' });

    if (recipientId) {
      const recipient = await User.findById(recipientId);
      if (!recipient && fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
      if (!recipient) return res.status(404).json({ success: false, message: 'Recipient not found' });
    } else if (eventId) {
      const event = await Event.findOne({ _id: eventId, participants: senderId });
      if (!event && fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found or access denied' });
    } else {
      if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
      return res.status(400).json({ success: false, message: 'recipientId or eventId required' });
    }

    const messageData = {
      sender: senderId,
      body: '🎤 Audio message',
      type: 'audio',
      attachments: [{
        type: 'audio',
        url: `/uploads/${audioFile.path.replace(/^uploads[\\/]/, '')}`,
        duration: parseInt(duration) || 0,
        size: audioFile.size,
        mimeType: audioFile.mimetype,
        waveform: waveform ? JSON.parse(waveform) : [],
        filename: audioFile.originalname
      }],
      status: 'sent'
    };

    if (recipientId) messageData.recipient = recipientId;
    else if (eventId) messageData.eventId = eventId;

    const message = await Message.create(messageData);
    await message.populate('sender', 'name email avatar');

    if (req.io) {
      const room = recipientId ? `user-${recipientId}` : `event-${eventId}`;
      req.io.to(room).emit('newMessage', message);
    }

    if (recipientId) {
      await sendMessageNotification(recipientId, { messageId: message._id, senderId, body: message.body }, req);
    } else if (eventId) {
      await sendGroupMessageNotification(eventId, { messageId: message._id, senderId, body: message.body }, req);
    }

    res.status(201).json({ success: true, message: 'Audio message sent successfully', data: message });

  } catch (error) {
    console.error('Send audio message error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: 'Error sending audio message' });
  }
};

// @desc    Send regular message
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, eventId, body, replyTo, type = 'text', attachments = [] } = req.body;
    const senderId = req.userId;

    if (!body && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Message body or attachments required' });
    }

    const messageData = {
      sender: senderId,
      body: body || '',
      type,
      attachments,
      status: 'sent',
      sentAt: new Date(),
      deliveredTo: [],
      readBy: []
    };

    if (recipientId) messageData.recipient = recipientId;
    else if (eventId) messageData.eventId = eventId;
    else return res.status(400).json({ success: false, message: 'recipientId or eventId required' });

    if (replyTo) {
      const repliedMessage = await Message.findById(replyTo).populate('sender', 'name');
      if (repliedMessage) {
        messageData.replyTo = {
          messageId: repliedMessage._id,
          snippet: (repliedMessage.body || '').substring(0, 100),
          senderName: repliedMessage.sender?.name || ''
        };
      }
    }

    const message = await Message.create(messageData);
    await message.populate('sender', 'name email avatar');
    if (recipientId) await message.populate('recipient', 'name email avatar');
    if (replyTo) await message.populate('replyTo.messageId');

    // REAL-TIME EMISSION
    if (req.io) {
      const room = recipientId ? `user-${recipientId}` : `event-${eventId}`;
      req.io.to(room).emit('newMessage', message);
      req.io.to(`user-${senderId}`).emit('messageSent', { messageId: message._id, status: 'sent', sentAt: message.sentAt });
    }

    // DELIVERY STATUS UPDATE (best-effort)
    setTimeout(async () => {
      if (recipientId && isUserOnline(recipientId)) {
        await Message.findByIdAndUpdate(message._id, {
          status: 'delivered',
          deliveredAt: new Date(),
          $addToSet: { deliveredTo: recipientId }
        });

        if (req.io) {
          req.io.to(`user-${senderId}`).emit('messageStatus', { messageId: message._id, status: 'delivered', deliveredAt: new Date() });
        }
      }
    }, 1000);

    // NOTIFICATIONS
    if (recipientId) {
      await sendMessageNotification(recipientId, { messageId: message._id, senderId, body }, req);
    } else if (eventId) {
      await sendGroupMessageNotification(eventId, { messageId: message._id, senderId, body }, req);
    }

    res.status(201).json({ success: true, message: 'Message sent successfully', data: message });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
};

// Utility file type detector (unchanged)
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text/')) return 'document';
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z')) return 'archive';
  return 'other';
};

// @desc    React to message
// @access  Private
exports.reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    // Access check: recipient/sender or event participant
    let hasAccess = false;
    if (message.recipient && message.recipient.equals(req.userId)) hasAccess = true;
    if (message.sender && message.sender.equals(req.userId)) hasAccess = true;
    if (message.eventId) {
      const exists = await Event.exists({ _id: message.eventId, participants: req.userId });
      if (exists) hasAccess = true;
    }

    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied to this message' });

    await message.addReaction(req.userId, emoji);

    // Real-time reaction update
    if (req.io) {
      const room = message.recipient ? `user-${message.recipient}` : `event-${message.eventId}`;
      req.io.to(room).emit('messageReaction', {
        messageId: message._id,
        reactions: message.reactions,
        reactedBy: req.userId,
        emoji
      });
    }

    res.json({ success: true, message: 'Reaction added successfully', data: message.reactions });

  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ success: false, message: 'Error reacting to message' });
  }
};

// @desc    Reply to message
// @access  Private
exports.replyToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { body, type = 'text', attachments = [] } = req.body;

    const originalMessage = await Message.findById(messageId).populate('sender', 'name');
    if (!originalMessage) return res.status(404).json({ success: false, message: 'Original message not found' });

    const messageData = {
      sender: req.userId,
      body,
      type,
      attachments,
      replyTo: {
        messageId: originalMessage._id,
        snippet: (originalMessage.body || '').substring(0, 100),
        senderName: originalMessage.sender?.name || ''
      }
    };

    if (originalMessage.recipient) {
      // reply in direct conv
      messageData.recipient = originalMessage.sender.equals(req.userId) ? originalMessage.recipient : originalMessage.sender;
    } else if (originalMessage.eventId) {
      messageData.eventId = originalMessage.eventId;
    } else {
      return res.status(400).json({ success: false, message: 'Cannot determine reply target' });
    }

    const message = await Message.create(messageData);
    await message.populate('sender', 'name email avatar');
    await message.populate('replyTo.messageId');

    if (req.io) {
      const room = message.recipient ? `user-${message.recipient}` : `event-${message.eventId}`;
      req.io.to(room).emit('newMessage', message);
    }

    if (message.recipient) {
      await sendMessageNotification(message.recipient, { messageId: message._id, senderId: req.userId, body }, req);
    } else if (message.eventId) {
      await sendGroupMessageNotification(message.eventId, { messageId: message._id, senderId: req.userId, body }, req);
    }

    res.status(201).json({ success: true, message: 'Reply sent successfully', data: message });

  } catch (error) {
    console.error('Reply to message error:', error);
    res.status(500).json({ success: false, message: 'Error replying to message' });
  }
};

// @desc    Forward message
// @access  Private
exports.forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { recipients = [], events = [] } = req.body; // renamed groups->events
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) return res.status(404).json({ success: false, message: 'Message not found' });

    const forwardedMessages = [];

    for (const recipientId of recipients) {
      const message = await Message.create({
        sender: req.userId,
        recipient: recipientId,
        body: originalMessage.body,
        type: originalMessage.type,
        attachments: originalMessage.attachments,
        forwardedFrom: {
          messageId: originalMessage._id,
          originalSender: originalMessage.sender,
          forwardedAt: new Date()
        },
        forwardCount: (originalMessage.forwardCount || 0) + 1
      });
      forwardedMessages.push(message);

      if (req.io) req.io.to(`user-${recipientId}`).emit('newMessage', message);
      await sendMessageNotification(recipientId, { messageId: message._id, senderId: req.userId, body: message.body }, req);
    }

    for (const eventId of events) {
      const message = await Message.create({
        sender: req.userId,
        eventId,
        body: originalMessage.body,
        type: originalMessage.type,
        attachments: originalMessage.attachments,
        forwardedFrom: {
          messageId: originalMessage._id,
          originalSender: originalMessage.sender,
          forwardedAt: new Date()
        },
        forwardCount: (originalMessage.forwardCount || 0) + 1
      });
      forwardedMessages.push(message);

      if (req.io) req.io.to(`event-${eventId}`).emit('newMessage', message);
      await sendGroupMessageNotification(eventId, { messageId: message._id, senderId: req.userId, body: message.body }, req);
    }

    originalMessage.forwardCount = (originalMessage.forwardCount || 0) + recipients.length + events.length;
    await originalMessage.save();

    res.json({ success: true, message: `Message forwarded to ${recipients.length + events.length} conversations`, data: forwardedMessages });

  } catch (error) {
    console.error('Forward message error:', error);
    res.status(500).json({ success: false, message: 'Error forwarding message' });
  }
};

// @desc    Star/Unstar message
// @access  Private
exports.toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { action = 'star' } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    if (action === 'star') await message.starMessage(req.userId);
    else await message.unstarMessage(req.userId);

    res.json({ success: true, message: `Message ${action}ed successfully`, data: { starred: action === 'star', starredBy: message.starredBy } });

  } catch (error) {
    console.error('Toggle star message error:', error);
    res.status(500).json({ success: false, message: 'Error updating message star' });
  }
};

// @desc    Delete message
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteForEveryone = false } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    const isSender = message.sender.equals(req.userId);
    let deletedMessage;

    if (deleteForEveryone && isSender) {
      deletedMessage = await Message.findByIdAndDelete(messageId);

      if (req.io) {
        const room = message.recipient ? `user-${message.recipient}` : `event-${message.eventId}`;
        req.io.to(room).emit('messageDeleted', { messageId: message._id, deletedForEveryone: true, deletedBy: req.userId });
      }
    } else {
      await message.deleteForUser(req.userId);
      deletedMessage = message;
    }

    res.json({ success: true, message: deleteForEveryone ? 'Message deleted for everyone' : 'Message deleted for you', data: deletedMessage });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Error deleting message' });
  }
};

// @desc    Mark messages as read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { chatId, type = 'individual', messageIds = [] } = req.body;
    const userId = req.userId;

    let updateQuery = { recipient: userId, isRead: false };

    if (type === 'individual') updateQuery.sender = chatId;
    else updateQuery.eventId = chatId;

    if (messageIds.length > 0) updateQuery._id = { $in: messageIds };

    const messages = await Message.find(updateQuery);

    await Message.updateMany(updateQuery, { isRead: true, readAt: new Date(), status: 'read', $addToSet: { readBy: userId } });

    if (req.io) {
      const uniqueSenders = [...new Set(messages.map(msg => msg.sender.toString()))];
      uniqueSenders.forEach(senderId => {
        if (senderId !== userId) {
          req.io.to(`user-${senderId}`).emit('messagesRead', {
            chatId: type === 'individual' ? userId : chatId,
            type,
            messageIds: messages.filter(msg => msg.sender.toString() === senderId).map(msg => msg._id),
            readAt: new Date(),
            readBy: userId
          });
        }
      });
    }

    res.json({ success: true, message: 'Messages marked as read', data: { count: messages.length } });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Error marking messages as read' });
  }
};

// @desc    Search messages
// @access  Private
exports.searchMessages = async (req, res) => {
  try {
    const { query, chatId, type = 'individual', page = 1, limit = 20 } = req.query;
    if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let searchFilter = { body: { $regex: query, $options: 'i' } };

    if (type === 'individual' && chatId) {
      searchFilter.$or = [
        { sender: req.userId, recipient: chatId },
        { sender: chatId, recipient: req.userId }
      ];
      searchFilter.eventId = { $exists: false };
    } else if (type === 'event' && chatId) {
      searchFilter.eventId = chatId;
    } else {
      // Search across all user conversations and events
      const eventIds = await Event.find({ participants: req.userId }).distinct('_id');
      searchFilter.$or = [
        { sender: req.userId },
        { recipient: req.userId },
        { eventId: { $in: eventIds } }
      ];
    }

    const messages = await Message.find(searchFilter)
      .populate('sender', 'name email avatar')
      .populate('recipient', 'name email avatar')
      .populate('eventId', 'name') // populate event info
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Message.countDocuments(searchFilter);

    res.json({ success: true, data: messages, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });

  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ success: false, message: 'Error searching messages' });
  }
};

// @desc    Get starred messages
// @access  Private
exports.getStarredMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const messages = await Message.find({ 'starredBy.userId': req.userId })
      .populate('sender', 'name email avatar')
      .populate('recipient', 'name email avatar')
      .populate('eventId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Message.countDocuments({ 'starredBy.userId': req.userId });

    res.json({ success: true, data: messages, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });

  } catch (error) {
    console.error('Get starred messages error:', error);
    res.status(500).json({ success: false, message: 'Error fetching starred messages' });
  }
};

// @desc    Add internal note to conversation (Admin only)
// @access  Private/Admin
exports.addInternalNote = async (req, res) => {
  try {
    const { chatId, note, isPrivate = true } = req.body;

    // find any message that belongs to that conversation (individual or event)
    const message = await Message.findOne({
      $or: [
        { sender: chatId, recipient: req.userId },
        { sender: req.userId, recipient: chatId },
        { eventId: chatId }
      ]
    });

    if (!message) return res.status(404).json({ success: false, message: 'Conversation not found' });

    await message.addInternalNote(req.userId, note, isPrivate);

    res.json({ success: true, message: 'Internal note added successfully' });

  } catch (error) {
    console.error('Add internal note error:', error);
    res.status(500).json({ success: false, message: 'Error adding internal note' });
  }
};

// @desc    Get online users map
exports.getOnlineUsers = async (req, res) => {
  try {
    const { userIds = [] } = req.query;
    let onlineStatus = {};

    if (Array.isArray(userIds) && userIds.length > 0) {
      userIds.forEach(userId => {
        onlineStatus[userId] = isUserOnline(userId);
      });
    } else {
      // return snapshot of keys
      onlineUsers.forEach((value, key) => {
        onlineStatus[key] = true;
      });
    }

    res.json({ success: true, data: onlineStatus });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ success: false, message: 'Error fetching online users' });
  }
};

// @desc    Get message stats (individual + event)
// @desc    Get message stats (individual + event)
exports.getMessageStats = async (req, res) => {
  try {
    const userId = req.userId;
    const eventIds = await Event.find({ participants: userId }).distinct('_id');

    const stats = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) }, // FIXED
            { recipient: new mongoose.Types.ObjectId(userId) }, // FIXED
            { eventId: { $in: eventIds.map(id => new mongoose.Types.ObjectId(id)) } } // FIXED
          ]
        }
      },
      {
        $facet: {
          totalMessages: [{ $count: 'count' }],
          unreadMessages: [
            { $match: { recipient: new mongoose.Types.ObjectId(userId), isRead: false, eventId: { $exists: false } } }, // FIXED
            { $count: 'count' }
          ],
          starredMessages: [{ $match: { 'starredBy.userId': new mongoose.Types.ObjectId(userId) } }, { $count: 'count' }], // FIXED
          messagesByType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          recentActivity: [{ $sort: { createdAt: -1 } }, { $limit: 10 }, { $project: { type: 1, createdAt: 1, body: 1, status: 1 } }]
        }
      }
    ]);

    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Get message stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching message statistics' });
  }
};

// @desc    Update message status (delivered/read)
// @access  Private
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId, status } = req.body;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    const updates = {};
    if (status === 'delivered') {
      updates.status = 'delivered';
      updates.deliveredAt = new Date();
      updates.$addToSet = { deliveredTo: userId };
    } else if (status === 'read') {
      updates.status = 'read';
      updates.readAt = new Date();
      updates.isRead = true;
      updates.$addToSet = { readBy: userId };
    }

    const updatedMessage = await Message.findByIdAndUpdate(messageId, updates, { new: true });

    if (req.io && message.sender.toString() !== userId) {
      req.io.to(`user-${message.sender}`).emit('messageStatus', {
        messageId: message._id,
        status,
        [status === 'read' ? 'readAt' : 'deliveredAt']: new Date(),
        userId
      });
    }

    res.json({ success: true, message: `Message marked as ${status}`, data: updatedMessage });

  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({ success: false, message: 'Error updating message status' });
  }
};

exports.handleTyping = async (req, res) => {
  try {
    const { chatId, type = 'individual', isTyping = true } = req.body;
    const userId = req.userId;

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    if (req.io) {
      const room = type === 'individual' ? `user-${chatId}` : `event-${chatId}`;
      
      // Emit without userName for now, or fetch user details if needed
      req.io.to(room).emit('typing', { 
        userId, 
        chatId, 
        type, 
        isTyping 
        // Remove userName until we can safely get it
      });
    }

    res.json({ success: true, message: `Typing ${isTyping ? 'started' : 'stopped'}` });
  } catch (error) {
    console.error('Typing indicator error:', error);
    res.status(500).json({ success: false, message: 'Error handling typing indicator' });
  }
};
// ------------------ Expose online user manager for socket integration ------------------
exports.updateUserStatus = async (userId, isOnline = true, socketId = null) => {
  try {
    const user = await User.findByIdAndUpdate(userId, { isOnline, lastSeen: isOnline ? null : new Date() }, { new: true });

    if (isOnline && socketId) onlineUsers.set(userId.toString(), { socketId, lastSeen: null });
    else onlineUsers.delete(userId.toString());

    return user;
  } catch (error) {
    console.error('Update user status error:', error);
  }
};

exports.getOnlineStatus = (userId) => isUserOnline(userId);
