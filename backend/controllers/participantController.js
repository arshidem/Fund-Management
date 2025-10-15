// controllers/participantController.js
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const Contribution = require('../models/Contribution');
const User = require('../models/User');

// ==================== JOIN EVENT ====================
// ==================== JOIN EVENT ====================
const joinEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { notes } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

 const allowedStatuses = ["published", "ongoing"];
if (!event.isActive || !allowedStatuses.includes(event.status)) {
  return res.status(400).json({ success: false, message: "Event is not available for joining" });
}

    // check if participant exists for this user + event
    let participant = await Participant.findOne({
      event: eventId,
      user: req.userId
    });

    if (participant && ["active", "waitlisted"].includes(participant.status)) {
      return res.status(400).json({ success: false, message: "You have already joined this event" });
    }

    if (participant && participant.status === "cancelled") {
      // reactivate old record
      participant.status = "active";
      participant.response = "accepted";
      participant.notes = notes;
      await participant.save();
      await participant.populate("user", "name email phone");

      return res.json({
        success: true,
        message: "Re-joined the event successfully",
        participant: participant.toParticipantJSON(),
        waitlisted: false
      });
    }

    // if no record exists, create new one
    participant = new Participant({
      event: eventId,
      user: req.userId,
      status: "active",
      notes,
      response: "accepted"
    });

    await participant.save();
    await participant.populate("user", "name email phone");

    res.status(201).json({
      success: true,
      message: "Successfully joined the event",
      participant: participant.toParticipantJSON(),
      waitlisted: false
    });

  } catch (error) {
    console.error("Join event error:", error);
    res.status(500).json({
      success: false,
      message: "Error joining event",
      error: error.message
    });
  }
};


// ==================== LEAVE EVENT ====================
const leaveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const participant = await Participant.findOne({
      event: eventId,
      user: req.userId,
      status: { $in: ['active', 'waitlisted'] }
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'You are not participating in this event'
      });
    }

    participant.status = 'cancelled';
    participant.response = 'declined';
    await participant.save();

    if (participant.status === 'waitlisted') {
      await promoteFromWaitlist(eventId);
    }

    res.json({
      success: true,
      message: 'Successfully left the event'
    });

  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving event',
      error: error.message
    });
  }
};

// ==================== GET EVENT PARTICIPANTS ====================
const getEventParticipants = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, paymentStatus, page = 1, limit = 20, search } = req.query;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    let query = { event: eventId };
    
    if (status && status !== 'all') query.status = status;
    if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;

    // Fixed search query
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      if (users.length > 0) {
        query.user = { $in: users.map(u => u._id) };
      } else {
        query.user = { $in: [] };
      }
    }

    const participants = await Participant.find(query)
      .populate('user', 'name email phone avatar')
      .populate('event')
      .sort({ joinedAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Participant.countDocuments(query);

    // Process participants with virtual fields
    const participantsWithDetails = await Promise.all(
      participants.map(async (participant) => {
        try {
          return await participant.toParticipantJSON();
        } catch (error) {
          console.error('Error processing participant:', error);
          return participant.toObject();
        }
      })
    );

    // Simple payment summary from participant data
    const paymentSummary = {};
    participantsWithDetails.forEach(participant => {
      const status = participant.paymentStatus;
      if (!paymentSummary[status]) {
        paymentSummary[status] = { count: 0, totalAmount: 0 };
      }
      paymentSummary[status].count++;
      paymentSummary[status].totalAmount += participant.totalContributed || 0;
    });

    res.json({
      success: true,
      participants: participantsWithDetails,
      summary: {
        totalParticipants: total,
        paymentSummary
      },
      pagination: { 
        current: parseInt(page), 
        total: Math.ceil(total / limit),
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get event participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching participants',
      error: error.message
    });
  }
};

// ==================== GET USER PARTICIPATIONS ====================
const getUserParticipations = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

  if (!req.userId) {
  return res.status(401).json({ success: false, message: 'Not authenticated' });
}

    let query = { user: userId };
    if (status) query.status = status;

    const participations = await Participant.find(query)
      .populate('event', 'title date time location status category minimumContribution')
      .sort({ joinedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Participant.countDocuments(query);

    const participationsWithDetails = participations.map(participation => {
      const participationObj = participation.toParticipantJSON();
      if (participation.event) {
        participationObj.eventDetails = {
          title: participation.event.title,
          date: participation.event.date,
          time: participation.event.time,
          location: participation.event.location,
          status: participation.event.status,
          category: participation.event.category,
          minimumContribution: participation.event.minimumContribution
        };
      }
      return participationObj;
    });

    res.json({
      success: true,
      participations: participationsWithDetails,
      pagination: { current: parseInt(page), total: Math.ceil(total / limit), totalParticipations: total }
    });

  } catch (error) {
    console.error('Get user participations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user participations',
      error: error.message
    });
  }
};

