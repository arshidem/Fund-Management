// src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { useEventService } from "../../services/eventService";
import EventForm from "../components/EventForm";
import EventCard from "../components/EventCard";
import EventCarousel from "../components/EventCarousel";

const Dashboard = () => {
  const { user, token, logout } = useAppContext();
  const navigate = useNavigate();
  const eventService = useEventService();
  
  const [events, setEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    myEvents: 0,
    totalContributed: 0
  });

  // Redirect to landing if no token
  useEffect(() => {
    if (!token) {
      navigate("/landing");
    } else {
      loadDashboardData();
    }
  }, [token, navigate]);

const loadDashboardData = async () => {
  try {
    setLoading(true);
    
    // For admin: show all active events (including drafts)
    // For regular users: show only published events
    const params = user?.role === 'admin' 
      ? { isActive: true, limit: 6 }  // Show all active events including drafts
      : { status: 'published', limit: 6 }; // Show only published events for regular users

    const eventsData = await eventService.fetchEvents(params);

    setEvents(eventsData.events || []);
    
    // Calculate stats
    const upcomingEvents = eventsData.events?.filter(event => 
      new Date(event.date) > new Date()
    ) || [];

    // Calculate events created by current user (for admin)
    const myEventsCount = user?.role === 'admin' 
      ? eventsData.events?.filter(event => event.createdBy?._id === user._id).length || 0
      : 0;

    setStats({
      totalEvents: eventsData.pagination?.totalEvents || 0,
      upcomingEvents: upcomingEvents.length,
      myEvents: myEventsCount,
      totalContributed: 0
    });
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  } finally {
    setLoading(false);
  }
};

  const handleCreateEvent = async (eventData) => {
    try {
      const result = await eventService.createEvent(eventData);
      setEvents(prev => [result.event, ...prev]);
      setShowEventForm(false);
      await loadDashboardData(); // Refresh data
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event: " + error.message);
    }
  };

  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      const result = await eventService.updateEvent(eventId, eventData);
      setEvents(prev => prev.map(event => 
        event._id === eventId ? result.event : event
      ));
      setEditingEvent(null);
      await loadDashboardData(); // Refresh data
    } catch (error) {
      console.error("Error updating event:", error);
      alert("Failed to update event: " + error.message);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      try {
        await eventService.deleteEvent(eventId);
        setEvents(prev => prev.filter(event => event._id !== eventId));
        await loadDashboardData(); // Refresh data
      } catch (error) {
        console.error("Error deleting event:", error);
        alert("Failed to delete event: " + error.message);
      }
    }
  };

  const handlePublishEvent = async (eventId) => {
    try {
      await eventService.publishEvent(eventId);
      await loadDashboardData(); // Refresh data
      alert("Event published successfully!");
    } catch (error) {
      console.error("Error publishing event:", error);
      alert("Failed to publish event: " + error.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/landing");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {user?.name || user?.email}!
            {user?.role === 'admin' && ' (Admin)'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>

      {/* Admin Controls */}
      {user?.role === 'admin' && (
        <div className="mb-8">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setShowEventForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <span>+</span> Create New Event
            </button>
            <button
              onClick={() => navigate("/events")}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Manage All Events
            </button>
          </div>
        </div>
      )}
{/* Recent Events Section */}
<div className="bg-white rounded-lg shadow-sm border p-6">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-xl font-bold text-gray-900">Recent Events</h2>
    <button
      onClick={() => navigate("/events")}
      className="text-blue-600 hover:text-blue-700 font-medium"
    >
      View All →
    </button>
  </div>

  {events.length === 0 ? (
    <div className="text-center py-8 text-gray-500">
      No events found. {user?.role === 'admin' && 'Create your first event!'}
    </div>
  ) : (
<EventCarousel
  events={events}
  user={user}
  onEdit={(event) => setEditingEvent(event)}
  onDelete={handleDeleteEvent}
  onPublish={handlePublishEvent}
/>

  )}
</div>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700">Total Events</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalEvents}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700">Upcoming Events</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.upcomingEvents}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700">My Events</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{stats.myEvents}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700">Total Contributed</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">₹{stats.totalContributed}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => navigate("/events")}
          className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition text-center"
        >
          <div className="text-2xl mb-2">📅</div>
          <span className="font-medium">Browse Events</span>
        </button>
        <button
          onClick={() => navigate("/contributions")}
          className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition text-center"
        >
          <div className="text-2xl mb-2">💰</div>
          <span className="font-medium">My Payments</span>
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition text-center"
        >
          <div className="text-2xl mb-2">👤</div>
          <span className="font-medium">Profile</span>
        </button>
        <button
          onClick={() => navigate("/help")}
          className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition text-center"
        >
          <div className="text-2xl mb-2">❓</div>
          <span className="font-medium">Help</span>
        </button>
      </div>

      {/* Recent Events Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent Events</h2>
          <button
            onClick={() => navigate("/events")}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View All →
          </button>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No events found. {user?.role === 'admin' && 'Create your first event!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => (
              <EventCard
                key={event._id}
                event={event}
                user={user}
                onEdit={user?.role === 'admin' ? () => setEditingEvent(event) : null}
                onDelete={user?.role === 'admin' ? () => handleDeleteEvent(event._id) : null}
                onPublish={user?.role === 'admin' && event.status === 'draft' ? 
                  () => handlePublishEvent(event._id) : null
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Event Form Modal */}
      {(showEventForm || editingEvent) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <EventForm
              event={editingEvent}
              onSubmit={editingEvent ? 
                (data) => handleUpdateEvent(editingEvent._id, data) : 
                handleCreateEvent
              }
              onCancel={() => {
                setShowEventForm(false);
                setEditingEvent(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;