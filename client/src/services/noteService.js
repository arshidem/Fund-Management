import axios from 'axios';
import { useAppContext } from '../context/AppContext';

export const useNoteService = () => {
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
      console.error('Note API Error:', error.response?.data || error.message);
      throw error;
    }
  };

  return {
    // ==================== NOTE MANAGEMENT ====================
    
    // Get all notes (for admin dashboard)
    getAllNotes: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      return await createRequest('GET', `/notes?${params}`);
    },

    // Get notes for a specific user
    getUserNotes: async (userId, page = 1, limit = 20) => {
      const params = new URLSearchParams({ page, limit });
      return await createRequest('GET', `/notes/user/${userId}?${params}`);
    },

    // Create a new note
    createNote: async (userId, note, category = 'general', tags = [], isPrivate = true) => {
      return await createRequest('POST', '/notes', {
        userId,
        note,
        category,
        tags,
        isPrivate
      });
    },

    // Update an existing note
    updateNote: async (noteId, updates) => {
      return await createRequest('PUT', `/notes/${noteId}`, updates);
    },

    // Delete a note
    deleteNote: async (noteId) => {
      return await createRequest('DELETE', `/notes/${noteId}`);
    },

    // ==================== QUICK NOTE ACTIONS ====================
    
    // Add general note
    addGeneralNote: async (userId, note) => {
      return await createRequest('POST', '/notes', {
        userId,
        note,
        category: 'general',
        isPrivate: true
      });
    },

    // Add warning note
    addWarningNote: async (userId, note) => {
      return await createRequest('POST', '/notes', {
        userId,
        note,
        category: 'warning',
        isPrivate: true
      });
    },

    // Add follow-up note
    addFollowUpNote: async (userId, note) => {
      return await createRequest('POST', '/notes', {
        userId,
        note,
        category: 'follow_up',
        isPrivate: true
      });
    },

    // Add positive note
    addPositiveNote: async (userId, note) => {
      return await createRequest('POST', '/notes', {
        userId,
        note,
        category: 'positive',
        isPrivate: false
      });
    }
  };
};

export default useNoteService;