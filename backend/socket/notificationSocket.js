const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const setupNotificationSocket = (io) => {
  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id role name email');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected for notifications`);

    // Join user to their personal room for targeted notifications
    socket.join(socket.userId);

    // Join admin to admin room if user is admin
    if (socket.user.role === 'admin') {
      socket.join('admin');
    }

    // Handle notification events
    socket.on('markAsRead', async (data) => {
      try {
        const { notificationId } = data;
        const notification = await Notification.findOneAndUpdate(
          {
            _id: notificationId,
            $or: [
              { recipient: socket.userId },
              { broadcastToAll: true }
            ]
          },
          {
            isRead: true,
            readAt: new Date()
          },
          { new: true }
        );

        if (notification) {
          const unreadCount = await Notification.getUnreadCount(socket.userId);
          socket.emit('notificationRead', { notificationId, unreadCount });
        }
      } catch (error) {
        console.error('Socket markAsRead error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });

  return io;
};

module.exports = setupNotificationSocket;