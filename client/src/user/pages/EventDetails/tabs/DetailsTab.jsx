import React from "react";
import { FaCalendar, FaClock, FaUsers, FaMoneyBillWave, FaTag, FaInfoCircle } from "react-icons/fa";

const DetailsTab = ({ event, formatCurrency, formatDate, formatTime }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <FaInfoCircle className="text-blue-500 dark:text-blue-400" />
        Event Details
      </h3>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Description */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FaInfoCircle className="text-gray-500 dark:text-gray-400 text-sm" />
              Description
            </h4>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              {event.description}
            </p>
          </div>
          
          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FaTag className="text-gray-500 dark:text-gray-400 text-sm" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1.5 rounded-full text-sm font-medium border border-blue-200 dark:border-blue-800"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* Date & Time */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FaCalendar className="text-gray-500 dark:text-gray-400 text-sm" />
              Date & Time
            </h4>
            <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Start:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatDate(event.date)} at {formatTime(event.time)}
                </span>
              </div>
              {event.endDate && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">End:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatDate(event.endDate)} at {formatTime(event.endTime)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Timezone:</span>
                <span className="text-gray-900 dark:text-white font-medium">{event.timezone}</span>
              </div>
            </div>
          </div>
          
          {/* Participation Details */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FaUsers className="text-gray-500 dark:text-gray-400 text-sm" />
              Participation
            </h4>
            <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="text-gray-900 dark:text-white font-medium capitalize">
                  {event.participationType}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Available Spots:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {event.availableSpots}
                </span>
              </div>
              {event.paymentDeadline && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Payment Deadline:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatDate(event.paymentDeadline)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Requirements */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FaMoneyBillWave className="text-gray-500 dark:text-gray-400 text-sm" />
              Financial Requirements
            </h4>
            <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Minimum Contribution:</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  {formatCurrency(event.minimumContribution)}
                </span>
              </div>
              {event.maximumContribution && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Maximum Contribution:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {formatCurrency(event.maximumContribution)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Allow Partial Payments:</span>
                <span className={`font-semibold ${
                  event.allowPartialPayments ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {event.allowPartialPayments ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Allow Late Payments:</span>
                <span className={`font-semibold ${
                  event.allowLatePayments ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {event.allowLatePayments ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Additional Information</h4>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {event.views || 0}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Total Views</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
              {event.totalInterested || 0}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Interested Users</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {event.daysRemaining > 0 ? event.daysRemaining : 0}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Days Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsTab;