// src/components/EventCard.jsx
import React from 'react';

const EventCard = ({ event, user, onEdit, onDelete, onPublish }) => {
  const getStatusBadge = (status) => {
    const statusColors = {
      draft: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      ongoing: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition bg-white">
      {/* Status Badge */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg text-gray-900">{event.title}</h3>
        {getStatusBadge(event.status)}
      </div>
      
      <p className="text-gray-600 text-sm mb-2">
        📅 {new Date(event.date).toLocaleDateString()} at {event.time}
      </p>
      
      {event.location?.venue && (
        <p className="text-sm text-gray-600 mb-2">📍 {event.location.venue}</p>
      )}
      
      <p className="text-sm mb-2">
        💰 Min. Contribution: ₹{event.minimumContribution}
      </p>
      
      <div className="flex justify-between text-sm mb-3">
        <span>👥 {event.participantCount || 0} participants</span>
        {event.participationType === 'fixed' && (
          <span>🎯 {event.availableSpots} spots left</span>
        )}
      </div>
      
      {/* Admin Actions */}
      {user?.role === 'admin' && (
        <div className="flex gap-2 mt-4 pt-3 border-t">
          {event.status === 'draft' && (
            <button
              onClick={onPublish}
              className="flex-1 bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 transition"
            >
              Publish
            </button>
          )}
          <button
            onClick={onEdit}
            className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 transition"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600 transition"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default EventCard;