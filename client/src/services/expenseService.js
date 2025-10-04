// services/expenseService.js
import axios from "axios";
import { useAppContext } from "../../../context/AppContext";

export const useExpenseService = () => {
  const { backendUrl } = useAppContext();
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ==================== USER ROUTES (VIEW ONLY) ====================

  const fetchEventExpenses = async (eventId, params = {}) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/expenses/events/${eventId}/expenses`,
        { headers, params }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching event expenses:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch expenses");
    }
  };

  const fetchExpenseById = async (expenseId) => {
    try {
      const response = await axios.get(`${backendUrl}/api/expenses/${expenseId}`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching expense:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch expense");
    }
  };

  const fetchExpenseStatistics = async (eventId) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/expenses/events/${eventId}/expenses/statistics`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching expense statistics:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch expense statistics");
    }
  };

  // ==================== ADMIN-ONLY ROUTES ====================

  const createExpense = async (eventId, expenseData) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/expenses/events/${eventId}/expenses`,
        expenseData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error creating expense:", error);
      throw new Error(error.response?.data?.message || "Failed to create expense");
    }
  };

  const updateExpense = async (expenseId, updateData) => {
    try {
      const response = await axios.put(
        `${backendUrl}/api/expenses/${expenseId}`,
        updateData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating expense:", error);
      throw new Error(error.response?.data?.message || "Failed to update expense");
    }
  };

  const deleteExpense = async (expenseId) => {
    try {
      const response = await axios.delete(
        `${backendUrl}/api/expenses/${expenseId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error deleting expense:", error);
      throw new Error(error.response?.data?.message || "Failed to delete expense");
    }
  };

  const addReceipt = async (expenseId, receiptData) => {
    try {
      const response = await axios.patch(
        `${backendUrl}/api/expenses/${expenseId}/receipt`,
        receiptData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error adding receipt:", error);
      throw new Error(error.response?.data?.message || "Failed to add receipt");
    }
  };

  const approveExpense = async (expenseId, notes) => {
    try {
      const response = await axios.patch(
        `${backendUrl}/api/expenses/${expenseId}/approve`,
        { notes },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error approving expense:", error);
      throw new Error(error.response?.data?.message || "Failed to approve expense");
    }
  };

  const rejectExpense = async (expenseId, reason) => {
    try {
      const response = await axios.patch(
        `${backendUrl}/api/expenses/${expenseId}/reject`,
        { reason },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error rejecting expense:", error);
      throw new Error(error.response?.data?.message || "Failed to reject expense");
    }
  };

  return {
    // User
    fetchEventExpenses,
    fetchExpenseById,
    fetchExpenseStatistics,

    // Admin
    createExpense,
    updateExpense,
    deleteExpense,
    addReceipt,
    approveExpense,
    rejectExpense,
  };
};
