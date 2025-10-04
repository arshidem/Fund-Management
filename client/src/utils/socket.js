import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.connectionTimeout = null;
  }

  async connect(token) {
    if (this.socket?.connected) return this.socket;
    if (this.isConnecting) return this.connectionPromise;

    this.isConnecting = true;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log('🔄 Connecting to socket...');

        this.socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        const clearTimeoutFunc = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
        };

        this.socket.on('connect', () => {
          console.log('✅ Socket connected:', this.socket.id);
          this.isConnecting = false;
          clearTimeoutFunc();
          resolve(this.socket);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('❌ Socket disconnected:', reason);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('🔌 Connection error:', error.message);
          this.isConnecting = false;
          clearTimeoutFunc();
          reject(error);
        });

        this.connectionTimeout = setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error('Socket connection timeout'));
          }
        }, 10000);

      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting socket...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      this.connectionPromise = null;
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
    }
  }

  joinUserRoom(userId) {
    if (this.socket?.connected) {
      console.log('👤 Joining user room:', userId);
      this.socket.emit('join', userId); // matches your backend "join" listener
    } else {
      console.warn('⚠️ Cannot join user room: Socket not connected');
    }
  }

  joinAdminRoom(adminId) {
    if (this.socket?.connected) {
      console.log('👑 Joining admin room:', adminId);
      this.socket.emit('join', adminId); // backend treats all rooms as "join"
    } else {
      console.warn('⚠️ Cannot join admin room: Socket not connected');
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

// Single instance
const socketService = new SocketService();
export default socketService;
