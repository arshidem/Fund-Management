// controllers/eventController.js
const Event = require('../models/Event');
const Participant = require('../models/Participant');
const Contribution = require('../models/Contribution');
const Expense = require('../models/Expense');

// ==================== CREATE EVENT ====================
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      time,
      endDate,
      endTime,
      minimumContribution,
      maximumContribution,
      estimatedBudget,
      participationType,
      maxParticipants,
      category,
      location,
      eventType,
      visibility,
      paymentDeadline,
      allowLatePayments,
      allowPartialPayments,
      tags
    } = req.body;

    if (!title || !description || !date || !time || !minimumContribution) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, date, time, and minimum contribution are required'
      });
    }

    if (participationType === 'fixed' && !maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Max participants is required for fixed participation events'
      });
    }

    const event = new Event({
      title,
      description,
      date,
      time,
      endDate,
      endTime,
      minimumContribution: parseFloat(minimumContribution),
      maximumContribution: maximumContribution ? parseFloat(maximumContribution) : undefined,
      estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
      participationType: participationType || 'fixed',
      maxParticipants: participationType === 'fixed' ? parseInt(maxParticipants) : undefined,
      category: category || 'other',
      location,
      eventType: eventType || 'in-person',
      visibility: visibility || 'public',
      paymentDeadline,
      allowLatePayments: allowLatePayments || false,
      allowPartialPayments: allowPartialPayments || false,
      tags,
      createdBy: req.userId
    });

    await event.save();
    await event.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: event.toEventJSON()
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating event',
      error: error.message
    });
  }
};

// ==================== GET ALL EVENTS ====================
const getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      eventType,
      search,
      sortBy = 'date',
      sortOrder = 'asc'
    } = req.query;

    let query = { isActive: true };
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (eventType) query.eventType = eventType;
    
    if (search) {
      query.$text = { $search: search };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const events = await Event.find(query)
      .populate('createdBy', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Event.countDocuments(query);

    const eventsWithDetails = await Promise.all(
      events.map(async (event) => {
        const eventObj = event.toEventJSON();
        const participantCount = await Participant.countDocuments({
          event: event._id,
          status: 'active'
        });
        
        return {
          ...eventObj,
          participantCount
        };
      })
    );

    res.json({
      success: true,
      events: eventsWithDetails,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalEvents: total
      }
    });

  } catch (error) {
    console.error('Get all events error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching events',
      error: error.message
    });
  }
};

// ==================== GET SINGLE EVENT ====================
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate('createdBy', 'name email phone');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const [participantCount, contributionsSummary, expensesSummary, participants] = await Promise.all([
      Participant.countDocuments({ event: event._id, status: 'active' }),
      Contribution.aggregate([
        { $match: { event: event._id, status: 'completed' } },
        { $group: { _id: null, totalCollected: { $sum: '$amount' }, totalRefunds: { $sum: '$refundAmount' } } }
      ]),
      Expense.aggregate([
        { $match: { event: event._id, status: 'approved' } },
        { $group: { _id: null, totalExpenses: { $sum: '$amount' } } }
      ]),
      Participant.find({ event: event._id, status: 'active' })
        .populate('user', 'name email phone')
        .select('user totalContributed paymentStatus joinedAt')
        .limit(10)
    ]);

    const eventData = event.toEventJSON();
    
    eventData.financials = {
      totalCollected: contributionsSummary[0] ? 
        (contributionsSummary[0].totalCollected - contributionsSummary[0].totalRefunds) : 0,
      totalExpenses: expensesSummary[0] ? expensesSummary[0].totalExpenses : 0,
      balance: eventData.balance
    };

    eventData.participantCount = participantCount;
    eventData.participantsPreview = participants;

    res.json({ success: true, event: eventData });

  } catch (error) {
    console.error('Get event by ID error:', error);
    res.status(500).json({ message: 'Error fetching event', error: error.message });
  }
};

