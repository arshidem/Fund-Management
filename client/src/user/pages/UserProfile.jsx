import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  EnvelopeIcon, 
  PencilIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import useAdminService from '../../services/adminService';
import useMessageService from '../../services/messageService';
import useNoteService from '../../services/noteService';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const adminService = useAdminService();
  const messageService = useMessageService();
  const noteService = useNoteService();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const containerRef = useRef(null);
  const [activeRect, setActiveRect] = useState({ left: 0, width: 0 });

  // Update slider position when active tab changes
  useEffect(() => {
    const updateSliderPosition = () => {
      const container = containerRef.current;
      if (!container) return;

      const activeButton = container.querySelector(`button[data-tab="${activeTab}"]`);
      if (activeButton) {
        const rect = activeButton.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        
        setActiveRect({
          left: rect.left - parentRect.left,
          width: rect.width,
        });
      }
    };

    updateSliderPosition();
    window.addEventListener('resize', updateSliderPosition);
    
    return () => window.removeEventListener('resize', updateSliderPosition);
  }, [activeTab]);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const response = await adminService.getUserProfile(userId);
        setUserData(response.data);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  // Refresh user data after actions
  const refreshUserData = async () => {
    try {
      const response = await adminService.getUserProfile(userId);
      setUserData(response.data);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  // Handle approve user
  const handleApproveUser = async () => {
    try {
      setProcessingAction('approve');
      const notes = prompt('Enter approval notes (optional):');
      
      await adminService.approveUser(userId, notes || 'Approved via user profile');
      await refreshUserData();
      
      alert('User approved successfully!');
    } catch (error) {
      console.error('Failed to approve user:', error);
      alert('Failed to approve user: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle reject user
  const handleRejectUser = async () => {
    try {
      setProcessingAction('reject');
      const reason = prompt('Enter rejection reason:');
      if (!reason) {
        setProcessingAction(null);
        return;
      }

      await adminService.rejectUser(userId, reason);
      await refreshUserData();
      
      alert('User rejected successfully!');
    } catch (error) {
      console.error('Failed to reject user:', error);
      alert('Failed to reject user: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSendMessage = () => {
    if (userData?.user) {
      navigate(`/messages/user/${userData.user._id}?userName=${encodeURIComponent(userData.user.name)}`);
    }
  };

  // Handle add note
  const handleAddNote = async () => {
    try {
      const note = prompt('Enter admin note:');
      if (!note) return;

      await noteService.createNote(userId, note);
      alert('Note added successfully!');
      await refreshUserData();
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Failed to add note');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User not found</h2>
          <button 
            onClick={() => navigate('/admin/users')}
            className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  const { user, stats, recentParticipations, participationHistory } = userData;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin/users')}
                className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Back to Users</span>
              </button>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
                <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              {/* Approve/Reject Buttons */}
              {!user.isApproved ? (
                <button
                  onClick={handleApproveUser}
                  disabled={processingAction === 'approve'}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {processingAction === 'approve' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-1 border-white mr-2"></div>
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Approve User
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleRejectUser}
                  disabled={processingAction === 'reject'}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {processingAction === 'reject' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-1 border-white mr-2"></div>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Reject User
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleSendMessage}
                disabled={sendingMessage}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <EnvelopeIcon className="h-4 w-4 mr-2" />
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </button>
              
              <button
                onClick={handleAddNote}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Status Alert Banner */}
        {!user.isApproved && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center">
              <XMarkIcon className="h-5 w-5 text-yellow-400 mr-2" />
              <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                This user is pending approval.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - User Info & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Status Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Status</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Approval Status:</span>
                  <span className={`font-medium ${
                    user.isApproved ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {user.isApproved ? 'Approved' : 'Pending'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Role:</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400 capitalize">{user.role}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Registered:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Last Login:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              
              <div className="space-y-2">
                <button
                  onClick={() => adminService.updateUserRole(userId, user.role === 'admin' ? 'user' : 'admin')}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </button>
                
                <button
                  onClick={handleAddNote}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  Add Admin Note
                </button>
                
                <button
                  onClick={handleSendMessage}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  Send Message
                </button>
              </div>
            </div>

            {/* Participation Stats Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Participation Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <UserGroupIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-gray-600 dark:text-gray-400">Total Events</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{stats.totalEvents}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-gray-600 dark:text-gray-400">Active Events</span>
                  </div>
                  <span className="font-semibold text-green-600 dark:text-green-400">{stats.activeEvents}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CurrencyDollarIcon className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-gray-600 dark:text-gray-400">Total Contributed</span>
                  </div>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    ₹{stats.totalContributed?.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-5 w-5 text-purple-500 mr-2" />
                    <span className="text-gray-600 dark:text-gray-400">Admin Notes</span>
                  </div>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">{stats.noteCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tab Navigation with Animated Slider */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="border-b border-gray-200 dark:border-gray-700 relative">
                <nav ref={containerRef} className="flex -mb-px relative">
                  {['overview', 'activity', 'participations', 'notes'].map((tab) => (
                    <button
                      key={tab}
                      data-tab={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors relative z-10 ${
                        activeTab === tab
                          ? 'text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-400'
                          : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                  
                  {/* Animated Slider */}
                  <div
                    className="absolute top-2 bottom-2 bg-blue-500/20 rounded-xl border border-blue-500/30 transition-all duration-500 ease-out"
                    style={{
                      left: `${activeRect.left}px`,
                      width: `${activeRect.width}px`,
                    }}
                  />
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <OverviewTab 
                    user={user} 
                    participationHistory={participationHistory}
                    recentParticipations={recentParticipations}
                  />
                )}
                
                {activeTab === 'activity' && (
                  <ActivityTab userId={userId} />
                )}
                
                {activeTab === 'participations' && (
                  <ParticipationsTab recentParticipations={recentParticipations} />
                )}
                
                {activeTab === 'notes' && (
                  <NotesTab userId={userId} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tab Components
const OverviewTab = ({ user, participationHistory, recentParticipations }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Participation History</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Events Joined:</span>
            <span className="font-medium text-gray-900 dark:text-white">{participationHistory.totalEvents}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Active Participations:</span>
            <span className="font-medium text-green-600 dark:text-green-400">{participationHistory.activeParticipations}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Contributions:</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">₹{participationHistory.totalContributions?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Fully Paid Events:</span>
            <span className="font-medium text-purple-600 dark:text-purple-400">{participationHistory.fullyPaidEvents}</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Account Information</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Email:</span>
            <span className="font-medium text-gray-900 dark:text-white">{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Phone:</span>
              <span className="font-medium text-gray-900 dark:text-white">{user.phone}</span>
            </div>
          )}
          {user.gender && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Gender:</span>
              <span className="font-medium text-gray-900 dark:text-white capitalize">{user.gender}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Last Login:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
            </span>
          </div>
        </div>
      </div>
    </div>

    {recentParticipations && recentParticipations.length > 0 && (
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Participations</h4>
        <div className="space-y-3">
          {recentParticipations.map((participation) => (
            <div key={participation._id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <h5 className="font-medium text-gray-900 dark:text-white">{participation.event?.title}</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Joined: {new Date(participation.joinedAt).toLocaleDateString()} • 
                  Status: <span className={`font-medium ${
                    participation.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {participation.status}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-600 dark:text-blue-400">₹{participation.totalContributed?.toLocaleString()}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{participation.paymentStatus}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const ActivityTab = ({ userId }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const adminService = useAdminService();

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await adminService.getUserActivity(userId);
        setActivities(response.data);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [userId, adminService]);

  if (loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading activities...</div>;
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h4>
      {activities.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activity found</p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-gray-900 dark:text-white">{activity.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ParticipationsTab = ({ recentParticipations }) => (
  <div>
    <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Event Participations</h4>
    {!recentParticipations || recentParticipations.length === 0 ? (
      <p className="text-gray-500 dark:text-gray-400 text-center py-8">No participations found</p>
    ) : (
      <div className="space-y-4">
        {recentParticipations.map((participation) => (
          <div key={participation._id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700">
            <div className="flex justify-between items-start mb-2">
              <h5 className="font-semibold text-gray-900 dark:text-white">{participation.event?.title}</h5>
              <span className={`px-2 py-1 text-xs rounded-full ${
                participation.status === 'active' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
              }`}>
                {participation.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Event Date:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {participation.event?.date ? new Date(participation.event.date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              
              <div>
                <span className="text-gray-600 dark:text-gray-400">Joined:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(participation.joinedAt).toLocaleDateString()}
                </p>
              </div>
              
              <div>
                <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  ₹{participation.totalContributed?.toLocaleString()}
                </p>
              </div>
              
              <div>
                <span className="text-gray-600 dark:text-gray-400">Payment:</span>
                <p className={`font-medium capitalize ${
                  participation.paymentStatus === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {participation.paymentStatus}
                </p>
              </div>
            </div>
            
            {participation.notes && (
              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">{participation.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

const NotesTab = ({ userId }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const noteService = useNoteService();

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await noteService.getUserNotes(userId);
        setNotes(response.data.notes || []);
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [userId, noteService]);

  if (loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading notes...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">Admin Notes</h4>
        <button
          onClick={() => {
            const note = prompt('Enter new note:');
            if (note) {
              noteService.createNote(userId, note).then(() => {
                // Refresh notes
                noteService.getUserNotes(userId).then(response => {
                  setNotes(response.data.notes || []);
                });
              });
            }
          }}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Add Note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No notes found</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note._id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  note.category === 'warning' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  note.category === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                }`}>
                  {note.category}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-900 dark:text-white">{note.note}</p>
              {note.tags && note.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserProfile;