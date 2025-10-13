import React, { useEffect, useState } from "react";
import { useEventService } from "../../services/eventService";
import { Link } from "react-router-dom";

const Event = () => {
  const { fetchEvents } = useEventService();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    loadEvents();
  }, []);

  return (
    <div className="min-h-screen dark:bg-gray-900 p-6">
      <h1 className="text-3xl font-bold text-white mb-6">All Events</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="animate-pulse bg-gray-800 rounded-xl h-64"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Link
              to={`/events/${event._id}`}
              key={event._id}
              className="bg-gray-800 dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden transform transition-transform duration-300 hover:scale-105 cursor-pointer"
            >
              <div className="relative h-48">
                <img
                  src={event.coverImage || "/placeholder.jpg"}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                {event.isFull && (
                  <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                    Full
                  </span>
                )}
                {event.isUpcoming && !event.isFull && (
                  <span className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                    Upcoming
                  </span>
                )}
              </div>

              <div className="p-4">
                <h3 className="text-white font-bold text-lg">{event.title}</h3>
                <p className="text-gray-300 text-sm mt-1">
                  {new Date(event.date).toLocaleDateString()} | {event.location?.city || "Online"}
                </p>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-green-400 font-semibold">
                    {event.availableSpots} spots left
                  </span>
                  <span className="text-yellow-400 font-semibold">₹{event.minimumContribution}</span>
                </div>
                <div className="mt-3">
                  {event.tags?.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-block bg-gray-700 text-gray-200 text-xs px-2 py-1 mr-2 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Event;