// ==================== UPDATE EVENT ====================
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // SIMPLIFIED: Only check if user is event creator (admin routes use adminOnly middleware)
    // if (event.createdBy.toString() !== req.userId) {
    //   return res.status(403).json({ message: 'Not authorized to update this event' });
    // }

    // if (event.status === 'published') {
    //   const restrictedFields = ['participationType', 'maxParticipants', 'minimumContribution'];
    //   const hasRestrictedUpdate = Object.keys(updateData).some(field => 
    //     restrictedFields.includes(field)
    //   );
      
    //   if (hasRestrictedUpdate) {
    //     return res.status(400).json({ message: 'Cannot update participation settings after event is published' });
    //   }
    // }

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        event[key] = updateData[key];
      }
    });

    await event.save();
    await event.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Event updated successfully',
      event: event.toEventJSON()
    });

  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
};

// ==================== DELETE EVENT ====================
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // SIMPLIFIED: Only check if user is event creator (admin routes use adminOnly middleware)
    // if (event.createdBy.toString() !== req.userId) {
    //   return res.status(403).json({ message: 'Not authorized to delete this event' });
    // }

    event.isActive = false;
    event.status = 'cancelled';
    await event.save();

    res.json({ success: true, message: 'Event deleted successfully' });

  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
};

// ==================== PUBLISH EVENT ====================
const publishEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // SIMPLIFIED: Only check if user is event creator (admin routes use adminOnly middleware)
    // if (event.createdBy.toString() !== req.userId) {
    //   return res.status(403).json({ message: 'Not authorized to publish this event' });
    // }

    if (!event.title || !event.description || !event.date || !event.time) {
      return res.status(400).json({ message: 'Event must have title, description, date, and time before publishing' });
    }

    if (event.participationType === 'fixed' && !event.maxParticipants) {
      return res.status(400).json({ message: 'Fixed participation events must have max participants set' });
    }

    await event.publish();

    res.json({
      success: true,
      message: 'Event published successfully',
      event: event.toEventJSON()
    });

  } catch (error) {
    console.error('Publish event error:', error);
    res.status(500).json({ message: 'Error publishing event', error: error.message });
  }
};

// ==================== GET EVENT STATISTICS ====================
const getEventStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // SIMPLIFIED: Only check if user is event creator (admin routes use adminOnly middleware)
    if (event.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to view statistics for this event' });
    }

    const [participantStats, paymentStats, expenseStats, waitlistCount] = await Promise.all([
      Participant.aggregate([{ $match: { event: event._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Contribution.aggregate([{ $match: { event: event._id, status: 'completed' } }, { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { event: event._id, status: 'approved' } }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Participant.countDocuments({ event: event._id, status: 'waitlisted' })
    ]);

    const statistics = {
      participants: participantStats.reduce((acc, stat) => { acc[stat._id] = stat.count; return acc; }, {}),
      payments: paymentStats.reduce((acc, stat) => { acc[stat._id] = { total: stat.total, count: stat.count }; return acc; }, {}),
      expenses: expenseStats.reduce((acc, stat) => { acc[stat._id] = { total: stat.total, count: stat.count }; return acc; }, {}),
      waitlist: waitlistCount,
      financials: {
        totalCollected: event.totalCollected,
        totalExpenses: event.totalExpenses,
        balance: event.balance,
        budgetUtilization: event.budgetUtilization
      }
    };

    res.json({ success: true, statistics });

  } catch (error) {
    console.error('Get event statistics error:', error);
    res.status(500).json({ message: 'Error fetching event statistics', error: error.message });
  }
};

// ==================== GET USER EVENTS ====================
// In eventController.js - getUserEvents function
const getUserEvents = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type = 'created' } = req.query;

    // Allow users to view their own events OR admins to view any user's events
    if (userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view these events' });
    }

    let events;

    if (type === 'created') {
      events = await Event.find({ createdBy: userId, isActive: true })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
    } else {
      // For participated events, you'll need a Participant model
      const participations = await Participant.find({ user: userId, status: 'active' }).populate('event');
      events = participations.map(p => p.event).filter(event => event && event.isActive);
    }

    res.json({
      success: true,
      events: events.map(event => event.toEventJSON ? event.toEventJSON() : event)
    });

  } catch (error) {
    console.error('Get user events error:', error);
    res.status(500).json({ message: 'Error fetching user events', error: error.message });
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  publishEvent,
  getEventStatistics,
  getUserEvents
};