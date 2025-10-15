import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useEventService } from "../../../services/eventService";
import { useAppContext } from "../../../context/AppContext";

// Import tab components
import OverviewTab from "./tabs/OverviewTab";
import DetailsTab from "./tabs/DetailsTab";
import FinancialsTab from "./tabs/FinancialsTab";
import ParticipantsTab from "./tabs/ParticipantsTab";
import ContributionsTab from "./tabs/ContributionsTab";
import ExpensesTab from "./tabs/ExpensesTab";

import { FaGlobe, FaTag, FaRupeeSign, FaUsers, FaMoneyBillWave, FaReceipt } from "react-icons/fa";

const EventDetails = () => {
  const { eventId } = useParams();
  const { fetchEventById } = useEventService();
  const { user } = useAppContext();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [imageError, setImageError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const data = await fetchEventById(eventId);
        setEvent(data.event);
      } catch (error) {
        console.error("Error loading event:", error.message);
      } finally {
        setLoading(false);
      }
    };
    loadEvent();
  }, [eventId, refreshTrigger]);

  const refreshEventData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleParticipationChange = (isParticipating, participantData) => {
    // Update event data optimistically when participation changes
    setEvent(prevEvent => {
      if (!prevEvent) return prevEvent;
      
      const newParticipantCount = isParticipating 
        ? (prevEvent.participantCount || 0) + 1
        : Math.max(0, (prevEvent.participantCount || 1) - 1);

      return {
        ...prevEvent,
        participantCount: newParticipantCount,
        // Update other relevant fields if needed
        updatedAt: new Date().toISOString()
      };
    });

    // Optionally refresh the entire event data
    setTimeout(() => {
      refreshEventData();
    }, 500);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "₹0";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: event?.currency || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (time) => {
    if (!time) return "Not set";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (eventDate) => {
    if (!eventDate) return 0;
    const today = new Date();
    const eventDay = new Date(eventDate);
    const diffTime = eventDay - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-green-500';
      case 'draft': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      case 'ongoing': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen dark:bg-gray-900 p-6 animate-pulse">
        <div className="h-64 bg-gray-700 rounded-xl mb-6"></div>
        <div className="space-y-4">
          <div className="h-8 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
          <p className="text-gray-400">The event you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const isEventCreator = user?._id === event.createdBy?._id;
  const daysRemaining = getDaysRemaining(event.date);

  const tabs = [
    { id: "overview", label: "Overview", icon: FaGlobe },
    { id: "details", label: "Details", icon: FaTag },
    { id: "financials", label: "Financials", icon: FaRupeeSign },
    { id: "participants", label: "Participants", icon: FaUsers },
    { id: "contributions", label: "Contributions", icon: FaMoneyBillWave },
    { id: "expenses", label: "Expenses", icon: FaReceipt },
  ].filter(tab => {
    // Hide financial tabs if user is not event creator and event has restricted visibility
    if (['financials', 'expenses'].includes(tab.id) && !isEventCreator && event.visibility === 'private') {
      return false;
    }
    return true;
  });

  const renderTabContent = () => {
    const commonProps = {
      event,
      user,
      isEventCreator,
      formatCurrency,
      formatDate,
      formatTime,
      onParticipationChange: handleParticipationChange,
      onEventUpdate: refreshEventData, // Add this for other tabs to refresh data
    };

    switch (activeTab) {
      case "overview":
        return <OverviewTab {...commonProps} />;
      case "details":
        return <DetailsTab {...commonProps} />;
      case "financials":
        return <FinancialsTab {...commonProps} />;
      case "participants":
        return <ParticipantsTab {...commonProps} />;
      case "contributions":
        return <ContributionsTab {...commonProps} />;
      case "expenses":
        return <ExpensesTab {...commonProps} />;
      default:
        return <OverviewTab {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen dark:bg-gray-900 pb-20">
      {/* Hero Section */}
      <div className="relative h-80 rounded-b-3xl overflow-hidden shadow-2xl">
        {event.coverImage && !imageError ? (
          <img
            src={event.coverImage}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
            <FaReceipt className="text-white text-6xl opacity-50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6">
          <div className="flex justify-between items-end">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(event.status)} text-white`}>
                  {event.status?.toUpperCase()}
                </span>
                <span className="px-3 py-1 bg-purple-500 rounded-full text-xs font-semibold text-white">
                  {event.category?.toUpperCase() || 'GENERAL'}
                </span>
                <span className="px-3 py-1 bg-orange-500 rounded-full text-xs font-semibold text-white">
                  {event.eventType?.toUpperCase() || 'IN-PERSON'}
                </span>
                {event.visibility === 'private' && (
                  <span className="px-3 py-1 bg-red-500 rounded-full text-xs font-semibold text-white">
                    PRIVATE
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">{event.title}</h1>
              <p className="text-gray-300 text-lg mb-4 line-clamp-2">{event.description}</p>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                <div className="flex items-center gap-1">
                  <FaGlobe className="text-blue-400" />
                  <span>{formatDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FaTag className="text-green-400" />
                  <span>{formatTime(event.time)}</span>
                  {event.endTime && (
                    <span> - {formatTime(event.endTime)}</span>
                  )}
                </div>
                {event.location?.city && (
                  <div className="flex items-center gap-1">
                    <FaReceipt className="text-red-400" />
                    <span>{event.location.city}</span>
                    {event.location.state && <span>, {event.location.state}</span>}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <FaUsers className="text-yellow-400" />
                  <span>
                    {event.participantCount || 0} / {event.participationType === 'unlimited' ? '∞' : event.maxParticipants || 0} participants
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 -mt-8 relative z-10">
        <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FaRupeeSign className="text-blue-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Collected</p>
              <p className="text-white font-bold text-lg">{formatCurrency(event.totalCollected || 0)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FaMoneyBillWave className="text-green-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Budget Progress</p>
              <p className="text-white font-bold text-lg">{event.paymentProgress?.toFixed(1) || 0}%</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <FaMoneyBillWave className="text-purple-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Min Contribution</p>
              <p className="text-white font-bold text-lg">{formatCurrency(event.minimumContribution || 0)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <FaTag className="text-orange-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Days Left</p>
              <p className="text-white font-bold text-lg">
                {daysRemaining > 0 ? daysRemaining : daysRemaining === 0 ? 'Today' : 'Event Passed'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6">
        <div className="flex space-x-1 bg-gray-800 rounded-xl p-1 border border-gray-700 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-2 py-3 px-4 font-semibold rounded-lg transition-all duration-300 flex-shrink-0 ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="text-sm" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default EventDetails;