// services/eventService.js
import axios from "axios";
import { useAppContext } from "../context/AppContext";

export const useEventService = () => {
  const { backendUrl, token } = useAppContext();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ==================== PUBLIC ROUTES ====================

  const fetchEvents = async (params = {}) => {
    try {
      const response = await axios.get(`${backendUrl}/api/events`, {
        headers,
        params,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching events:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch events");
    }
  };

  const fetchEventById = async (eventId) => {
    try {
      const response = await axios.get(`${backendUrl}/api/events/${eventId}`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching event:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch event");
    }
  };

  // ==================== USER ROUTES ====================

  const fetchUserEvents = async (userId) => {
    try {
      const response = await axios.get(`${backendUrl}/api/events/user/${userId}`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching user events:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch user events");
    }
  };

  // ==================== EVENT CREATOR ROUTES ====================

  const createEvent = async (eventData) => {
    try {
      const response = await axios.post(`${backendUrl}/api/events`, eventData, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error("Error creating event:", error);
      throw new Error(error.response?.data?.message || "Failed to create event");
    }
  };

  const updateEvent = async (eventId, eventData) => {
    try {
      const response = await axios.put(
        `${backendUrl}/api/events/${eventId}`,
        eventData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating event:", error);
      throw new Error(error.response?.data?.message || "Failed to update event");
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      const response = await axios.delete(`${backendUrl}/api/events/${eventId}`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw new Error(error.response?.data?.message || "Failed to delete event");
    }
  };

  const publishEvent = async (eventId) => {
    try {
      const response = await axios.patch(
        `${backendUrl}/api/events/${eventId}/publish`,
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error publishing event:", error);
      throw new Error(error.response?.data?.message || "Failed to publish event");
    }
  };

  const fetchEventStats = async (eventId) => {
    try {
      const response = await axios.get(`${backendUrl}/api/events/${eventId}/statistics`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching event stats:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch event stats");
    }
  };

  // ==================== ADMIN ROUTES ====================

  const adminUpdateEvent = async (eventId, eventData) => {
    try {
      const response = await axios.put(
        `${backendUrl}/api/events/admin/${eventId}`,
        eventData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating event (admin):", error);
      throw new Error(error.response?.data?.message || "Failed to update event");
    }
  };

  const adminDeleteEvent = async (eventId) => {
    try {
      const response = await axios.delete(`${backendUrl}/api/events/admin/${eventId}`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error("Error deleting event (admin):", error);
      throw new Error(error.response?.data?.message || "Failed to delete event");
    }
  };

  const adminPublishEvent = async (eventId) => {
    try {
      const response = await axios.patch(
        `${backendUrl}/api/events/admin/${eventId}/publish`,
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error publishing event (admin):", error);
      throw new Error(error.response?.data?.message || "Failed to publish event");
    }
  };

  const adminFetchEventStats = async (eventId) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/events/admin/${eventId}/statistics`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching event stats (admin):", error);
      throw new Error(error.response?.data?.message || "Failed to fetch event stats");
    }
  };

  const adminFetchUserEvents = async (userId) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/events/admin/user/${userId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching user events (admin):", error);
      throw new Error(error.response?.data?.message || "Failed to fetch user events");
    }
  };

  return {
    // Public
    fetchEvents,
    fetchEventById,

    // User
    fetchUserEvents,

    // Creator
    createEvent,
    updateEvent,
    deleteEvent,
    publishEvent,
    fetchEventStats,

    // Admin
    adminUpdateEvent,
    adminDeleteEvent,
    adminPublishEvent,
    adminFetchEventStats,
    adminFetchUserEvents,
  };
};
