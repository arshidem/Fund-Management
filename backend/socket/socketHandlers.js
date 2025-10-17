// server/socket/socketHandlers.js
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id name role email avatar");
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    console.error("Socket authentication error:", err);
    next(new Error("Authentication error: Invalid token"));
  }
};

// Main socket connection handler
const setupSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log(`User ${socket.userId} connected`);

    // Notify all other users that this user came online
    socket.broadcast.emit('userOnline', { userId: socket.userId });

    // Join personal room for notifications
    socket.join(`user-${socket.userId}`);

    // Admin room
    if (socket.user.role === "admin") {
      socket.join("admin");
    }

    // ======== FORWARDED MESSAGE HANDLERS ========
    socket.on("forwardedMessage", async (data) => {
      try {
        console.log('🔍 DEBUG forwardedMessage event received:', {
          fromUser: socket.userId,
          toUser: data.recipientId,
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
        
        console.log(`📨 Forwarding message from user ${socket.userId} to user: ${recipientId}`);
        
        // Generate proper message ID
        const forwardedMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create the forwarded message object
        const forwardedMessageData = {
          ...message,
          _id: forwardedMessageId,
          isOptimistic: false,
          createdAt: new Date(),
          status: 'sent',
          sender: forwardedBy || socket.user,
          recipient: recipientId,
          forwardedFrom: {
            messageId: message._id,
            originalSender: message.sender,
            forwardedAt: new Date(),
            forwardedBy: (forwardedBy || socket.user).name
          }
        };

        console.log('💾 Saving forwarded message to database...');
        
        // Save to database
        const savedMessage = await Message.create(forwardedMessageData);
        
        console.log('✅ Message saved to database:', savedMessage._id);

        const recipientRoom = `user-${recipientId}`;
        console.log(`📤 Emitting to recipient room: ${recipientRoom}`);
        
        // Emit to the specific recipient
        socket.to(recipientRoom).emit("newMessage", savedMessage);
        
        // Also emit a specific forwarded event for UI updates
        socket.to(recipientRoom).emit("forwardedMessage", {
          message: savedMessage,
          forwardedBy: forwardedBy || socket.user
        });

        console.log(`✅ Forwarded message delivered to ${recipientRoom}`);
        
        // Confirm to sender that forward was successful
        socket.emit("forwardSuccess", {
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

    socket.on("forwardedToGroup", async (data) => {
      try {
        console.log('🔍 DEBUG forwardedToGroup event received:', {
          fromUser: socket.userId,
          toEvent: data.eventId,
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
        const forwardedMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create group message
        const groupMessageData = {
          ...message,
          _id: forwardedMessageId,
          isOptimistic: false,
          createdAt: new Date(),
          status: 'sent',
          eventId: eventId,
          sender: forwardedBy || socket.user,
          recipient: undefined,
          forwardedFrom: {
            messageId: message._id,
            originalSender: message.sender,
            forwardedAt: new Date(),
            forwardedBy: (forwardedBy || socket.user).name
          }
        };
        
        console.log('💾 Saving group forwarded message to database...');

        // Save to database
        const savedMessage = await Message.create(groupMessageData);
        
        console.log('✅ Group message saved to database:', savedMessage._id);

        const eventRoom = `event-${eventId}`;
        console.log(`📤 Emitting to event room: ${eventRoom}`);
        
        // Emit to all participants in the group/event (except sender)
        socket.to(eventRoom).emit("newMessage", savedMessage);
        
        // Also emit specific forwarded event
        socket.to(eventRoom).emit("forwardedToGroup", {
          message: savedMessage,
          eventId,
          forwardedBy: forwardedBy || socket.user
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

    // ======== EXISTING HANDLERS ========
    
    // Join/leave chat groups
    socket.on("join-group", (groupId) => {
      socket.join(`group-${groupId}`);
      console.log(`User ${socket.userId} joined group ${groupId}`);
    });
    
    socket.on("leave-group", (groupId) => {
      socket.leave(`group-${groupId}`);
      console.log(`User ${socket.userId} left group ${groupId}`);
    });

    // Handle typing events
    socket.on("typing", (data) => {
      const { chatId, type, isTyping, userId } = data;
      const room = type === "individual" ? `user-${chatId}` : `event-${chatId}`;
      socket.to(room).emit("typing", { 
        userId, 
        chatId, 
        type, 
        isTyping 
      });
    });

    // Real-time notification: mark as read
    socket.on("markNotificationAsRead", async ({ notificationId }) => {
      try {
        const notification = await Notification.findOneAndUpdate(
          {
            _id: notificationId,
            $or: [{ recipient: socket.userId }, { broadcastToAll: true }],
          },
          { isRead: true, readAt: new Date() },
          { new: true }
        );

        if (notification) {
          const unreadCount = await Notification.countDocuments({
            recipient: socket.userId,
            isRead: false,
          });
          socket.emit("notificationRead", { notificationId, unreadCount });
        }
      } catch (err) {
        console.error("Socket markNotificationAsRead error:", err);
      }
    });

    // Handle voice message events
    socket.on("voiceMessagePlay", (data) => {
      const { messageId, recipientId, eventId } = data;
      const room = recipientId ? `user-${recipientId}` : `event-${eventId}`;
      socket.to(room).emit("voiceMessagePlaying", { messageId });
    });

    socket.on("voiceMessageStop", (data) => {
      const { messageId, recipientId, eventId } = data;
      const room = recipientId ? `user-${recipientId}` : `event-${eventId}`;
      socket.to(room).emit("voiceMessageStopped", { messageId });
    });

    // Message status events
    socket.on("message-delivered", async (data) => {
      try {
        const { messageId, recipientId } = data;
        
        // Update in database
        await Message.findByIdAndUpdate(messageId, { 
          status: 'delivered',
          deliveredAt: new Date()
        });
        
        // Notify sender
        socket.to(`user-${recipientId}`).emit("messageStatus", {
          messageId,
          status: 'delivered',
          deliveredAt: new Date()
        });
      } catch (error) {
        console.error('Error updating message delivery status:', error);
      }
    });

    // Message reactions
    socket.on("messageReaction", async (data) => {
      try {
        const { messageId, emoji, userId } = data;
        
        // Update message with reaction
        await Message.findByIdAndUpdate(messageId, {
          $push: {
            reactions: {
              userId: userId,
              emoji: emoji,
              reactedAt: new Date()
            }
          }
        });
        
        // Broadcast to all users in the chat
        const message = await Message.findById(messageId);
        const chatRoom = message.eventId ? `event-${message.eventId}` : `user-${message.recipient}`;
        
        socket.to(chatRoom).emit("messageReaction", {
          messageId,
          emoji,
          userId,
          reactedAt: new Date()
        });
        
      } catch (error) {
        console.error('Error handling message reaction:', error);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`User ${socket.userId} disconnected: ${reason}`);
      
      // Notify all other users that this user went offline
      socket.broadcast.emit('userOffline', { userId: socket.userId });
    });
  });

  return io;
};

module.exports = { setupSocketHandlers, authenticateSocket };