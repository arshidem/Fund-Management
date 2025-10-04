import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { useEventService } from "../../services/eventService";
import { useParticipantService } from "../../services/participantService";

const EventDetails = () => {
  const { user } = useAppContext();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const eventService = useEventService();
  const participantService = useParticipantService();

  const [event, setEvent] = useState(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [participationData, setParticipationData] = useState(null);

  // ==================== FETCH EVENT + PARTICIPATION ====================
  useEffect(() => {
    const fetchEventAndParticipation = async () => {
      try {
        // Fetch event details
        const eventData = await eventService.fetchEventById(eventId);
        setEvent(eventData.event);

        // If logged in, check participation
        if (user) {
          const participationRes = await participantService.checkUserParticipation(eventId);
          setIsParticipating(participationRes.isParticipating);
          if (participationRes.participation) {
            setParticipationData(participationRes.participation);
          }
        }
      } catch (error) {
        console.error("Error fetching event or participation:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEventAndParticipation();
  }, [eventId, user]);

  // ==================== ACTION HANDLERS ====================
  const handleContribute = () => {
    navigate(`/events/${eventId}/contribute`);
  };

  const handleViewContribution = () => {
    navigate(`/events/${eventId}/contributions`);
  };

  const handleLeaveEvent = async () => {
    if (window.confirm("Are you sure you want to leave this event?")) {
      try {
        await participantService.leaveEvent(eventId);
        setIsParticipating(false);
        setParticipationData(null);
        alert("Successfully left the event");

        // Refresh event data
        const eventData = await eventService.fetchEventById(eventId);
        setEvent(eventData.event);
      } catch (error) {
        alert(error.message || "Failed to leave event");
      }
    }
  };

  const handleParticipate = async () => {
    try {
      setJoining(true);
      const res = await participantService.joinEvent(eventId);
      setIsParticipating(true);
      setParticipationData(res.participation || res); // depends on your join API response
      alert("Successfully joined the event");

      // Refresh event data
      const eventData = await eventService.fetchEventById(eventId);
      setEvent(eventData.event);
    } catch (error) {
      alert(error.message || "Failed to join event");
    } finally {
      setJoining(false);
    }
  };

  // ==================== CONDITIONAL RENDERING ====================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading event details...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Event not found.</div>
      </div>
    );
  }

  // Format location
  const formatLocation = (loc) => {
    if (!loc) return "N/A";
    if (event.eventType === "virtual") return loc.onlineLink || "Online Event";
    const parts = [loc.venue, loc.address, loc.city, loc.state, loc.pincode].filter(Boolean);
    return parts.join(", ");
  };

  // Check if event is full
  const isEventFull =
    event.participationType === "fixed" &&
    event.availableSpots !== "Unlimited" &&
    parseInt(event.availableSpots) <= 0;

  // Can user participate?
  const canParticipate = !isParticipating && !isEventFull && event.status === "published";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Event Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              event.status === 'published' ? 'bg-green-100 text-green-800' :
              event.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
              event.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {event.status?.charAt(0).toUpperCase() + event.status?.slice(1)}
            </span>
          </div>
          
          <p className="text-gray-600 mb-4">{event.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-2"><strong>Category:</strong> {event.category}</p>
              <p className="mb-2"><strong>Event Type:</strong> {event.eventType}</p>
              <p className="mb-2"><strong>Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
              <p className="mb-2"><strong>Time:</strong> {event.time} ({event.timezone})</p>
            </div>
            <div>
              {event.endDate && <p className="mb-2"><strong>End Date:</strong> {new Date(event.endDate).toLocaleDateString()}</p>}
              {event.endTime && <p className="mb-2"><strong>End Time:</strong> {event.endTime}</p>}
              <p className="mb-2"><strong>Location:</strong> {formatLocation(event.location)}</p>
            </div>
          </div>
        </div>

        {/* Financial Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Financial Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Min. Contribution</p>
              <p className="text-lg font-bold">{event.currency} {event.minimumContribution}</p>
            </div>
            {event.maximumContribution && (
              <div className="text-center">
                <p className="text-sm text-gray-600">Max. Contribution</p>
                <p className="text-lg font-bold">{event.currency} {event.maximumContribution}</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Collected</p>
              <p className="text-lg font-bold">{event.currency} {event.totalCollected}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Balance</p>
              <p className="text-lg font-bold">{event.currency} {event.totalCollected - event.totalExpenses}</p>
            </div>
          </div>
          
          {/* Payment Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Payment Progress</span>
              <span>{event.paymentProgress?.toFixed(1) || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${event.paymentProgress || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Participation Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Participation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Type</p>
              <p className="font-medium">{event.participationType}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Participants</p>
              <p className="font-medium">{event.participantCount || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Available Spots</p>
              <p className="font-medium">{event.availableSpots}</p>
            </div>
            {event.participationType === "fixed" && (
              <div className="text-center">
                <p className="text-sm text-gray-600">Max Participants</p>
                <p className="font-medium">{event.maxParticipants}</p>
              </div>
            )}
          </div>
        </div>

         {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {!user ? (
              <button
                onClick={() => navigate("/login")}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Login to Participate
              </button>
            ) : isParticipating ? (
              <>
                <button
                  onClick={handleContribute}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Make Contribution
                </button>
                <button
                  onClick={handleViewContribution}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  View My Contributions
                </button>
                <button
                  onClick={handleLeaveEvent}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  Leave Event
                </button>
              </>
            ) : isEventFull ? (
              <button
                disabled
                className="px-6 py-3 bg-gray-400 text-white rounded-lg font-medium cursor-not-allowed"
              >
                Event Full
              </button>
            ) : event.status !== "published" ? (
              <button
                disabled
                className="px-6 py-3 bg-gray-400 text-white rounded-lg font-medium cursor-not-allowed"
              >
                Event Not Published
              </button>
            ) : (
              <button
                onClick={handleParticipate}
                disabled={joining}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
              >
                {joining ? "Joining..." : "Participate in Event"}
              </button>
            )}

            {/* Back to Events Button */}
            <button
              onClick={() => navigate("/events")}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-medium"
            >
              Back to Events
            </button>
          </div>

          {/* Participation Status */}
          {user && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm">
                <strong>Your Status:</strong>{" "}
                {isParticipating ? (
                  <span className="text-green-600">✅ Participating in this event</span>
                ) : (
                  <span className="text-gray-600">❌ Not participating</span>
                )}
              </p>
              {participationData && (
                <p className="text-xs text-gray-500 mt-1">
                  Joined on:{" "}
                  {new Date(
                    participationData.createdAt || participationData.joinedAt
                  ).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetails;