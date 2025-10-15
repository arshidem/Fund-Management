// controllers/contributionController.js
const Contribution = require('../models/Contribution');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const User = require('../models/User');
const Razorpay = require('razorpay');

// Initialize Razorpay
let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('✅ Razorpay initialized successfully');
} else {
  console.warn('⚠️ Razorpay keys not found. Online payments will be disabled.');
}

// ==================== CREATE RAZORPAY ORDER ====================
const createRazorpayOrder = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Find event and participant
    const [event, participant] = await Promise.all([
      Event.findById(eventId),
      Participant.findOne({ event: eventId, user: req.userId })
    ]);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!participant) {
      return res.status(404).json({ message: 'You are not participating in this event' });
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        eventId: eventId,
        userId: req.userId,
        participantId: participant._id.toString()
      }
    };

    const order = await razorpay.orders.create(options);

    // Create pending contribution record
    const contribution = new Contribution({
      event: eventId,
      participant: participant._id,
      user: req.userId,
      amount: parseFloat(amount),
      paymentMethod: 'online',
      transactionId: order.id,
      status: 'pending',
      paymentGateway: 'razorpay',
      gatewayResponse: order,
      createdBy: req.userId
    });

    await contribution.save();

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      },
      contributionId: contribution._id
    });

  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment order',
      error: error.message
    });
  }
};

// ==================== VERIFY RAZORPAY PAYMENT ====================
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification data is required'
      });
    }

    const contribution = await Contribution.findById(contributionId)
      .populate('event')
      .populate('participant');

    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    // Verify payment signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Mark as failed
      contribution.status = 'failed';
      contribution.gatewayResponse = {
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        signature: razorpay_signature,
        verification: 'failed'
      };
      await contribution.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Payment verified successfully
    contribution.status = 'completed';
    contribution.transactionId = razorpay_payment_id;
    contribution.gatewayTransactionId = razorpay_payment_id;
    contribution.paymentDate = new Date();
    contribution.gatewayResponse = {
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      signature: razorpay_signature,
      verification: 'success'
    };

    await contribution.save();

    // Update participant totals
    await updateParticipantContribution(contribution.participant._id);

    await contribution.populate('user', 'name email');
    await contribution.populate('participant');

    res.json({
      success: true,
      message: 'Payment verified successfully',
      contribution: contribution.toPaymentJSON()
    });

  } catch (error) {
    console.error('Verify Razorpay payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

// ==================== CREATE OFFLINE CONTRIBUTION ====================
const createOfflineContribution = async (req, res) => {
  console.log('🎯 OFFLINE CONTRIBUTION ENDPOINT HIT!');
  console.log('📝 Method:', req.method);
  console.log('📝 URL:', req.originalUrl);
  console.log('📝 Event ID:', req.params.eventId);
  console.log('📝 Full Request Body:', JSON.stringify(req.body, null, 2));
  console.log('📝 Authenticated User ID:', req.userId);

  try {
    const { eventId } = req.params;
    const {
      amount,
      paymentMethod,
      transactionId,
      notes,
      userId,
      participantId,
      createdBy
    } = req.body;

    console.log('🔍 PARSED DATA:');
    console.log('  - eventId:', eventId);
    console.log('  - userId:', userId);
    console.log('  - participantId:', participantId);
    console.log('  - amount:', amount);
    console.log('  - paymentMethod:', paymentMethod);

    // Validate required fields
    if (!amount || !paymentMethod) {
      console.log('❌ Missing amount or paymentMethod');
      return res.status(400).json({
        success: false,
        message: 'Amount and payment method are required'
      });
    }

    if (!userId && !participantId) {
      console.log('❌ Missing both userId and participantId');
      return res.status(400).json({
        success: false,
        message: 'User ID or Participant ID is required'
      });
    }

    // Find event
    console.log('🔍 Looking for event:', eventId);
    const event = await Event.findById(eventId);
    if (!event) {
      console.log('❌ Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }
    console.log('✅ Event found:', event.title);

    // Find participant with detailed debugging
    console.log('🔍 STARTING PARTICIPANT SEARCH...');
    let participant = null;

    // Method 1: Find by participantId
    if (participantId) {
      console.log('🔍 METHOD 1: Searching by participantId:', participantId);
      participant = await Participant.findById(participantId);
      if (participant) {
        console.log('✅ FOUND by participantId:', {
          participantId: participant._id,
          participantUserId: participant.user,
          eventId: participant.event
        });
      } else {
        console.log('❌ NOT FOUND by participantId');
      }
    }

    // Method 2: Find by userId and eventId
    if (!participant && userId) {
      console.log('🔍 METHOD 2: Searching by userId:', userId, 'and eventId:', eventId);
      participant = await Participant.findOne({ 
        event: eventId, 
        user: userId 
      });
      if (participant) {
        console.log('✅ FOUND by userId:', {
          participantId: participant._id,
          participantUserId: participant.user,
          eventId: participant.event
        });
      } else {
        console.log('❌ NOT FOUND by userId');
      }
    }

    // Debug: Check all participants for this event
    if (!participant) {
      console.log('🔍 DEBUG: Checking ALL participants for event', eventId);
      const allParticipants = await Participant.find({ event: eventId });
      console.log('📊 ALL PARTICIPANTS FOR EVENT:', allParticipants.length);
      
      allParticipants.forEach((p, index) => {
        console.log(`  Participant ${index + 1}:`, {
          _id: p._id,
          user: p.user,
          userString: p.user?.toString(),
          event: p.event,
          status: p.status
        });
      });

      // Check if participant exists but with different user ID format
      const participantById = await Participant.findById(participantId);
      console.log('🔍 Direct find by participantId result:', participantById);

      return res.status(404).json({ 
        success: false,
        message: 'Participant not found for this event',
        debug: {
          received: {
            userId,
            participantId,
            eventId
          },
          availableParticipants: allParticipants.length,
          participantIds: allParticipants.map(p => p._id.toString()),
          userIds: allParticipants.map(p => p.user?.toString())
        }
      });
    }

    console.log('✅ PARTICIPANT FOUND SUCCESSFULLY:', {
      participantId: participant._id.toString(),
      userId: participant.user?.toString(),
      eventId: participant.event?.toString()
    });

    // Verify admin permissions
    console.log('🔍 Checking admin permissions...');


    // Create contribution
    console.log('🔍 Creating contribution...');
    const contribution = new Contribution({
      event: eventId,
      participant: participant._id,
      user: userId,
      amount: parseFloat(amount),
      paymentMethod,
      transactionId: transactionId || `OFFLINE_${Date.now()}_${userId}`,
      notes,
      status: 'completed',
      createdBy: req.userId,
      verifiedBy: req.userId,
      verifiedAt: new Date()
    });

    await contribution.save();
    await contribution.populate('user', 'name email');
    await contribution.populate('participant');

    console.log('✅ CONTRIBUTION CREATED SUCCESSFULLY:', contribution._id);

    res.status(201).json({
      success: true,
      message: 'Offline contribution added successfully',
      contribution: contribution.toPaymentJSON()
    });

  } catch (error) {
    console.error('❌ Create offline contribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating offline contribution',
      error: error.message
    });
  }
};
// ==================== GET EVENT CONTRIBUTIONS ====================
const getEventContributions = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      status,
      paymentMethod,
      page = 1,
      limit = 20
    } = req.query;

    // Find event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is event creator or admin
    if (event.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view contributions' });
    }

    // Build query
    let query = { event: eventId };
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const contributions = await Contribution.find(query)
      .populate('user', 'name email phone')
      .populate('participant')
      .sort({ paymentDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Contribution.countDocuments(query);

    const contributionsWithDetails = contributions.map(contribution => 
      contribution.toPaymentJSON()
    );

    res.json({
      success: true,
      contributions: contributionsWithDetails,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get event contributions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contributions',
      error: error.message
    });
  }
};

// ==================== GET USER CONTRIBUTIONS ====================
const getUserContributions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { eventId, page = 1, limit = 10 } = req.query;

    // Check authorization
    if (userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view these contributions' });
    }

    let query = { user: userId };
    if (eventId) query.event = eventId;

    const contributions = await Contribution.find(query)
      .populate('event', 'title date')
      .sort({ paymentDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Contribution.countDocuments(query);

    const contributionsWithDetails = contributions.map(contribution => {
      const contributionObj = contribution.toPaymentJSON();
      if (contribution.event) {
        contributionObj.eventDetails = {
          title: contribution.event.title,
          date: contribution.event.date
        };
      }
      return contributionObj;
    });

    res.json({
      success: true,
      contributions: contributionsWithDetails,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get user contributions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user contributions',
      error: error.message
    });
  }
};

// ==================== UPDATE CONTRIBUTION STATUS ====================
const updateContributionStatus = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { status, verifiedBy, notes } = req.body;

    const contribution = await Contribution.findById(contributionId)
      .populate('event')
      .populate('participant');

    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    // Only admin can update contribution status
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update contribution status' });
    }

    contribution.status = status;
    if (verifiedBy) contribution.verifiedBy = verifiedBy;
    if (notes) contribution.notes = notes;

    if (status === 'completed') {
      contribution.verifiedAt = new Date();
      // Update participant totals
      await updateParticipantContribution(contribution.participant._id);
    }

    await contribution.save();

    await contribution.populate('user', 'name email');
    await contribution.populate('verifiedBy', 'name email');

    res.json({
      success: true,
      message: 'Contribution status updated successfully',
      contribution: contribution.toPaymentJSON()
    });

  } catch (error) {
    console.error('Update contribution status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating contribution',
      error: error.message
    });
  }
};

