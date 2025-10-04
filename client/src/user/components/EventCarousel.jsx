// src/components/EventCarousel.jsx
import React from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useNavigate } from "react-router-dom";
const EventCarousel = ({ events = [], user, onView, onEdit, onDelete, onPublish }) => {
  if (!events.length) return null;
const navigate = useNavigate();
  const settings = {
    dots: true,
    infinite: events.length > 3,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 2 } },
      { breakpoint: 640, settings: { slidesToShow: 1 } },
    ],
  };

  return (
    <div className="my-6">
      <Slider {...settings}>
        {events.map((event) => (
          <div key={event._id} className="px-2">
            <div className="relative rounded-xl overflow-hidden shadow-lg h-72 flex flex-col">
              {/* Event Background */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: event.coverImage
                    ? `url(${event.coverImage})`
                    : "url('https://via.placeholder.com/400x200?text=No+Image')",
                }}
              ></div>

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-50"></div>

              {/* Content */}
              <div className="relative z-10 p-4 flex flex-col justify-between h-full text-white">
                <div>
                  <h3 className="text-xl font-bold truncate">{event.title}</h3>
                  <p className="text-sm mt-1">
                    {new Date(event.date).toLocaleDateString()} | {event.time}
                  </p>
                </div>

                <div className="flex justify-between mt-3 text-sm">
                  <div className="flex items-center gap-1">
                    <span>👥</span>
                    <span>{event.participants?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>💰</span>
                    <span>₹{event.totalContributions || 0}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate(`/events/${event._id}`)}
                    className="flex-1 py-1 bg-white text-black rounded hover:bg-gray-200 transition text-sm"
                  >
                    View
                  </button>

                  {user?.role === "admin" && (
                    <>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(event)}
                          className="flex-1 py-1 bg-white text-black rounded hover:bg-gray-200 transition text-sm"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(event._id)}
                          className="flex-1 py-1 bg-black text-white border border-white rounded hover:bg-gray-800 transition text-sm"
                        >
                          Delete
                        </button>
                      )}
                      {onPublish && event.status === "draft" && (
                        <button
                          onClick={() => onPublish(event._id)}
                          className="flex-1 py-1 bg-white text-black border border-white rounded hover:bg-gray-200 transition text-sm"
                        >
                          Publish
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default EventCarousel;
