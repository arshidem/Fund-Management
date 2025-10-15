import React, { useEffect, useState } from "react";
import { useEventService } from "../../services/eventService";
import { Link } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaArrowUp,
  FaShare,
  FaCalendar,
  FaMapMarkerAlt,
  FaUsers,
  FaTimes,
  FaMoneyBillWave,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import EventForm from "../../user/pages/EventDetails/components/EventForm";
import { toast } from "react-hot-toast";
import ConfirmModal from "../components/ConfirmModal";
const Event = () => {
  const { fetchEvents, deleteEvent, publishEvent, createEvent, updateEvent } =
    useEventService();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "", // 'delete' or 'publish'
    eventId: null,
    eventTitle: "",
    message: "",
    confirmText: "",
    onConfirm: null,
  });
  const { user } = useAppContext();

  // Check if user is admin (you can replace this with your actual admin check)
const isAdmin = user?.role === "admin";
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await fetchEvents({ limit: 20 });
      setEvents(data.events);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Event with ConfirmModal - Simplified
  const handleDeleteEvent = (eventId, eventTitle) => {
    setConfirmModal({
      isOpen: true,
      type: "delete",
      eventId,
      eventTitle,
      message: `Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`,
      confirmText: "Delete Event",
    });
  };

  const handleConfirmDelete = async () => {
    const { eventId, eventTitle } = confirmModal;

    setActionLoading(eventId);
    try {
      await deleteEvent(eventId);
      setEvents(events.filter((event) => event._id !== eventId));
      alert("Event deleted successfully!");
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event: " + error.message);
    } finally {
      setActionLoading(null);
      setConfirmModal({
        isOpen: false,
        type: "",
        eventId: null,
        eventTitle: "",
        message: "",
        confirmText: "",
      });
    }
  };

  // Publish Event with ConfirmModal - Simplified
  const handlePublishEvent = (eventId, eventTitle) => {
    setConfirmModal({
      isOpen: true,
      type: "publish",
      eventId,
      eventTitle,
      message: `Are you sure you want to publish "${eventTitle}"? Once published, certain settings cannot be changed.`,
      confirmText: "Publish Event",
    });
  };

  const handleConfirmPublish = async () => {
    const { eventId, eventTitle } = confirmModal;

    setActionLoading(`publish-${eventId}`);
    try {
      await publishEvent(eventId);
      setEvents(
        events.map((event) =>
          event._id === eventId
            ? { ...event, status: "published", publishedAt: new Date() }
            : event
        )
      );
      alert(`"${eventTitle}" published successfully!`);
    } catch (error) {
      console.error("Error publishing event:", error);
      alert("Failed to publish event: " + error.message);
    } finally {
      setActionLoading(null);
      setConfirmModal({
        isOpen: false,
        type: "",
        eventId: null,
        eventTitle: "",
        message: "",
        confirmText: "",
      });
    }
  };

  // Add this function to handle the actual confirmation
  const handleModalConfirm = () => {
    if (confirmModal.type === "delete") {
      handleConfirmDelete();
    } else if (confirmModal.type === "publish") {
      handleConfirmPublish();
    }
  };

  const getModalType = () => {
    switch (confirmModal.type) {
      case "delete":
        return "danger";
      case "publish":
        return "info";
      default:
        return "danger";
    }
  };

  const getModalTitle = () => {
    switch (confirmModal.type) {
      case "delete":
        return "Delete Event";
      case "publish":
        return "Publish Event";
      default:
        return "Confirm Action";
    }
  };
  const handleCreateEvent = () => {
    setEditingEvent(null); // Ensure we're in create mode
    setShowEventForm(true);
  };

  // Fix the form submission handlers
  const handleFormSubmit = async (formData) => {
    setActionLoading("form-submit");
    try {
      const result = editingEvent
        ? await updateEvent(editingEvent._id, formData)
        : await createEvent(formData);

      if (result.success) {
        setShowEventForm(false);
        setEditingEvent(null);
        await loadEvents(); // Refresh the events list
        alert(
          editingEvent
            ? "Event updated successfully!"
            : "Event created successfully!"
        );
      }
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Failed to save event: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Fix the edit button click handler
  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };
  const getStatusBadge = (event) => {
    const statusConfig = {
      draft: { color: "bg-gray-500", text: "Draft" },
      published: { color: "bg-green-500", text: "Published" },
      ongoing: { color: "bg-blue-500", text: "Live" },
      completed: { color: "bg-purple-500", text: "Completed" },
      cancelled: { color: "bg-red-500", text: "Cancelled" },
    };

    const config = statusConfig[event.status] || statusConfig.draft;

    return (
      <span
        className={`${config.color} text-white text-xs font-bold px-2 py-1 rounded-full`}
      >
        {config.text}
      </span>
    );
  };

  const formatCurrency = (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen dark:bg-gray-900 p-6">
      {/* Header with Create Button */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({
            isOpen: false,
            type: "",
            eventId: null,
            eventTitle: "",
            message: "",
            confirmText: "",
          })
        }
        onConfirm={handleModalConfirm}
        title={getModalTitle()}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={getModalType()}
        loading={
          actionLoading === confirmModal.eventId ||
          actionLoading === `publish-${confirmModal.eventId}`
        }
      />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">All Events</h1>
          <p className="text-gray-400 mt-2">
            {events.length} events found •{" "}
            {events.filter((e) => e.status === "published").length} published
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleCreateEvent}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <FaPlus className="text-sm" />
            Create Event
          </button>
        )}
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, idx) => (
            <div
              key={idx}
              className="animate-pulse bg-gray-800 rounded-xl h-80"
            ></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Link to={`/events/${event._id}`} title="View Event">
              <div
                key={event._id}
                className="bg-gray-800 rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:scale-105 border border-gray-700 hover:border-gray-600"
              >
                {/* Event Image */}
                <div className="relative h-48">
                  <img
                    src={event.coverImage || "/api/placeholder/400/200"}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "/api/placeholder/400/200";
                    }}
                  />

                  {/* Status Badges */}
                  <div className="absolute top-2 left-2">
                    {getStatusBadge(event)}
                  </div>

                  <div className="absolute top-2 right-2 flex gap-2">
                    {event.isFull && (
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                        Full
                      </span>
                    )}
                    {event.isUpcoming && !event.isFull && (
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                        Upcoming
                      </span>
                    )}
                  </div>

                  {/* Admin Actions Overlay */}
                  {isAdmin && (
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      {/* Edit Button */}
                      {/* Replace the Link with button */}
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg"
                        title="Edit Event"
                      >
                        <FaEdit size={14} />
                      </button>

                      {/* Publish Button - Only show for draft events */}
                      {event.status === "draft" && (
                        <button
                          onClick={() =>
                            handlePublishEvent(event._id, event.title)
                          }
                          disabled={actionLoading === `publish-${event._id}`}
                          className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Publish Event"
                        >
                          {actionLoading === `publish-${event._id}` ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FaArrowUp size={14} />
                          )}
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={() =>
                          handleDeleteEvent(event._id, event.title)
                        }
                        disabled={actionLoading === event._id}
                        className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete Event"
                      >
                        {actionLoading === event._id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <FaTrash size={14} />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Event Content */}
                <div className="p-4">
                  <h3 className="text-white font-bold text-lg mb-2 line-clamp-2 h-10">
                    {event.title}
                  </h3>

                  {/* Event Details */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <FaCalendar className="text-blue-400" />
                      <span>{formatDate(event.date)}</span>
                      {event.time && (
                        <span className="text-gray-500">• {event.time}</span>
                      )}
                    </div>

                    {/* <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <FaMapMarkerAlt className="text-red-400" />
                    <span>{event.location?.city || event.location?.venue || 'Online'}</span>
                  </div> */}

                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <FaUsers className="text-green-400" />
                      <span>
                        {event.participantCount || 0} /{" "}
                        {event.participationType === "unlimited"
                          ? "∞"
                          : event.maxParticipants}{" "}
                        participants
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <FaMoneyBillWave className="text-yellow-400" />
                      <span>
                        {formatCurrency(
                          event.minimumContribution,
                          event.currency
                        )}
                      </span>
                      {event.maximumContribution && (
                        <span className="text-gray-500">
                          -{" "}
                          {formatCurrency(
                            event.maximumContribution,
                            event.currency
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {event.participationType === "fixed" && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Participation</span>
                        <span>
                          {Math.round(
                            ((event.participantCount || 0) /
                              event.maxParticipants) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              ((event.participantCount || 0) /
                                event.maxParticipants) *
                                100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {event.tags && event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-block bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {event.tags.length > 3 && (
                        <span className="inline-block bg-gray-700 text-gray-400 text-xs px-2 py-1 rounded-full">
                          +{event.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-700">
                    <div className="text-center">
                      <div className="text-green-400 font-bold text-sm">
                        {formatCurrency(
                          event.totalCollected || 0,
                          event.currency
                        )}
                      </div>
                      <div className="text-gray-400 text-xs">Collected</div>
                    </div>

                    <div className="text-center">
                      <div className="text-blue-400 font-bold text-sm">
                        {event.paymentProgress?.toFixed(0) || 0}%
                      </div>
                      <div className="text-gray-400 text-xs">Progress</div>
                    </div>

                    <div className="text-center">
                      <div
                        className={`font-bold text-sm ${
                          event.daysRemaining > 7
                            ? "text-green-400"
                            : event.daysRemaining > 0
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {event.daysRemaining > 0
                          ? `${event.daysRemaining}d`
                          : "Passed"}
                      </div>
                      <div className="text-gray-400 text-xs">Left</div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && events.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No Events Found
          </h3>
          <p className="text-gray-400 mb-6">
            There are no events available at the moment.
          </p>
          {isAdmin && (
            <button
              onClick={handleCreateEvent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Create Your First Event
            </button>
          )}
        </div>
      )}

      {/* Create Event Modal Placeholder */}
      {/* Fix this condition - change showCreateForm to showEventForm */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <EventForm
              event={editingEvent}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setShowEventForm(false);
                setEditingEvent(null);
              }}
              loading={actionLoading === "form-submit"}
              // Remove user={user} if you don't have user data
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Event;
