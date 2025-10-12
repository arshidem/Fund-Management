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
  try {
    const { eventId } = req.params;
    const {
      amount,
      paymentMethod,
      transactionId,
      notes
    } = req.body;

    // Validate required fields
    if (!amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Amount and payment method are required'
      });
    }

    // Validate payment method
    const validOfflineMethods = ['cash', 'bank_transfer', 'upi'];
    if (!validOfflineMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method for offline contribution'
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

    // Create contribution
    const contribution = new Contribution({
      event: eventId,
      participant: participant._id,
      user: req.userId,
      amount: parseFloat(amount),
      paymentMethod,
      transactionId,
      notes,
      status: 'pending', // Admin needs to verify offline payments
      createdBy: req.userId
    });

    await contribution.save();

    await contribution.populate('user', 'name email');
    await contribution.populate('participant');

    res.status(201).json({
      success: true,
      message: 'Offline contribution recorded successfully. Waiting for admin verification.',
      contribution: contribution.toPaymentJSON()
    });

  } catch (error) {
    console.error('Create offline contribution error:', error);
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
const updateParticipantContribution = async (participantId) => {
  try {
    const participant = await Participant.findById(participantId);
    const totalContributions = await Contribution.aggregate([
      {
        $match: {
          participant: participant._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalRefunds: { $sum: '$refundAmount' }
        }
      }
    ]);

    if (totalContributions.length > 0) {
      participant.totalContributed = totalContributions[0].totalAmount - totalContributions[0].totalRefunds;
      participant.lastPaymentDate = new Date();
      await participant.updatePaymentStatus();
      await participant.save();
    }

    // Update event total collected
    const event = await Event.findById(participant.event);
    await event.updateFinancials();

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