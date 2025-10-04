// services/useContributionService.js
import axios from "axios";
import { useAppContext } from "../../../context/AppContext";

export const useContributionService = () => {
  const { backendUrl, token } = useAppContext();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ==================== PAYMENT ROUTES ====================

  // ✅ Create Razorpay order (requires { amount })
  const createRazorpayOrder = async (eventId, amount) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/contributions/events/${eventId}/contributions/razorpay/order`,
        { amount },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error creating Razorpay order:", error);
      throw new Error(error.response?.data?.message || "Failed to create Razorpay order");
    }
  };

  // ✅ Verify Razorpay payment (requires { razorpay_payment_id, razorpay_order_id, razorpay_signature })
  const verifyRazorpayPayment = async (contributionId, { razorpay_payment_id, razorpay_order_id, razorpay_signature }) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/contributions/contributions/${contributionId}/verify-razorpay`,
        { razorpay_payment_id, razorpay_order_id, razorpay_signature },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error verifying Razorpay payment:", error);
      throw new Error(error.response?.data?.message || "Failed to verify payment");
    }
  };

  // ✅ Create offline contribution (requires { amount, paymentMethod, transactionId?, notes? })
  const createOfflineContribution = async (eventId, { amount, paymentMethod, transactionId, notes }) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/contributions/events/${eventId}/contributions/offline`,
        { amount, paymentMethod, transactionId, notes },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error creating offline contribution:", error);
      throw new Error(error.response?.data?.message || "Failed to create offline contribution");
    }
  };

  // ==================== USER ROUTES ====================

  // ✅ Fetch a user's contributions (optional: { eventId, page, limit })
  const fetchUserContributions = async (userId, params = {}) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/contributions/user/${userId}/contributions`,
        { headers, params }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching user contributions:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch user contributions");
    }
  };

  // ==================== EVENT CREATOR + ADMIN ROUTES ====================

  // ✅ Fetch contributions for an event (optional: { status, paymentMethod, page, limit })
  const fetchEventContributions = async (eventId, params = {}) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/contributions/events/${eventId}/contributions`,
        { headers, params }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching event contributions:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch event contributions");
    }
  };

  // ✅ Fetch event contribution statistics
  const fetchContributionStatistics = async (eventId) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/contributions/events/${eventId}/contributions/statistics`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching contribution stats:", error);
      throw new Error(error.response?.data?.message || "Failed to fetch contribution stats");
    }
  };

  // ==================== ADMIN ROUTES ====================

  // ✅ Update contribution status (requires { status, verifiedBy?, notes? })
  const updateContributionStatus = async (contributionId, { status, verifiedBy, notes }) => {
    try {
      const response = await axios.put(
        `${backendUrl}/api/contributions/${contributionId}/status`,
        { status, verifiedBy, notes },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating contribution status:", error);
      throw new Error(error.response?.data?.message || "Failed to update contribution status");
    }
  };

  // ✅ Process refund (requires { refundAmount, refundReason })
  const processRefund = async (contributionId, { refundAmount, refundReason }) => {
    try {
      const response = await axios.patch(
        `${backendUrl}/api/contributions/${contributionId}/refund`,
        { refundAmount, refundReason },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Error processing refund:", error);
      throw new Error(error.response?.data?.message || "Failed to process refund");
    }
  };

  return {
    createRazorpayOrder,
    verifyRazorpayPayment,
    createOfflineContribution,
    fetchUserContributions,
    fetchEventContributions,
    fetchContributionStatistics,
    updateContributionStatus,
    processRefund,
  };
};
