// src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { useEventService } from "../../services/eventService";
import EventCard from "../components/EventCard";
import EventCarousel from "../components/EventCarousel";
import NotificationBell from "../components/NotificationBell";
import { useNotification } from "../../context/NotificationContext";
import { FiPlus, FiLogOut } from "react-icons/fi";
import { MdEvent } from "react-icons/md";
import { BsPersonCircle } from "react-icons/bs";
import { TbHelp } from "react-icons/tb";
import { RiMoneyRupeeCircleLine } from "react-icons/ri";
const Dashboard = () => {
  const { user, token, logout } = useAppContext(); // ✅ Added theme
  const navigate = useNavigate();
  const eventService = useEventService();
  const { unreadCount } = useNotification();

  const [events, setEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    myEvents: 0,
    totalContributed: 0,
  });

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
      const params =
        user?.role === "admin"
          ? { isActive: true, limit: 6 }
          : { status: "published", limit: 6 };

      const eventsData = await eventService.fetchEvents(params);
      setEvents(eventsData.events || []);

      const upcomingEvents =
        eventsData.events?.filter(
          (event) => new Date(event.date) > new Date()
        ) || [];

      const myEventsCount =
        user?.role === "admin"
          ? eventsData.events?.filter(
              (event) => event.createdBy?._id === user._id
            ).length || 0
          : 0;

      setStats({
        totalEvents: eventsData.pagination?.totalEvents || 0,
        upcomingEvents: upcomingEvents.length,
        myEvents: myEventsCount,
        totalContributed: 0,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/landing");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-lg text-gray-600 dark:text-gray-400 animate-pulse">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back,{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {user?.name || user?.email}
            </span>
            {user?.role === "admin" && " (Admin)"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <NotificationBell />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>



      {/* Admin Controls */}
      {user?.role === "admin" && (
        <div className="flex flex-wrap gap-4 mb-10">
          <button
            onClick={() => setShowEventForm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <FiPlus /> Create New Event
          </button>
          <button
            onClick={() => navigate("/events")}
            className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
          >
            Manage Events
          </button>
        </div>
      )}

      {/* Recent Events */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Events
          </h2>
          <button
            onClick={() => navigate("/events")}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
          >
            View All →
          </button>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            No events found.{" "}
            {user?.role === "admin" && "Create your first event!"}
          </div>
        ) : (
          <EventCarousel
            events={events}
            user={user}
            onEdit={(event) => setEditingEvent(event)}
          />
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { icon: MdEvent, label: "Browse Events", color: "blue", onClick: () => navigate("/events") },
          { icon: RiMoneyRupeeCircleLine, label: "My Payments", color: "green", onClick: () => navigate("/contributions") },
          { icon: BsPersonCircle, label: "Profile", color: "purple", onClick: () => navigate("/profile") },
          { icon: TbHelp, label: "Help", color: "orange", onClick: () => navigate("/help") },
        ].map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition flex flex-col items-center justify-center"
          >
            <action.icon 
              size={26} 
              className={`mb-2 text-${action.color}-600 dark:text-${action.color}-400`} 
            />
            <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
              {action.label}
            </span>
          </button>
        ))}
      </div>
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Total Events", value: stats.totalEvents, color: "blue" },
          { label: "Upcoming Events", value: stats.upcomingEvents, color: "green" },
          { label: "My Events", value: stats.myEvents, color: "purple" },
          { label: "Total Contributed", value: `₹${stats.totalContributed}`, color: "orange" },
        ].map((stat, index) => (
          <div 
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition"
          >
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {stat.label}
            </h3>
            <p className={`text-3xl font-bold text-${stat.color}-600 mt-1`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      {/* Event Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Events
          </h2>
          <button
            onClick={() => navigate("/events")}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
          >
            View All →
          </button>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            No events available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard
                key={event._id}
                event={event}
                user={user}
                onEdit={
                  user?.role === "admin" ? () => setEditingEvent(event) : null
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Event Form Modal */}
      {(showEventForm || editingEvent) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
            <EventForm
              event={editingEvent}
              onSubmit={
                editingEvent
                  ? (data) => handleUpdateEvent(editingEvent._id, data)
                  : handleCreateEvent
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