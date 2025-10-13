import React, { useState, useEffect } from "react";
import { 
  FaMapMarkerAlt, FaCalendar, FaUsers, FaChartLine, FaShareAlt, 
  FaEdit, FaClock, FaGlobe, FaUser, FaUserPlus, FaUserMinus, 
  FaMoneyBillWave, FaInfoCircle, FaExclamationTriangle, FaCheck 
} from "react-icons/fa";
import { useParticipantService } from "../../../../services/participantService";

const OverviewTab = ({ event, user, isEventCreator, formatCurrency, formatDate, formatTime }) => {
  const participantService = useParticipantService();
  
  const [participationStatus, setParticipationStatus] = useState({
    isParticipating: false,
    participantData: null,
    loading: true
  });
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Check user participation status
  useEffect(() => {
    checkParticipationStatus();
  }, [event._id]);

  const checkParticipationStatus = async () => {
    try {
      const result = await participantService.checkUserParticipation(event._id);
      setParticipationStatus({
        isParticipating: result.isParticipating,
        participantData: result.participation || null,
        loading: false
      });
    } catch (error) {
      console.error("Error checking participation:", error);
      setParticipationStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleJoinEvent = async () => {
    setJoining(true);
    try {
      const result = await participantService.joinEvent(event._id);
      if (result.success) {
        setParticipationStatus({
          isParticipating: true,
          participantData: result.participant,
          loading: false
        });
        alert("Successfully joined the event!");
      } else {
        alert(result.message || "Failed to join the event.");
      }
    } catch (error) {
      console.error("Error joining event:", error);
      alert(error.message || "Failed to join the event. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveEvent = async () => {
    if (!window.confirm("Are you sure you want to leave this event?")) return;
    
    setLeaving(true);
    try {
      const result = await participantService.leaveEvent(event._id);
      if (result.success) {
        setParticipationStatus({
          isParticipating: false,
          participantData: null,
          loading: false
        });
        alert("Successfully left the event!");
      } else {
        alert(result.message || "Failed to leave the event.");
      }
    } catch (error) {
      console.error("Error leaving event:", error);
      alert(error.message || "Failed to leave the event. Please try again.");
    } finally {
      setLeaving(false);
    }
  };

  const handleShareEvent = () => {
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: event.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Event link copied to clipboard!");
    }
  };

  const handleManageEvent = () => {
    // Navigate to event management page or open modal
    console.log("Manage event clicked");
  };

  const handleViewParticipants = () => {
    // Navigate to participants tab or open participants modal
    console.log("View participants clicked");
  };

  const handleInviteParticipants = () => {
    // Open invite participants modal
    console.log("Invite participants clicked");
  };

  // Render participation status badge
  const renderParticipationStatus = () => {
    if (participationStatus.loading) {
      return (
        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-sm font-medium">
          Checking...
        </span>
      );
    }

    if (participationStatus.isParticipating) {
      const status = participationStatus.participantData?.status;
      const paymentStatus = participationStatus.participantData?.paymentStatus;
      
      return (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium flex items-center gap-1">
            <FaCheck className="text-xs" />
            Joined
          </span>
          {status && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
              status === 'waitlisted' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {status}
            </span>
          )}
          {paymentStatus && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              paymentStatus === 'paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
              paymentStatus === 'partial' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
              paymentStatus === 'pending' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {paymentStatus}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  // Render quick actions based on user role and participation status
  const renderQuickActions = () => {
    if (participationStatus.loading) {
      return (
        <div className="space-y-3">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Join/Leave Event Button */}
        {!participationStatus.isParticipating ? (
          <button 
            onClick={handleJoinEvent}
            disabled={joining || event.status !== 'published'}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
          >
            {joining ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Joining...
              </>
            ) : (
              <>
                <FaUserPlus className="text-sm" />
                Join Event
              </>
            )}
          </button>
        ) : (
          <button 
            onClick={handleLeaveEvent}
            disabled={leaving}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
          >
            {leaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Leaving...
              </>
            ) : (
              <>
                <FaUserMinus className="text-sm" />
                Leave Event
              </>
            )}
          </button>
        )}

        {/* Share Event Button */}
        <button 
          onClick={handleShareEvent}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
        >
          <FaShareAlt className="text-sm" />
          Share Event
        </button>

        {/* Event Creator Actions */}
        {isEventCreator && (
          <>
            <button 
              onClick={handleManageEvent}
              className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <FaEdit className="text-sm" />
              Manage Event
            </button>
            <button 
              onClick={handleViewParticipants}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <FaUsers className="text-sm" />
              View Participants
            </button>
            <button 
              onClick={handleInviteParticipants}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <FaUserPlus className="text-sm" />
              Invite Participants
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Event Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Event Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Status</span>
            <span className="text-gray-900 dark:text-white font-semibold capitalize">{event.status}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Category</span>
            <span className="text-gray-900 dark:text-white font-semibold capitalize">{event.category}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Type</span>
            <span className="text-gray-900 dark:text-white font-semibold capitalize">{event.eventType}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Visibility</span>
            <span className="text-gray-900 dark:text-white font-semibold capitalize">{event.visibility}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600 dark:text-gray-400">Created</span>
            <span className="text-gray-900 dark:text-white font-semibold">{formatDate(event.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Location Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FaMapMarkerAlt className="text-red-500 dark:text-red-400" />
          Location
        </h3>
        {event.eventType === 'virtual' ? (
          <div className="space-y-3">
            <p className="text-gray-900 dark:text-white font-semibold mb-2">Virtual Event</p>
            {event.location?.onlineLink && (
              <a 
                href={event.location.onlineLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                <FaGlobe className="text-sm" />
                Join Online Meeting
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {event.location?.venue && (
              <p className="text-gray-900 dark:text-white font-semibold">{event.location.venue}</p>
            )}
            {event.location?.address && (
              <p className="text-gray-600 dark:text-gray-300">{event.location.address}</p>
            )}
            {(event.location?.city || event.location?.state) && (
              <p className="text-gray-600 dark:text-gray-300">
                {event.location.city}{event.location.city && event.location.state ? ', ' : ''}{event.location.state}
              </p>
            )}
            {event.location?.pincode && (
              <p className="text-gray-600 dark:text-gray-300">PIN: {event.location.pincode}</p>
            )}
            {event.location?.coordinates && (
              <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
                View on Map
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress Bars */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Progress</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Participation</span>
              <span className="text-gray-900 dark:text-white">
                {event.participantCount || 0} / {event.participationType === 'unlimited' ? '∞' : event.maxParticipants}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-full transition-all duration-500"
                style={{ 
                  width: event.participationType === 'unlimited' ? '100%' : 
                  `${Math.min(100, ((event.participantCount || 0) / event.maxParticipants) * 100)}%` 
                }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Payment Progress</span>
              <span className="text-gray-900 dark:text-white">{event.paymentProgress?.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${event.paymentProgress || 0}%` }}
              ></div>
            </div>
          </div>

          {event.estimatedBudget && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Budget Utilization</span>
                <span className="text-gray-900 dark:text-white">{event.budgetUtilization?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{ width: `${event.budgetUtilization || 0}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Quick Actions</h3>
          {renderParticipationStatus()}
        </div>
        {renderQuickActions()}
      </div>

      {/* Your Participation Status */}
      {participationStatus.isParticipating && participationStatus.participantData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm md:col-span-2">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaUser className="text-green-500 dark:text-green-400" />
            Your Participation Status
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                {formatCurrency(participationStatus.participantData.totalContributed || 0)}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">Total Contributed</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                {formatCurrency(participationStatus.participantData.remainingAmount || 0)}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">Remaining Amount</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                {participationStatus.participantData.paymentPercentage?.toFixed(1) || 0}%
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">Payment Progress</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                {participationStatus.participantData.daysSinceJoined || 0}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">Days Since Joined</div>
            </div>
          </div>
        </div>
      )}

      {/* Event Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm md:col-span-2">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FaClock className="text-blue-500 dark:text-blue-400" />
          Event Timeline
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-600 mt-1"></div>
            </div>
            <div className="flex-1">
              <p className="text-gray-900 dark:text-white font-semibold">Event Starts</p>
              <p className="text-gray-600 dark:text-gray-400">
                {formatDate(event.date)} at {formatTime(event.time)}
              </p>
            </div>
          </div>
          
          {event.endDate && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-600 mt-1"></div>
              </div>
              <div className="flex-1">
                <p className="text-gray-900 dark:text-white font-semibold">Event Ends</p>
                <p className="text-gray-600 dark:text-gray-400">
                  {formatDate(event.endDate)} at {formatTime(event.endTime)}
                </p>
              </div>
            </div>
          )}

          {event.paymentDeadline && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              </div>
              <div className="flex-1">
                <p className="text-gray-900 dark:text-white font-semibold">Payment Deadline</p>
                <p className="text-gray-600 dark:text-gray-400">
                  {formatDate(event.paymentDeadline)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;