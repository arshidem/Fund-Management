import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Create axios instance with better configuration
const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000, // 10 second timeout
  maxContentLength: 50 * 1024 * 1024, // 50MB
  maxBodyLength: 50 * 1024 * 1024, // 50MB
});

// Request interceptor
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 5;

api.interceptors.request.use(
  (config) => {
    // Cancel request if too many concurrent requests
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      return Promise.reject(new Error('Too many concurrent requests'));
    }
    
    activeRequests++;
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add cache busting for GET requests
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(), // cache buster
      };
    }
    
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url} (Active: ${activeRequests})`);
    return config;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    console.error(`❌ API Error: ${error.message}`, error.config?.url);
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/signin';
    }
    
    // Handle network errors
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error - check if backend server is running');
    }
    
    return Promise.reject(error);
  }
);

export const notificationAPI = {
  // Get all notifications for current user
  getNotifications: async (page = 1, limit = 20, filters = {}) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters
      });

      const response = await api.get(`/notifications?${params}`);
      return response.data;
    } catch (error) {
      console.error('getNotifications error:', error);
      throw error;
    }
  },

  // Get unread notifications count
  getUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      return response.data;
    } catch (error) {
      console.error('getUnreadCount error:', error);
      // Return default value instead of throwing for this non-critical call
      return { success: false, data: { unreadCount: 0 } };
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error('markAsRead error:', error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      const response = await api.put('/notifications/mark-all-read');
      return response.data;
    } catch (error) {
      console.error('markAllAsRead error:', error);
      throw error;
    }
  },

  // Delete a notification
  deleteNotification: async (notificationId) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('deleteNotification error:', error);
      throw error;
    }
  }
};

export default notificationAPI;