// ==================== UPDATE PARTICIPANT STATUS ====================
const updateParticipantStatus = async (req, res) => {
  try {
    const { participantId } = req.params;
    const { status, notes, isConfirmed } = req.body;

    const participant = await Participant.findById(participantId)
      .populate('event')
      .populate('user', 'name email');

    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // SIMPLIFIED: Only check if user is event creator (admin routes use adminOnly middleware)
    // if (participant.event.createdBy.toString() !== req.userId) {
    //   return res.status(403).json({ message: 'Not authorized to update participant status' });
    // }

    if (status) participant.status = status;
    if (notes !== undefined) participant.notes = notes;
    if (isConfirmed !== undefined) {
      participant.isConfirmed = isConfirmed;
      if (isConfirmed) {
        participant.confirmedAt = new Date();
        participant.confirmedBy = req.userId;
      }
    }

    await participant.save();

    if (status === 'active' && participant.status === 'waitlisted') {
      await participant.promoteFromWaitlist();
      await Participant.updateMany(
        { event: participant.event, status: 'waitlisted', waitlistPosition: { $gt: participant.waitlistPosition } },
        { $inc: { waitlistPosition: -1 } }
      );
    }

    res.json({
      success: true,
      message: 'Participant status updated successfully',
      participant: participant.toParticipantJSON()
    });

  } catch (error) {
    console.error('Update participant status error:', error);
    res.status(500).json({ message: 'Error updating participant status', error: error.message });
  }
};

// ==================== REMOVE PARTICIPANT ====================
const removeParticipant = async (req, res) => {
  try {
    const { participantId } = req.params;
    const { reason } = req.body;

    const participant = await Participant.findById(participantId)
      .populate('event')
      .populate('user', 'name email');

    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // SIMPLIFIED: Only check if user is event creator (admin routes use adminOnly middleware)
    if (participant.event.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to remove participant' });
    }

    participant.status = 'removed';
    participant.adminNotes = reason || 'Removed by admin';
    await participant.save();

    if (participant.event.participationType === 'fixed') {
      await promoteFromWaitlist(participant.event._id);
    }

    res.json({ success: true, message: 'Participant removed successfully' });

  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ message: 'Error removing participant', error: error.message });
  }
};

// ==================== GET PARTICIPANT DETAILS ====================
const getParticipantDetails = async (req, res) => {
  try {
    const { participantId } = req.params;

    const participant = await Participant.findById(participantId)
      .populate('user', 'name email phone avatar')
      .populate('event', 'title date time location minimumContribution')
      .populate('confirmedBy', 'name email');

    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    const event = await Event.findById(participant.event);
    if (participant.user._id.toString() !== req.userId && event.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view participant details' });
    }

    const paymentHistory = await Contribution.find({ participant: participantId, status: 'completed' })
      .sort({ paymentDate: -1 });

    const participantDetails = participant.toParticipantJSON();
    participantDetails.paymentHistory = paymentHistory;

    res.json({ success: true, participant: participantDetails });

  } catch (error) {
    console.error('Get participant details error:', error);
    res.status(500).json({ message: 'Error fetching participant details', error: error.message });
  }
};

// ==================== INVITE PARTICIPANT ====================
const inviteParticipant = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, email } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to invite participants' });
    }

    let user;
    if (userId) user = await User.findById(userId);
    else if (email) user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingParticipant = await Participant.findOne({ event: eventId, user: user._id });
    if (existingParticipant) {
      return res.status(400).json({ message: 'User is already a participant in this event' });
    }

    const participant = new Participant({
      event: eventId,
      user: user._id,
      status: 'invited',
      invitedBy: req.userId,
      invitedAt: new Date(),
      response: 'pending'
    });

    await participant.save();
    await participant.populate('user', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Participant invited successfully',
      participant: participant.toParticipantJSON()
    });

  } catch (error) {
    console.error('Invite participant error:', error);
    res.status(500).json({ message: 'Error inviting participant', error: error.message });
  }
};

// ==================== HELPER FUNCTION: PROMOTE FROM WAITLIST ====================
const promoteFromWaitlist = async (eventId) => {
  try {
    const nextInLine = await Participant.findOne({ event: eventId, status: 'waitlisted' })
      .sort('waitlistPosition');

    if (nextInLine) {
      await nextInLine.promoteFromWaitlist();
    }
  } catch (error) {
    console.error('Promote from waitlist error:', error);
  }
};
// ==================== CHECK USER PARTICIPATION IN EVENT ====================
const checkUserParticipation = async (req, res) => {
  try {
    const { eventId } = req.params;


    // Make sure the user is authenticated
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Make sure the event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is already a participant
    const participation = await Participant.findOne({
      user: req.userId,
      event: eventId,
      status: { $in: ['active', 'waitlisted', 'invited'] } // exclude cancelled/removed
    });

    if (!participation) {
      return res.json({
        success: true,
        isParticipating: false
      });
    }

    return res.json({
      success: true,
      isParticipating: true,
      participation: participation.toParticipantJSON()
    });

  } catch (error) {
    console.error('Check participation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking user participation',
      error: error.message
    });
  }
};

module.exports = {
  joinEvent,
  leaveEvent,
  getEventParticipants,
  getUserParticipations,
  updateParticipantStatus,
  removeParticipant,
  getParticipantDetails,
  inviteParticipant,
  checkUserParticipation
};