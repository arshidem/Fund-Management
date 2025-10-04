// src/components/EventForm.jsx
import React, { useState } from "react";

const EventForm = ({ event, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    // === BASIC EVENT INFORMATION ===
    title: event?.title || "",
    description: event?.description || "",
    
    // === DATE & TIME ===
    date: event?.date ? new Date(event.date).toISOString().split('T')[0] : "",
    time: event?.time || "",
    endDate: event?.endDate ? new Date(event.endDate).toISOString().split('T')[0] : "",
    endTime: event?.endTime || "",
    timezone: event?.timezone || "Asia/Kolkata",
    
    // === FINANCIALS ===
    minimumContribution: event?.minimumContribution || "",
    maximumContribution: event?.maximumContribution || "",
    estimatedBudget: event?.estimatedBudget || "",
    currency: event?.currency || "INR",
    
    // === PARTICIPATION SETTINGS ===
    participationType: event?.participationType || "fixed",
    maxParticipants: event?.maxParticipants || "",
    
    // === EVENT SETTINGS ===
    category: event?.category || "other",
    eventType: event?.eventType || "in-person",
    visibility: event?.visibility || "public",
    
    // === LOCATION ===
    location: {
      venue: event?.location?.venue || "",
      address: event?.location?.address || "",
      city: event?.location?.city || "",
      state: event?.location?.state || "",
      pincode: event?.location?.pincode || "",
      onlineLink: event?.location?.onlineLink || "",
      coordinates: {
        lat: event?.location?.coordinates?.lat || "",
        lng: event?.location?.coordinates?.lng || ""
      }
    },
    
    // === PAYMENT SETTINGS ===
    paymentDeadline: event?.paymentDeadline ? new Date(event.paymentDeadline).toISOString().split('T')[0] : "",
    allowLatePayments: event?.allowLatePayments || false,
    allowPartialPayments: event?.allowPartialPayments || false,
    
    // === ADDITIONAL FIELDS ===
    tags: event?.tags || [],
    coverImage: event?.coverImage || "",
    gallery: event?.gallery || [],
  });

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle nested location change
  const handleLocationChange = (e) => {
    const { name, value } = e.target;
    const field = name.startsWith('location.') ? name.split('.')[1] : name;
    
    setFormData((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: value,
      },
    }));
  };

  // Handle coordinates change
  const handleCoordinatesChange = (e) => {
    const { name, value } = e.target;
    const field = name.split('.')[1];
    
    setFormData((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        coordinates: {
          ...prev.location.coordinates,
          [field]: parseFloat(value) || "",
        },
      },
    }));
  };

  // Handle array fields like tags
  const handleArrayChange = (e, field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value.split(",").map((item) => item.trim()),
    }));
  };

  // Add new gallery image
  const handleAddGalleryImage = () => {
    setFormData((prev) => ({
      ...prev,
      gallery: [...prev.gallery, ""],
    }));
  };

  // Update gallery image
  const handleGalleryChange = (index, value) => {
    const updatedGallery = [...formData.gallery];
    updatedGallery[index] = value;
    setFormData((prev) => ({ ...prev, gallery: updatedGallery }));
  };

  // Remove gallery image
  const handleRemoveGalleryImage = (index) => {
    const updatedGallery = [...formData.gallery];
    updatedGallery.splice(index, 1);
    setFormData((prev) => ({ ...prev, gallery: updatedGallery }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Clean up data before submitting
    const submitData = {
      ...formData,
      minimumContribution: parseFloat(formData.minimumContribution),
      maximumContribution: formData.maximumContribution ? parseFloat(formData.maximumContribution) : undefined,
      estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
      maxParticipants: formData.participationType === 'fixed' ? parseInt(formData.maxParticipants) : undefined,
      tags: formData.tags.filter(tag => tag.trim() !== ''),
      gallery: formData.gallery.filter(img => img.trim() !== ''),
      location: {
        ...formData.location,
        coordinates: {
          lat: formData.location.coordinates.lat ? parseFloat(formData.location.coordinates.lat) : undefined,
          lng: formData.location.coordinates.lng ? parseFloat(formData.location.coordinates.lng) : undefined,
        }
      }
    };

    onSubmit(submitData);
  };

  const categories = [
    'trip', 'celebration', 'festival', 'sports', 
    'cultural', 'meeting', 'charity', 'educational', 
    'business', 'social', 'religious', 'other'
  ];

  const currencies = ['INR', 'USD', 'EUR', 'GBP'];
  const eventTypes = ['in-person', 'virtual', 'hybrid'];
  const participationTypes = ['fixed', 'unlimited'];
  const visibilityOptions = ['public', 'private'];

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-white shadow rounded-md space-y-6 max-h-[90vh] overflow-y-auto"
    >
      <h2 className="text-2xl font-bold mb-6 border-b pb-2">
        {event ? "Edit Event" : "Create New Event"}
      </h2>

      {/* === BASIC INFORMATION === */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-gray-700">Basic Information</h3>
        
        {/* Title */}
        <div>
          <label className="block font-medium mb-2">Event Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            maxLength={100}
            placeholder="Enter event title"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-medium mb-2">Description *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="4"
            required
            maxLength={2000}
            placeholder="Describe your event..."
          />
        </div>

        {/* Category */}
        <div>
          <label className="block font-medium mb-2">Category *</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* === DATE & TIME === */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-gray-700">Date & Time</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <label className="block font-medium mb-2">Start Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block font-medium mb-2">Start Time *</label>
            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block font-medium mb-2">End Date</label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block font-medium mb-2">End Time</label>
            <input
              type="time"
              name="endTime"
              value={formData.endTime}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Payment Deadline */}
        <div>
          <label className="block font-medium mb-2">Payment Deadline</label>
          <input
            type="date"
            name="paymentDeadline"
            value={formData.paymentDeadline}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* === FINANCIALS === */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-gray-700">Financials</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Minimum Contribution */}
          <div>
            <label className="block font-medium mb-2">Minimum Contribution *</label>
            <input
              type="number"
              name="minimumContribution"
              value={formData.minimumContribution}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* Maximum Contribution */}
          <div>
            <label className="block font-medium mb-2">Maximum Contribution</label>
            <input
              type="number"
              name="maximumContribution"
              value={formData.maximumContribution}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.01"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block font-medium mb-2">Currency</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {currencies.map(currency => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Estimated Budget */}
        <div>
          <label className="block font-medium mb-2">Estimated Budget</label>
          <input
            type="number"
            name="estimatedBudget"
            value={formData.estimatedBudget}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
            step="0.01"
            placeholder="Optional estimated budget"
          />
        </div>

        {/* Payment Settings */}
        <div className="flex gap-6">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="allowLatePayments"
              checked={formData.allowLatePayments}
              onChange={handleChange}
              className="rounded"
            />
            <span>Allow Late Payments</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="allowPartialPayments"
              checked={formData.allowPartialPayments}
              onChange={handleChange}
              className="rounded"
            />
            <span>Allow Partial Payments</span>
          </label>
        </div>
      </div>

      {/* === PARTICIPATION SETTINGS === */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-gray-700">Participation Settings</h3>
        
        {/* Participation Type */}
        <div>
          <label className="block font-medium mb-2">Participation Type *</label>
          <select
            name="participationType"
            value={formData.participationType}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {participationTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Max Participants (only for fixed participation) */}
        {formData.participationType === 'fixed' && (
          <div>
            <label className="block font-medium mb-2">Maximum Participants *</label>
            <input
              type="number"
              name="maxParticipants"
              value={formData.maxParticipants}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              required
            />
          </div>
        )}
      </div>

      {/* === LOCATION & VENUE === */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-gray-700">Location & Venue</h3>
        
        {/* Event Type */}
        <div>
          <label className="block font-medium mb-2">Event Type</label>
          <select
            name="eventType"
            value={formData.eventType}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {eventTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Venue */}
        <div>
          <label className="block font-medium mb-2">Venue Name</label>
          <input
            type="text"
            name="location.venue"
            value={formData.location.venue}
            onChange={handleLocationChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={200}
            placeholder="Enter venue name"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block font-medium mb-2">Address</label>
          <textarea
            name="location.address"
            value={formData.location.address}
            onChange={handleLocationChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="2"
            maxLength={500}
            placeholder="Full address"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* City */}
          <div>
            <label className="block font-medium mb-2">City</label>
            <input
              type="text"
              name="location.city"
              value={formData.location.city}
              onChange={handleLocationChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="City"
            />
          </div>

          {/* State */}
          <div>
            <label className="block font-medium mb-2">State</label>
            <input
              type="text"
              name="location.state"
              value={formData.location.state}
              onChange={handleLocationChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="State"
            />
          </div>

          {/* Pincode */}
          <div>
            <label className="block font-medium mb-2">Pincode</label>
            <input
              type="text"
              name="location.pincode"
              value={formData.location.pincode}
              onChange={handleLocationChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Pincode"
            />
          </div>
        </div>

        {/* Online Link (for virtual/hybrid events) */}
        {(formData.eventType === 'virtual' || formData.eventType === 'hybrid') && (
          <div>
            <label className="block font-medium mb-2">Online Meeting Link</label>
            <input
              type="url"
              name="location.onlineLink"
              value={formData.location.onlineLink}
              onChange={handleLocationChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://meet.google.com/..."
            />
          </div>
        )}

        {/* Coordinates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-2">Latitude</label>
            <input
              type="number"
              name="coordinates.lat"
              value={formData.location.coordinates.lat}
              onChange={handleCoordinatesChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="any"
              placeholder="12.9716"
            />
          </div>
          <div>
            <label className="block font-medium mb-2">Longitude</label>
            <input
              type="number"
              name="coordinates.lng"
              value={formData.location.coordinates.lng}
              onChange={handleCoordinatesChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="any"
              placeholder="77.5946"
            />
          </div>
        </div>
      </div>

      {/* === ADDITIONAL SETTINGS === */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-gray-700">Additional Settings</h3>
        
        {/* Visibility */}
        <div>
          <label className="block font-medium mb-2">Visibility</label>
          <select
            name="visibility"
            value={formData.visibility}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {visibilityOptions.map(option => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="block font-medium mb-2">Tags</label>
          <input
            type="text"
            value={formData.tags.join(", ")}
            onChange={(e) => handleArrayChange(e, "tags")}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="tag1, tag2, tag3"
          />
          <p className="text-sm text-gray-500 mt-1">Separate tags with commas</p>
        </div>

        {/* Cover Image */}
        <div>
          <label className="block font-medium mb-2">Cover Image URL</label>
          <input
            type="url"
            name="coverImage"
            value={formData.coverImage}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        {/* Gallery Images */}
        <div>
          <label className="block font-medium mb-2">Gallery Images</label>
          {formData.gallery.map((img, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="url"
                value={img}
                onChange={(e) => handleGalleryChange(index, e.target.value)}
                className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/gallery-image.jpg"
              />
              <button
                type="button"
                onClick={() => handleRemoveGalleryImage(index)}
                className="bg-red-500 text-white px-3 rounded hover:bg-red-600 transition"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddGalleryImage}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
          >
            + Add Gallery Image
          </button>
        </div>
      </div>

      {/* Form Buttons */}
      <div className="flex gap-4 pt-6 border-t">
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {event ? "Update Event" : "Create Event"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default EventForm;