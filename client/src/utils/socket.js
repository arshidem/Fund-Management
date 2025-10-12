// src/utils/socket.js
import { io } from "socket.io-client";

let socket = null;

class SocketService {
  connect(backendUrl, token) {
    return new Promise((resolve, reject) => {
      if (!backendUrl) {
        return reject(new Error("backendUrl is required to connect SocketService"));
      }

      // reuse existing socket if connected
      if (socket && socket.connected) return resolve(socket);

      // create socket instance
      socket = io(backendUrl, {
        auth: token ? { token } : undefined,
        transports: ["websocket"],
        autoConnect: true,
      });

      const onConnect = () => {
        cleanup();
        resolve(socket);
      };
      const onError = (err) => {
        cleanup();
        reject(err);
      };

      function cleanup() {
        socket.off("connect", onConnect);
        socket.off("connect_error", onError);
      }

      socket.on("connect", onConnect);
      socket.on("connect_error", onError);

      // optional timeout fallback
      setTimeout(() => {
        if (!socket.connected) {
          cleanup();
          reject(new Error("Socket connection timeout"));
        }
      }, 5000);
    });
  }

  joinUserRoom(userId) {
    if (!socket) return;
    // emit both in case server is listening to one of them
    socket.emit("join", userId);
    socket.emit("joinUser", userId);
  }

  joinAdminRoom(adminId) {
    if (!socket) return;
    // emit both common admin join names
    socket.emit("joinAdmin", adminId);
    socket.emit("join", adminId);
  }

  disconnect() {
    if (!socket) return;
    try {
      socket.disconnect();
    } catch (e) {
      // ignore
    }
    socket = null;
  }

  getSocket() {
    return socket;
  }
}

export default new SocketService();
