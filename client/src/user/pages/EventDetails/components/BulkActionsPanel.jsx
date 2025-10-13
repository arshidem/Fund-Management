import React from "react";
import { FaUsers, FaCheck, FaTimes, FaBell, FaEnvelope, FaDownload } from "react-icons/fa";

const BulkActionsPanel = ({ selectedCount, onStatusUpdate, onSendReminders, onClearSelection }) => {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2">
        <FaUsers className="text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
          {selectedCount} participants selected
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <select
          onChange={(e) => e.target.value && onStatusUpdate(e.target.value)}
          className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">Update Status</option>
          <option value="active">Mark as Active</option>
          <option value="waitlisted">Move to Waitlist</option>
          <option value="cancelled">Cancel Participation</option>
        </select>
        
        <button
          onClick={onSendReminders}
          className="flex items-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded transition-colors duration-200"
        >
          <FaBell className="text-xs" />
          Send Reminders
        </button>
        
        <button
          className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors duration-200"
        >
          <FaDownload className="text-xs" />
          Export Selected
        </button>
        
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors duration-200"
        >
          <FaTimes className="text-xs" />
          Clear
        </button>
      </div>
    </div>
  );
};

export default BulkActionsPanel;