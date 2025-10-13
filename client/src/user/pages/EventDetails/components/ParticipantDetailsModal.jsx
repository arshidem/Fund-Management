import React from "react";
import { FaTimes, FaMoneyBillWave, FaCalendar, FaReceipt } from "react-icons/fa";

const ParticipantDetailsModal = ({ participant, contributions, event, onClose, formatCurrency, formatDate }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {participant.user.name} - Details
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <FaTimes />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Participant Info */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Personal Information</h4>
              <div className="space-y-2">
                <p><strong>Email:</strong> {participant.user.email}</p>
                <p><strong>Phone:</strong> {participant.user.phone || 'Not provided'}</p>
                <p><strong>Joined:</strong> {formatDate(participant.joinedAt)}</p>
                <p><strong>Status:</strong> <span className="capitalize">{participant.status}</span></p>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Payment Information</h4>
              <div className="space-y-2">
                <p><strong>Total Contributed:</strong> {formatCurrency(participant.totalContributed)}</p>
                <p><strong>Payment Status:</strong> <span className="capitalize">{participant.paymentStatus}</span></p>
                <p><strong>Remaining Amount:</strong> {formatCurrency(participant.remainingAmount)}</p>
                <p><strong>Progress:</strong> {participant.paymentPercentage?.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          
          {/* Contribution History */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Contribution History</h4>
            {contributions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No contributions found</p>
            ) : (
              <div className="space-y-3">
                {contributions.map(contribution => (
                  <div key={contribution._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FaMoneyBillWave className="text-green-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(contribution.amount)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {contribution.paymentMethod} • {contribution.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(contribution.paymentDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantDetailsModal;