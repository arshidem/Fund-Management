// services/participantService.js
import axios from "axios";
import { useAppContext } from "../context/AppContext";

export const useParticipantService = () => {
  const { backendUrl, token } = useAppContext();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ==================== USER ACTIONS ====================

  const joinEvent = async (eventId, notes = "") => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/participants/events/${eventId}/join`,
        { notes },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error joining event:", error);
      throw new Error(error.response?.data?.message || "Failed to join event");
    }
  };

  const leaveEvent = async (eventId) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/participants/events/${eventId}/leave`,
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error leaving event:", error);
      throw new Error(error.response?.data?.message || "Failed to leave event");
    }
  };

  // ==================== USER DATA ====================

  const fetchUserParticipations = async (userId, params = {}) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/participants/user/${userId}/participations`,
        { headers, params }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching user participations:", error);
      throw new Error(
        error.response?.data?.message || "Failed to fetch user participations"
      );
    }
  };

  const fetchParticipantDetails = async (participantId) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/participants/${participantId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching participant details:", error);
      throw new Error(
        error.response?.data?.message || "Failed to fetch participant details"
      );
    }
  };

  // ==================== EVENT CREATOR ROUTES ====================

  const fetchEventParticipants = async (eventId, params = {}) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/participants/events/${eventId}/participants`,
        { headers, params }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching event participants:", error);
      throw new Error(
        error.response?.data?.message || "Failed to fetch event participants"
      );
    }
  };

  const updateParticipantStatus = async (participantId, updateData) => {
    try {
      const response = await axios.put(
        `${backendUrl}/api/participants/${participantId}/status`,
        updateData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating participant status:", error);
      throw new Error(
        error.response?.data?.message || "Failed to update participant status"
      );
    }
  };

  const removeParticipant = async (participantId, reason = "") => {
    try {
      const response = await axios.delete(
        `${backendUrl}/api/participants/${participantId}`,
        { headers, data: { reason } }
      );
      return response.data;
    } catch (error) {
      console.error("Error removing participant:", error);
      throw new Error(
        error.response?.data?.message || "Failed to remove participant"
      );
    }
  };

  const inviteParticipant = async (eventId, payload) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/participants/events/${eventId}/invite`,
        payload,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error inviting participant:", error);
      throw new Error(
        error.response?.data?.message || "Failed to invite participant"
      );
    }
  };

  // ==================== ADMIN-ONLY ROUTES ====================

  const fetchEventParticipantsAdmin = async (eventId, params = {}) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/participants/admin/events/${eventId}/participants`,
        { headers, params }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching event participants (admin):", error);
      throw new Error(
        error.response?.data?.message ||
          "Failed to fetch event participants (admin)"
      );
    }
  };

  const updateParticipantStatusAdmin = async (participantId, updateData) => {
    try {
      const response = await axios.put(
        `${backendUrl}/api/participants/admin/${participantId}/status`,
        updateData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating participant status (admin):", error);
      throw new Error(
        error.response?.data?.message ||
          "Failed to update participant status (admin)"
      );
    }
  };

  const removeParticipantAdmin = async (participantId, reason = "") => {
    try {
      const response = await axios.delete(
        `${backendUrl}/api/participants/admin/${participantId}`,
        { headers, data: { reason } }
      );
      return response.data;
    } catch (error) {
      console.error("Error removing participant (admin):", error);
      throw new Error(
        error.response?.data?.message ||
          "Failed to remove participant (admin)"
      );
    }
  };
// ==================== CHECK PARTICIPATION STATUS ====================
  const checkUserParticipation = async (eventId) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/participants/events/${eventId}/check`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error checking participation:", error);
      throw new Error(
        error.response?.data?.message || "Failed to check participation"
      );
    }
  };
  return {
    // User
    joinEvent,
    leaveEvent,
    fetchUserParticipations,
    fetchParticipantDetails,
    checkUserParticipation,
    // Event Creator
    fetchEventParticipants,
    updateParticipantStatus,
    removeParticipant,
    inviteParticipant,

    // Admin
    fetchEventParticipantsAdmin,
    updateParticipantStatusAdmin,
    removeParticipantAdmin,
  };
};
