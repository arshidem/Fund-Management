// server/socket/index.js
const { setupSocketHandlers } = require('./socketHandlers');

const initializeSocket = (server, corsOptions) => {
  const socketIo = require('socket.io');
  
  const io = socketIo(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
  });

  // Setup all socket handlers
  setupSocketHandlers(io);

  return io;
};

module.exports = { initializeSocket };