// ==================== PROCESS REFUND ====================
const processRefund = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { refundAmount, refundReason } = req.body;

    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    // Only admin can process refunds
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Only admins can process refunds' });
    }

    if (refundAmount > contribution.amount) {
      return res.status(400).json({ message: 'Refund amount cannot exceed original amount' });
    }

    // Process Razorpay refund if it was an online payment
    if (contribution.paymentGateway === 'razorpay' && contribution.status === 'completed') {
      try {
        const refund = await razorpay.payments.refund(contribution.gatewayTransactionId, {
          amount: refundAmount * 100 // Convert to paise
        });
        contribution.gatewayResponse.refund = refund;
      } catch (razorpayError) {
        console.error('Razorpay refund error:', razorpayError);
        return res.status(400).json({
          success: false,
          message: 'Razorpay refund failed',
          error: razorpayError.error.description
        });
      }
    }

    await contribution.processRefund(refundAmount, refundReason, req.userId);

    // Update participant totals
    await updateParticipantContribution(contribution.participant);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      contribution: contribution.toPaymentJSON()
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
};

// ==================== GET CONTRIBUTION STATISTICS ====================
const getContributionStatistics = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is event creator or admin
    if (event.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view contribution statistics' });
    }

    const statistics = await Contribution.aggregate([
      {
        $match: { event: event._id }
      },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const paymentMethodStats = await Contribution.aggregate([
      {
        $match: { 
          event: event._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const dailyStats = await Contribution.aggregate([
      {
        $match: { 
          event: event._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
            day: { $dayOfMonth: '$paymentDate' }
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json({
      success: true,
      statistics: {
        byStatus: statistics.reduce((acc, stat) => {
          acc[stat._id] = { totalAmount: stat.totalAmount, count: stat.count };
          return acc;
        }, {}),
        byPaymentMethod: paymentMethodStats.reduce((acc, stat) => {
          acc[stat._id] = { totalAmount: stat.totalAmount, count: stat.count };
          return acc;
        }, {}),
        daily: dailyStats
      }
    });

  } catch (error) {
    console.error('Get contribution statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contribution statistics',
      error: error.message
    });
  }
};

// ==================== HELPER FUNCTION ====================
// ==================== HELPER FUNCTION ====================
const updateParticipantContribution = async (participantId) => {
  try {
    const participant = await Participant.findById(participantId).populate('event');
    
    if (!participant) {
      console.error('Participant not found:', participantId);
      return;
    }

    // Calculate total contributions using Mongoose (simpler approach)
    const contributions = await Contribution.find({
      participant: participantId,
      status: 'completed'
    });

    const totalAmount = contributions.reduce((sum, contrib) => sum + contrib.amount, 0);
    const totalRefunds = contributions.reduce((sum, contrib) => sum + (contrib.refundAmount || 0), 0);
    const netAmount = totalAmount - totalRefunds;

    // Update participant
    participant.totalContributed = netAmount;
    participant.lastPaymentDate = new Date();
    
    // Update payment status (with proper error handling)
    try {
      await participant.updatePaymentStatus();
    } catch (error) {
      console.error('Error updating payment status:', error);
      // Continue without throwing to prevent breaking the flow
    }
    
    await participant.save();

    // Update event total collected
    try {
      const event = await Event.findById(participant.event);
      if (event) {
        await event.updateFinancials();
      }
    } catch (error) {
      console.error('Error updating event financials:', error);
    }

  } catch (error) {
    console.error('Update participant contribution error:', error);
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createOfflineContribution,
  getEventContributions,
  getUserContributions,
  updateContributionStatus,
  processRefund,
  getContributionStatistics
};