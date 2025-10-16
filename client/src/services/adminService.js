import axios from 'axios';
import { useAppContext } from '../context/AppContext';

export const useAdminService = () => {
  const { token, backendUrl } = useAppContext();

  const createRequest = async (method, endpoint, data = null) => {
    try {
      const config = {
        method,
        url: `${backendUrl}/api/admin${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Admin API Error:', error.response?.data || error.message);
      throw error;
    }
  };

  return {
    // ==================== USER MANAGEMENT ====================
    
    // Get all users with filters
    getAllUsers: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      return await createRequest('GET', `/users?${params}`);
    },

    // Get user by ID
    getUserById: async (userId) => {
      return await createRequest('GET', `/users/${userId}`);
    },

    // Get enhanced user profile with participation stats
    getUserProfile: async (userId) => {
      return await createRequest('GET', `/users/${userId}/profile`);
    },

    // Get user activity timeline
    getUserActivity: async (userId, page = 1, limit = 20) => {
      const params = new URLSearchParams({ page, limit });
      return await createRequest('GET', `/users/${userId}/activity?${params}`);
    },

    // Approve user registration
    approveUser: async (userId, notes = '') => {
      return await createRequest('PUT', `/users/${userId}/approve`, { notes });
    },

    // Reject user registration
    rejectUser: async (userId, reason = '') => {
      return await createRequest('PUT', `/users/${userId}/reject`, { reason });
    },

 


    // Update user role
    updateUserRole: async (userId, role) => {
      return await createRequest('PUT', `/users/${userId}/role`, { role });
    },

    // Bulk actions (approve multiple users)
    bulkAction: async (userIds, action) => {
      return await createRequest('POST', '/users/bulk-action', { userIds, action });
    }
  };
};

export default useAdminService;