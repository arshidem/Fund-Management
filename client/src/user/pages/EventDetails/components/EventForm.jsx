import React, { useState, useEffect } from 'react';
import { 
  FaCalendar, 
  FaClock, 
  FaMapMarkerAlt, 
  FaUsers, 
  FaMoneyBillWave, 
  FaImage,
  FaSave,
  FaTimes,
  FaGlobe,
  FaEye,
  FaEyeSlash,
  FaTag,
  FaLink,
  FaUpload
} from 'react-icons/fa';

const EventForm = ({ 
  event = null, 
  onSubmit, 
  onCancel, 
  loading = false,
  user 
}) => {
  const [formData, setFormData] = useState({
    // Basic Information
    title: '',
    description: '',
    category: 'other',
    
    // Date & Time
    date: '',
    time: '',
    endDate: '',
    endTime: '',
    timezone: 'Asia/Kolkata',
    
    // Location
    eventType: 'in-person',
    location: {
      venue: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      onlineLink: '',
      coordinates: { lat: '', lng: '' }
    },
    
    // Financials
    minimumContribution: 0,
    maximumContribution: '',
    estimatedBudget: '',
    currency: 'INR',
    
    // Participation
    participationType: 'fixed',
    maxParticipants: '',
    
    // Settings
    visibility: 'public',
    paymentDeadline: '',
    allowLatePayments: false,
    allowPartialPayments: false,
    
    // Additional
    tags: [],
    coverImage: ''
  });

  const [errors, setErrors] = useState({});
  const [tagInput, setTagInput] = useState('');

  // Initialize form with event data if editing
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        category: event.category || 'other',
        date: event.date ? new Date(event.date).toISOString().split('T')[0] : '',
        time: event.time || '',
        endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '',
        endTime: event.endTime || '',
        timezone: event.timezone || 'Asia/Kolkata',
        eventType: event.eventType || 'in-person',
        location: {
          venue: event.location?.venue || '',
          address: event.location?.address || '',
          city: event.location?.city || '',
          state: event.location?.state || '',
          pincode: event.location?.pincode || '',
          onlineLink: event.location?.onlineLink || '',
          coordinates: event.location?.coordinates || { lat: '', lng: '' }
        },
        minimumContribution: event.minimumContribution || 0,
        maximumContribution: event.maximumContribution || '',
        estimatedBudget: event.estimatedBudget || '',
        currency: event.currency || 'INR',
        participationType: event.participationType || 'fixed',
        maxParticipants: event.maxParticipants || '',
        visibility: event.visibility || 'public',
        paymentDeadline: event.paymentDeadline ? new Date(event.paymentDeadline).toISOString().split('T')[0] : '',
        allowLatePayments: event.allowLatePayments || false,
        allowPartialPayments: event.allowPartialPayments || false,
        tags: event.tags || [],
        coverImage: event.coverImage || ''
      });
    }
  }, [event]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle nested objects
    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value
        }
      }));
    } else if (name.startsWith('coordinates.')) {
      const coordField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          coordinates: {
            ...prev.location.coordinates,
            [coordField]: value
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length === 0) {
      // Prepare data for API
      const submitData = {
        ...formData,
        minimumContribution: parseFloat(formData.minimumContribution),
        maximumContribution: formData.maximumContribution ? parseFloat(formData.maximumContribution) : undefined,
        estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
        maxParticipants: formData.participationType === 'fixed' ? parseInt(formData.maxParticipants) : undefined,
        paymentDeadline: formData.paymentDeadline || undefined
      };
      
      onSubmit(submitData);
    } else {
      setErrors(validationErrors);
    }
  };

  const validateForm = () => {
    const errors = {};

    // Required fields
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.time) errors.time = 'Time is required';
    if (!formData.minimumContribution || formData.minimumContribution < 0) {
      errors.minimumContribution = 'Valid minimum contribution is required';
    }

    // Conditional validation
    if (formData.participationType === 'fixed' && !formData.maxParticipants) {
      errors.maxParticipants = 'Maximum participants is required for fixed participation';
    }

    if (formData.maximumContribution && parseFloat(formData.maximumContribution) < parseFloat(formData.minimumContribution)) {
      errors.maximumContribution = 'Maximum contribution must be greater than or equal to minimum contribution';
    }

    if (formData.endDate && new Date(formData.endDate) < new Date(formData.date)) {
      errors.endDate = 'End date cannot be before start date';
    }

    if (formData.paymentDeadline && new Date(formData.paymentDeadline) > new Date(formData.date)) {
      errors.paymentDeadline = 'Payment deadline cannot be after event date';
    }

    // Virtual event validation
    if (formData.eventType === 'virtual' && !formData.location.onlineLink) {
      errors['location.onlineLink'] = 'Online link is required for virtual events';
    }

    // In-person event validation
    if (formData.eventType === 'in-person' && !formData.location.venue) {
      errors['location.venue'] = 'Venue is required for in-person events';
    }

    return errors;
  };

  const categories = [
    'trip', 'celebration', 'festival', 'sports', 'cultural', 
    'meeting', 'charity', 'educational', 'business', 'social', 
    'religious', 'other'
  ];

  const currencies = ['INR', 'USD', 'EUR', 'GBP'];
  const eventTypes = ['in-person', 'virtual', 'hybrid'];

  return (
    <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {event ? 'Edit Event' : 'Create New Event'}
            </h2>
            <p className="text-blue-100">
              {event ? 'Update your event details' : 'Fill in the details to create a new event'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:text-blue-200 transition-colors p-2 rounded-lg hover:bg-blue-700"
          >
            <FaTimes size={20} />
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
        {/* Basic Information */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b pb-3">
            Basic Information
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Event Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter event title"
                maxLength={100}
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formData.title.length}/100 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe your event..."
              maxLength={2000}
            />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formData.description.length}/2000 characters
            </p>
          </div>
        </div>

        {/* Date & Time */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b pb-3 flex items-center gap-2">
            <FaCalendar className="text-blue-500" />
            Date & Time
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Time *
              </label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.time ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date (Optional)
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                min={formData.date}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.endDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.endDate && <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Time (Optional)
              </label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment Deadline (Optional)
              </label>
              <input
                type="date"
                name="paymentDeadline"
                value={formData.paymentDeadline}
                onChange={handleChange}
                max={formData.date}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.paymentDeadline ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.paymentDeadline && <p className="text-red-500 text-sm mt-1">{errors.paymentDeadline}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timezone
              </label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="Asia/Kolkata">India Standard Time (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="Europe/London">Greenwich Mean Time (GMT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Location & Event Type */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b pb-3 flex items-center gap-2">
            <FaMapMarkerAlt className="text-red-500" />
            Location & Event Type
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Event Type *
              </label>
              <div className="space-y-2">
                {eventTypes.map(type => (
                  <label key={type} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="eventType"
                      value={type}
                      checked={formData.eventType === type}
                      onChange={handleChange}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 capitalize">
                      {type.replace('-', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Visibility
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={formData.visibility === 'public'}
                    onChange={handleChange}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FaEye className="text-green-500" />
                    Public - Anyone can view and join
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={formData.visibility === 'private'}
                    onChange={handleChange}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FaEyeSlash className="text-red-500" />
                    Private - Only invited users can join
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Location Fields based on Event Type */}
          {formData.eventType !== 'virtual' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">Physical Location</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Venue {formData.eventType === 'in-person' && '*'}
                  </label>
                  <input
                    type="text"
                    name="location.venue"
                    value={formData.location.venue}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors['location.venue'] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter venue name"
                    maxLength={200}
                  />
                  {errors['location.venue'] && <p className="text-red-500 text-sm mt-1">{errors['location.venue']}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="location.address"
                    value={formData.location.address}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter full address"
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    name="location.city"
                    value={formData.location.city}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    name="location.state"
                    value={formData.location.state}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    name="location.pincode"
                    value={formData.location.pincode}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="PIN Code"
                  />
                </div>
              </div>
            </div>
          )}

          {(formData.eventType === 'virtual' || formData.eventType === 'hybrid') && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FaGlobe className="text-blue-500" />
                Online Meeting
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Online Link {formData.eventType === 'virtual' && '*'}
                </label>
                <input
                  type="url"
                  name="location.onlineLink"
                  value={formData.location.onlineLink}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors['location.onlineLink'] ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://meet.google.com/xyz-abcd-123"
                />
                {errors['location.onlineLink'] && <p className="text-red-500 text-sm mt-1">{errors['location.onlineLink']}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Financial Settings */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b pb-3 flex items-center gap-2">
            <FaMoneyBillWave className="text-green-500" />
            Financial Settings
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Contribution *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {formData.currency === 'INR' ? '₹' : 
                   formData.currency === 'USD' ? '$' :
                   formData.currency === 'EUR' ? '€' : '£'}
                </span>
                <input
                  type="number"
                  name="minimumContribution"
                  value={formData.minimumContribution}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.minimumContribution ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
              </div>
              {errors.minimumContribution && <p className="text-red-500 text-sm mt-1">{errors.minimumContribution}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Contribution (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {formData.currency === 'INR' ? '₹' : 
                   formData.currency === 'USD' ? '$' :
                   formData.currency === 'EUR' ? '€' : '£'}
                </span>
                <input
                  type="number"
                  name="maximumContribution"
                  value={formData.maximumContribution}
                  onChange={handleChange}
                  min={formData.minimumContribution}
                  step="1"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.maximumContribution ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="No maximum"
                />
              </div>
              {errors.maximumContribution && <p className="text-red-500 text-sm mt-1">{errors.maximumContribution}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estimated Budget (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {formData.currency === 'INR' ? '₹' : 
                   formData.currency === 'USD' ? '$' :
                   formData.currency === 'EUR' ? '€' : '£'}
                </span>
                <input
                  type="number"
                  name="estimatedBudget"
                  value={formData.estimatedBudget}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Currency
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {currencies.map(currency => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="allowLatePayments"
                checked={formData.allowLatePayments}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Allow late payments after deadline
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="allowPartialPayments"
                checked={formData.allowPartialPayments}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Allow partial payments (installments)
              </label>
            </div>
          </div>
        </div>

        {/* Participation Settings */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b pb-3 flex items-center gap-2">
            <FaUsers className="text-purple-500" />
            Participation Settings
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Participation Type *
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="participationType"
                    value="fixed"
                    checked={formData.participationType === 'fixed'}
                    onChange={handleChange}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Fixed - Limited number of participants
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="participationType"
                    value="unlimited"
                    checked={formData.participationType === 'unlimited'}
                    onChange={handleChange}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Unlimited - No participant limit
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Participants {formData.participationType === 'fixed' && '*'}
              </label>
              <input
                type="number"
                name="maxParticipants"
                value={formData.maxParticipants}
                onChange={handleChange}
                min="1"
                disabled={formData.participationType === 'unlimited'}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  formData.participationType === 'unlimited' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''
                } ${errors.maxParticipants ? 'border-red-500' : 'border-gray-300'}`}
                placeholder={formData.participationType === 'unlimited' ? 'Unlimited' : 'Enter number'}
              />
              {errors.maxParticipants && <p className="text-red-500 text-sm mt-1">{errors.maxParticipants}</p>}
            </div>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b pb-3 flex items-center gap-2">
            <FaTag className="text-orange-500" />
            Additional Settings
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cover Image URL (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="coverImage"
                  value={formData.coverImage}
                  onChange={handleChange}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="https://example.com/image.jpg"
                />
                <button
                  type="button"
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-lg transition-colors"
                >
                  <FaUpload />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleTagInputKeyPress}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Add a tag"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                        >
                          <FaTimes size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {event ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <FaSave />
                {event ? 'Update Event' : 'Create Event'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventForm;