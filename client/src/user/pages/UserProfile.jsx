import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  EnvelopeIcon, 
  PencilIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon
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


  const handleSendMessage = () => {
    // Navigate to messages page with user ID and name as parameters
    navigate(`/messages/user/${user._id}?userName=${encodeURIComponent(user.name)}`);
  };

  // Handle add note
  const handleAddNote = async () => {
    try {
      const note = prompt('Enter admin note:');
      if (!note) return;

      await noteService.createNote(userId, note);
      alert('Note added successfully!');
      
      // Refresh user data to update note count
      const response = await adminService.getUserProfile(userId);
      setUserData(response.data);
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Failed to add note');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">User not found</h2>
          <button 
            onClick={() => navigate('/admin/users')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  const { user, stats, recentParticipations, participationHistory } = userData;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin/users')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Back to Users</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <EnvelopeIcon className="h-4 w-4 mr-2" />
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </button>
              <button
                onClick={handleAddNote}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Add Note
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - User Info & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Status Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Approval Status:</span>
                  <span className={`font-medium ${
                    user.isApproved ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {user.isApproved ? 'Approved' : 'Pending'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Block Status:</span>
                  <span className={`font-medium ${
                    user.isBlocked ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {user.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Role:</span>
                  <span className="font-medium text-blue-600 capitalize">{user.role}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Registered:</span>
                  <span className="text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Participation Stats Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Participation Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <UserGroupIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-gray-600">Total Events</span>
                  </div>
                  <span className="font-semibold text-gray-900">{stats.totalEvents}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-gray-600">Active Events</span>
                  </div>
                  <span className="font-semibold text-green-600">{stats.activeEvents}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CurrencyDollarIcon className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-gray-600">Total Contributed</span>
                  </div>
                  <span className="font-semibold text-blue-600">
                    ₹{stats.totalContributed?.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-5 w-5 text-purple-500 mr-2" />
                    <span className="text-gray-600">Admin Notes</span>
                  </div>
                  <span className="font-semibold text-purple-600">{stats.noteCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  {['overview', 'activity', 'participations', 'notes', 'messages'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
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
                
                {activeTab === 'messages' && (
                  <MessagesTab userId={userId} />
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
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Participation History</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Total Events Joined:</span>
            <span className="font-medium">{participationHistory.totalEvents}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Participations:</span>
            <span className="font-medium text-green-600">{participationHistory.activeParticipations}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Contributions:</span>
            <span className="font-medium text-blue-600">₹{participationHistory.totalContributions?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Fully Paid Events:</span>
            <span className="font-medium text-purple-600">{participationHistory.fullyPaidEvents}</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Account Information</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Email:</span>
            <span className="font-medium">{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex justify-between">
              <span>Phone:</span>
              <span className="font-medium">{user.phone}</span>
            </div>
          )}
          {user.gender && (
            <div className="flex justify-between">
              <span>Gender:</span>
              <span className="font-medium capitalize">{user.gender}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Last Login:</span>
            <span className="font-medium">
              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
            </span>
          </div>
        </div>
      </div>
    </div>

    {recentParticipations && recentParticipations.length > 0 && (
      <div>
        <h4 className="font-semibold text-gray-900 mb-4">Recent Participations</h4>
        <div className="space-y-3">
          {recentParticipations.map((participation) => (
            <div key={participation._id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
              <div>
                <h5 className="font-medium text-gray-900">{participation.event?.title}</h5>
                <p className="text-sm text-gray-600">
                  Joined: {new Date(participation.joinedAt).toLocaleDateString()} • 
                  Status: <span className={`font-medium ${
                    participation.status === 'active' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {participation.status}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-600">₹{participation.totalContributed?.toLocaleString()}</p>
                <p className="text-sm text-gray-600 capitalize">{participation.paymentStatus}</p>
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
    return <div className="text-center py-8">Loading activities...</div>;
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Recent Activity</h4>
      {activities.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No activity found</p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-gray-900">{activity.description}</p>
                <p className="text-sm text-gray-500">
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
    <h4 className="font-semibold text-gray-900 mb-4">Event Participations</h4>
    {!recentParticipations || recentParticipations.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No participations found</p>
    ) : (
      <div className="space-y-4">
        {recentParticipations.map((participation) => (
          <div key={participation._id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h5 className="font-semibold text-gray-900">{participation.event?.title}</h5>
              <span className={`px-2 py-1 text-xs rounded-full ${
                participation.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {participation.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Event Date:</span>
                <p className="font-medium">
                  {participation.event?.date ? new Date(participation.event.date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              
              <div>
                <span className="text-gray-600">Joined:</span>
                <p className="font-medium">
                  {new Date(participation.joinedAt).toLocaleDateString()}
                </p>
              </div>
              
              <div>
                <span className="text-gray-600">Contribution:</span>
                <p className="font-medium text-blue-600">
                  ₹{participation.totalContributed?.toLocaleString()}
                </p>
              </div>
              
              <div>
                <span className="text-gray-600">Payment:</span>
                <p className={`font-medium capitalize ${
                  participation.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {participation.paymentStatus}
                </p>
              </div>
            </div>
            
            {participation.notes && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">{participation.notes}</p>
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
    return <div className="text-center py-8">Loading notes...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-gray-900">Admin Notes</h4>
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
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Add Note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No notes found</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note._id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  note.category === 'warning' ? 'bg-red-100 text-red-800' :
                  note.category === 'positive' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {note.category}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-900">{note.note}</p>
              {note.tags && note.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
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

const MessagesTab = ({ userId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const messageService = useMessageService();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await messageService.getMessageHistory(userId);
        setMessages(response.data.messages || []);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [userId, messageService]);

  if (loading) {
    return <div className="text-center py-8">Loading messages...</div>;
  }

  return (
    <div>
      <h4 className="font-semibold text-gray-900 mb-4">Message History</h4>
      {messages.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No messages found</p>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message._id} className={`border rounded-lg p-4 ${
              message.sender._id === userId ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">
                  {message.sender._id === userId ? message.sender.name : 'You'}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(message.createdAt).toLocaleString()}
                </span>
              </div>
              <h5 className="font-semibold text-gray-900 mb-1">{message.subject}</h5>
              <p className="text-gray-700">{message.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserProfile;