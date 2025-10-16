import React, { useState, useEffect, useRef } from "react";
import { useParticipantService } from "../../../../services/participantService";
import { useContributionService } from "../../../../services/contributionService";
import AddOfflineContributionModal from "../components/AddOfflineContributionModal";
import ParticipantDetailsModal from "../components/ParticipantDetailsModal"
import BulkActionsPanel from "../components/BulkActionsPanel";
import {
  FaUserPlus,
  FaMoneyBillWave,
  FaSearch,
  FaFilter,
  FaCheck,
  FaTimes,
  FaBell,
  FaEnvelope,
  FaUserCheck,
  FaUserSlash,
  FaListAlt,
  FaDownload,
  FaTrash,
  FaEdit,
  FaEye,
  FaKeyboard,
  FaMousePointer,
} from "react-icons/fa";

const ParticipantsTab = ({
  event,
  user,
  isEventCreator,
  formatCurrency,
  formatDate,
}) => {
  const {
    fetchEventParticipants,
    updateParticipantStatus,
    removeParticipant,
    fetchParticipantDetails,
  } = useParticipantService();

  const {
    createOfflineContribution,
    updateContributionStatus,
    fetchEventContributions,
  } = useContributionService();

  const [participants, setParticipants] = useState([]);
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Selection State
  const [selectedParticipants, setSelectedParticipants] = useState(new Set());
  const [currentSelectedIndex, setCurrentSelectedIndex] = useState(0);

  // Modal States
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantContributions, setParticipantContributions] = useState([]);

  // UI States
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    loadParticipants();
  }, [event._id]);

  useEffect(() => {
    filterParticipants();
  }, [participants, searchTerm, statusFilter, paymentFilter]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if user is typing in input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Only process shortcuts if we have participants
      if (filteredParticipants.length === 0) return;

      switch (e.key) {
        case "j": // Next participant
          e.preventDefault();
          handleNavigate("down");
          break;
        case "k": // Previous participant
          e.preventDefault();
          handleNavigate("up");
          break;
        case " ": // Select participant
          e.preventDefault();
          toggleParticipantSelection(currentSelectedIndex);
          break;
        case "a": // Select all
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSelectAll();
          }
          break;
        case "v": // Verify payment
          e.preventDefault();
          handleQuickVerify();
          break;
        case "r": // Send reminder
          e.preventDefault();
          handleQuickReminder();
          break;
        case "d": // View details
          e.preventDefault();
          handleViewDetails();
          break;
        case "c": // Add contribution
          e.preventDefault();
          handleQuickAddContribution();
          break;
        case "?": // Show help
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
        case "Escape": // Clear selection
          e.preventDefault();
          setSelectedParticipants(new Set());
          setCurrentSelectedIndex(0);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [filteredParticipants, currentSelectedIndex, selectedParticipants]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const data = await fetchEventParticipants(event._id, {
        status: statusFilter !== "all" ? statusFilter : undefined,
        paymentStatus: paymentFilter !== "all" ? paymentFilter : undefined,
        search: searchTerm || undefined,
      });
      setParticipants(data.participants || []);
    } catch (error) {
      console.error("Error loading participants:", error);
    } finally {
      setLoading(false);
    }
  };
  const filterParticipants = () => {
    const filtered = participants.filter((participant) => {
      // Check if participant.user exists before accessing properties
      if (!participant.user) {
        return false; // Skip participants with no user data
      }

      const matchesSearch =
        participant.user.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        participant.user.email
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || participant.status === statusFilter;
      const matchesPayment =
        paymentFilter === "all" || participant.paymentStatus === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
    setFilteredParticipants(filtered);

    // Reset selection when filters change
    if (filtered.length > 0 && currentSelectedIndex >= filtered.length) {
      setCurrentSelectedIndex(0);
    }
  };

  // Navigation
  const handleNavigate = (direction) => {
    if (filteredParticipants.length === 0) return;

    let newIndex;
    if (direction === "down") {
      newIndex = (currentSelectedIndex + 1) % filteredParticipants.length;
    } else {
      newIndex =
        (currentSelectedIndex - 1 + filteredParticipants.length) %
        filteredParticipants.length;
    }
    setCurrentSelectedIndex(newIndex);
  };

  // Selection Management
  const toggleParticipantSelection = (index) => {
    const participantId = filteredParticipants[index]?._id;
    if (!participantId) return;

    const newSelection = new Set(selectedParticipants);
    if (newSelection.has(participantId)) {
      newSelection.delete(participantId);
    } else {
      newSelection.add(participantId);
    }
    setSelectedParticipants(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedParticipants.size === filteredParticipants.length) {
      setSelectedParticipants(new Set());
    } else {
      const allIds = new Set(filteredParticipants.map((p) => p._id));
      setSelectedParticipants(allIds);
    }
  };

  const clearSelection = () => {
    setSelectedParticipants(new Set());
    setCurrentSelectedIndex(0);
  };

  // Quick Actions

  const handleQuickAddContribution = async () => {
    const participant = filteredParticipants[currentSelectedIndex];
    if (!participant) return;

    setActionLoading("add-contribution");
    try {
      // Add quick payment of minimum contribution amount
      const amount =
        event.minimumContribution - participant.totalContributed > 0
          ? event.minimumContribution - participant.totalContributed
          : event.minimumContribution;

      await createOfflineContribution(event._id, {
        amount,
        paymentMethod: "cash",
        transactionId: `QUICK_${Date.now()}`,
        userId: participant.user._id, // This should be participant's user ID
        participantId: participant._id, // Add participant ID
        createdBy: user._id, // Admin who is creating this payment
      });

      await loadParticipants();
      alert(
        `Added ${formatCurrency(amount)} payment for ${participant.user.name}`
      );
    } catch (error) {
      console.error("Error adding quick contribution:", error);
      alert("Failed to add payment: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };
  const handleQuickVerify = async () => {
    const participant = filteredParticipants[currentSelectedIndex];
    if (!participant) return;

    setActionLoading("verify");
    try {
      // Get participant's pending contributions
      const contributionsData = await fetchEventContributions(event._id, {
        userId: participant.user._id, // Use participant's user ID
        status: "pending",
      });

      if (contributionsData.contributions?.length > 0) {
        // Verify the first pending contribution
        await updateContributionStatus(contributionsData.contributions[0]._id, {
          status: "completed",
          verifiedBy: user._id, // Admin who is verifying
        });
        await loadParticipants();
        alert(`Verified payment for ${participant.user.name}`);
      } else {
        alert("No pending payments found for this participant");
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      alert("Failed to verify payment: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickReminder = async () => {
    const participant = filteredParticipants[currentSelectedIndex];
    if (!participant) return;

    setActionLoading("reminder");
    try {
      // Simulate sending reminder (implement your actual notification service)
      console.log(`Sending payment reminder to ${participant.user.email}`);

      // Show confirmation
      alert(`Payment reminder sent to ${participant.user.name}`);
    } catch (error) {
      console.error("Error sending reminder:", error);
      alert("Failed to send reminder: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async () => {
    const participant = filteredParticipants[currentSelectedIndex];
    if (!participant) return;

    setActionLoading("details");
    try {
      const details = await fetchParticipantDetails(participant._id);
      const contributions = await fetchEventContributions(event._id, {
        userId: participant.user._id,
      });

      setSelectedParticipant(details.participant);
      setParticipantContributions(contributions.contributions || []);
      setShowDetailsModal(true);
    } catch (error) {
      console.error("Error loading participant details:", error);
      alert("Failed to load participant details");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusUpdate = async (participantId, newStatus) => {
    try {
      await updateParticipantStatus(participantId, { status: newStatus });
      await loadParticipants();
      alert(`Participant status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status: " + error.message);
    }
  };

  const handleAddOfflineContribution = (participant) => {
    setSelectedParticipant(participant);
    setShowOfflineModal(true);
  };

  const handleOfflineContributionSubmit = async (contributionData) => {
    try {
      await createOfflineContribution(event._id, {
        ...contributionData,
        userId: selectedParticipant.user._id, // Participant's user ID
        participantId: selectedParticipant._id, // Participant ID
        createdBy: user._id, // Admin who is creating this payment
      });

      await loadParticipants();
      setShowOfflineModal(false);
      setSelectedParticipant(null);
      alert("Offline contribution added successfully!");
    } catch (error) {
      console.error("Error adding offline contribution:", error);
      alert("Failed to add offline contribution: " + error.message);
    }
  };

  // Bulk Actions
  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedParticipants.size === 0) return;

    try {
      const promises = Array.from(selectedParticipants).map((participantId) =>
        updateParticipantStatus(participantId, { status: newStatus })
      );

      await Promise.all(promises);
      await loadParticipants();
      clearSelection();
      alert(
        `Updated ${selectedParticipants.size} participants to ${newStatus}`
      );
    } catch (error) {
      console.error("Error in bulk status update:", error);
      alert("Failed to update some participants");
    }
  };

  const handleBulkReminder = async () => {
    if (selectedParticipants.size === 0) return;

    try {
      // Simulate bulk reminders
      const selectedNames = filteredParticipants
        .filter((p) => selectedParticipants.has(p._id))
        .map((p) => p.user.name);

      console.log(`Sending reminders to:`, selectedNames);
      alert(
        `Sent payment reminders to ${selectedParticipants.size} participants`
      );
      clearSelection();
    } catch (error) {
      console.error("Error sending bulk reminders:", error);
      alert("Failed to send some reminders");
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "text-green-400 bg-green-900/20";
      case "overpaid":
        return "text-purple-400 bg-purple-900/20";
      case "partial":
        return "text-yellow-400 bg-yellow-900/20";
      case "pending":
        return "text-red-400 bg-red-900/20";
      default:
        return "text-gray-400 bg-gray-900/20";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "text-green-400 bg-green-900/20";
      case "waitlisted":
        return "text-yellow-400 bg-yellow-900/20";
      case "invited":
        return "text-blue-400 bg-blue-900/20";
      case "cancelled":
        return "text-red-400 bg-red-900/20";
      case "removed":
        return "text-gray-400 bg-gray-900/20";
      default:
        return "text-gray-400 bg-gray-900/20";
    }
  };

  const QuickActionButton = ({
    icon,
    label,
    onClick,
    color = "blue",
    loading,
  }) => (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all duration-200 ${
        color === "green"
          ? "bg-green-600 hover:bg-green-500"
          : color === "red"
          ? "bg-red-600 hover:bg-red-500"
          : color === "yellow"
          ? "bg-yellow-600 hover:bg-yellow-500"
          : "bg-blue-600 hover:bg-blue-500"
      } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
      title={label}
    >
      {loading ? (
        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : (
        icon
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-300 dark:bg-gray-700 rounded"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Navigate:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  j/k
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Select participant:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  Space
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Add payment:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  c
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Verify payment:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  v
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Send reminder:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  r
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>View details:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  d
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Select all:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  Ctrl+A
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Clear selection:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  Esc
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Focus search:</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  Ctrl+K
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Participants
              </h3>
              <button
                onClick={() => setShowKeyboardHelp(true)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Keyboard Shortcuts"
              >
                <FaKeyboard />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {filteredParticipants.length} of{" "}
              {event.participationType === "unlimited"
                ? "∞"
                : event.maxParticipants}{" "}
              participants
              {selectedParticipants.size > 0 &&
                ` • ${selectedParticipants.size} selected`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search participants... (Ctrl+K)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500 w-full sm:w-64"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="invited">Invited</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="overpaid">Overpaid</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {selectedParticipants.size > 0 && (
          <BulkActionsPanel
            selectedCount={selectedParticipants.size}
            onStatusUpdate={handleBulkStatusUpdate}
            onSendReminders={handleBulkReminder}
            onClearSelection={clearSelection}
          />
        )}
      </div>

      {/* Participants List */}
      {filteredParticipants.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
          <FaUserPlus className="text-5xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No participants found
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
            {searchTerm || statusFilter !== "all" || paymentFilter !== "all"
              ? "Try adjusting your filters"
              : "Be the first to join this event!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={
                  selectedParticipants.size === filteredParticipants.length &&
                  filteredParticipants.length > 0
                }
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Select all ({filteredParticipants.length})
              </span>
            </div>
            {selectedParticipants.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Clear selection
              </button>
            )}
          </div>

          {/* Participants Grid */}
          {filteredParticipants.map((participant, index) => (
            <div
              key={participant._id}
              className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-2 transition-all duration-200 ${
                index === currentSelectedIndex
                  ? "border-blue-500 dark:border-blue-400 shadow-md"
                  : selectedParticipants.has(participant._id)
                  ? "border-green-500 dark:border-green-400 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
              onClick={() => setCurrentSelectedIndex(index)}
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Selection Checkbox and Basic Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.has(participant._id)}
                    onChange={() => toggleParticipantSelection(index)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mt-1"
                  />

                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {participant.user.name?.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {participant.user.name}
                        </p>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            participant.status
                          )}`}
                        >
                          {participant.status}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                            participant.paymentStatus
                          )}`}
                        >
                          {participant.paymentStatus}
                        </span>
                      </div>

                      <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                        {participant.user.email}
                      </p>

                      {participant.user.phone && (
                        <p className="text-gray-500 dark:text-gray-500 text-sm">
                          {participant.user.phone}
                        </p>
                      )}

                      <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
                        Joined {formatDate(participant.joinedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Info and Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                  {/* Payment Information */}
                  <div className="text-right sm:text-left">
                    <p className="text-green-600 dark:text-green-400 font-semibold text-lg">
                      {formatCurrency(participant.totalContributed)}
                    </p>
                    {participant.remainingAmount > 0 && (
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        Remaining: {formatCurrency(participant.remainingAmount)}
                      </p>
                    )}

                    {/* Payment Progress */}
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-green-500 h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            participant.paymentPercentage
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {/* Quick Actions - Only show for Event Creator/Admin */}
                  {isEventCreator && (
                    <div className="flex flex-wrap gap-1">
                      <QuickActionButton
                        icon={<FaMoneyBillWave className="text-xs" />}
                        label="Add Payment"
                        onClick={() =>
                          handleAddOfflineContribution(participant)
                        }
                        color="green"
                      />

                      <QuickActionButton
                        icon={<FaCheck className="text-xs" />}
                        label="Verify"
                        onClick={() => handleQuickVerify()}
                        color="blue"
                        loading={
                          actionLoading === "verify" &&
                          index === currentSelectedIndex
                        }
                      />

                      <QuickActionButton
                        icon={<FaBell className="text-xs" />}
                        label="Remind"
                        onClick={() => handleQuickReminder()}
                        color="yellow"
                        loading={
                          actionLoading === "reminder" &&
                          index === currentSelectedIndex
                        }
                      />

                      <QuickActionButton
                        icon={<FaEye className="text-xs" />}
                        label="Details"
                        onClick={() => handleViewDetails()}
                        color="blue"
                        loading={
                          actionLoading === "details" &&
                          index === currentSelectedIndex
                        }
                      />

                      {participant.status === "waitlisted" && (
                        <QuickActionButton
                          icon={<FaUserCheck className="text-xs" />}
                          label="Activate"
                          onClick={() =>
                            handleStatusUpdate(participant._id, "active")
                          }
                          color="green"
                        />
                      )}

                      {participant.status === "active" && (
                        <QuickActionButton
                          icon={<FaUserSlash className="text-xs" />}
                          label="Cancel"
                          onClick={() =>
                            handleStatusUpdate(participant._id, "cancelled")
                          }
                          color="red"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showOfflineModal && selectedParticipant && (
        <AddOfflineContributionModal
          participant={selectedParticipant}
          event={event}
          onSubmit={handleOfflineContributionSubmit}
          onClose={() => {
            setShowOfflineModal(false);
            setSelectedParticipant(null);
          }}
          formatCurrency={formatCurrency}
        />
      )}
{showDetailsModal && selectedParticipant && (
  console.log('Selected Participant Data:', selectedParticipant),
  <ParticipantDetailsModal
    participant={selectedParticipant}
    contributions={participantContributions}
    event={event}
    onClose={() => {
      setShowDetailsModal(false);
      setSelectedParticipant(null);
      setParticipantContributions([]);
    }}
    formatCurrency={formatCurrency}
    formatDate={formatDate}
  />
)}
    </div>
  );
};

export default ParticipantsTab;
