import React, { useState, useRef, useEffect } from "react";
import { FaTimes, FaMoneyBillWave, FaUser } from "react-icons/fa";

const AddOfflineContributionModal = ({ participant, event, onSubmit, onClose, formatCurrency }) => {
  const [formData, setFormData] = useState({
    amount: event.minimumContribution - participant.totalContributed > 0 
      ? event.minimumContribution - participant.totalContributed 
      : event.minimumContribution,
    paymentMethod: "cash",
    transactionId: `CASH_${Date.now()}`,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  
  const modalRef = useRef(null);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Handle escape key
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
      console.log('Frontend sending data:', {
    participant: participant,
    participantId: participant._id,
    userId: participant.user._id,
    eventId: event._id,
    formData: formData
  });
    try {
      await onSubmit({
        ...formData,
        participantId: participant._id,
        userId: participant.user_id,
        eventId: event._id,
      });
      onClose();

    } catch (error) {
      console.error("Error submitting contribution:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const remainingAmount = event.minimumContribution - participant.totalContributed;
  const suggestedAmount = remainingAmount > 0 ? remainingAmount : event.minimumContribution;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div 
        ref={modalRef}
        className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 flex flex-col max-h-[80vh]"
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex justify-between items-center p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FaMoneyBillWave className="text-green-400 text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Add Offline Contribution</h3>
              <p className="text-gray-400 text-sm">Record cash payment from participant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
          >
            <FaTimes />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Participant Info */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                {participant.user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white">{participant.user.name}</p>
                <p className="text-gray-400 text-sm">{participant.user.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Current Total</p>
                <p className="text-green-400 font-semibold">{formatCurrency(participant.totalContributed)}</p>
              </div>
              <div>
                <p className="text-gray-400">Minimum Required</p>
                <p className="text-yellow-400 font-semibold">{formatCurrency(event.minimumContribution)}</p>
              </div>
              {remainingAmount > 0 && (
                <div className="col-span-2">
                  <p className="text-gray-400">Remaining to Pay</p>
                  <p className="text-red-400 font-semibold">{formatCurrency(remainingAmount)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  ₹
                </span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  min="1"
                  step="1"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                  placeholder="Enter amount"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Suggested: {formatCurrency(suggestedAmount)}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
              </select>
            </div>

            {/* Transaction ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Transaction Reference
              </label>
              <input
                type="text"
                name="transactionId"
                value={formData.transactionId}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                placeholder="Enter transaction reference"
              />
              <p className="text-xs text-gray-400 mt-1">
                Auto-generated reference for cash payments
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 resize-none"
                placeholder="Add any additional notes about this payment..."
              />
            </div>
          </form>
        </div>

        {/* Fixed Action Buttons at Bottom */}
        <div className="flex-shrink-0 p-6 border-t border-gray-700 bg-gray-800 rounded-b-xl">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <FaMoneyBillWave />
                  Add Contribution
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddOfflineContributionModal;