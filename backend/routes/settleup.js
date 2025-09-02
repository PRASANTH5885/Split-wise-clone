// backend/routes/settleup.js
const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Settlement = require('../models/Settlement');
const router = express.Router();

// GET balances for logged-in user, grouped by friend, considering all groups
router.get('/balances', auth, async (req, res) => {
  try {
    const userId = req.userId;

    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { participants: userId }
      ]
    });

    const settlements = await Settlement.find({});
    const balancesMap = {};

    expenses.forEach(expense => {
      const totalAmount = expense.amount;
      const participantsCount = expense.participants.length;
      const splitAmount = totalAmount / participantsCount;
      const paidById = expense.paidBy.toString();

      expense.participants.forEach(participantId => {
        const participantStr = participantId.toString();
        if (participantStr === paidById) return;
        if (!balancesMap[participantStr]) {
          balancesMap[participantStr] = { friendId: participantStr, amount: 0 };
        }
        if (!balancesMap[paidById]) {
          balancesMap[paidById] = { friendId: paidById, amount: 0 };
        }

        if (userId.toString() === paidById && participantStr !== userId.toString()) {
          balancesMap[participantStr].amount -= splitAmount;
          balancesMap[paidById].amount += splitAmount;
        }
        else if (userId.toString() === participantStr && paidById !== userId.toString()) {
          balancesMap[participantStr].amount += splitAmount;
          balancesMap[paidById].amount -= splitAmount;
        }
      });
    });

    // Apply settlements globally
    settlements.forEach(settle => {
      const fromId = settle.from.toString();
      const toId = settle.to.toString();
      const amt = settle.amount;

      // Only affect global balances for the logged-in user
      if (fromId === userId) {
        if (!balancesMap[toId]) balancesMap[toId] = { friendId: toId, amount: 0 };
        balancesMap[toId].amount -= amt;
      } else if (toId === userId) {
        if (!balancesMap[fromId]) balancesMap[fromId] = { friendId: fromId, amount: 0 };
        balancesMap[fromId].amount += amt;
      }
    });

    delete balancesMap[userId.toString()];

    const friendIds = Object.keys(balancesMap);
    const friends = await User.find({ _id: { $in: friendIds } }).select('name');
    const result = friends.map(friend => {
      const balEntry = balancesMap[friend._id.toString()];
      return {
        friendId: friend._id,
        friendName: friend.name,
        amount: balEntry ? balEntry.amount : 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching settleup balances:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST record a settlement
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { friendId, amount, groupId } = req.body;
    if (!friendId || !amount || amount <= 0 || !groupId) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    await Settlement.create({
      group: groupId,
      from: userId,
      to: friendId,
      amount,
    });
    res.json({ message: 'Settlement recorded successfully' });
  } catch (error) {
    console.error('Error recording settlement:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: GET settlement transactions for a group for the logged-in user
router.get('/group/:groupId/settlements', auth, async (req, res) => {
  const userId = req.userId;
  const { groupId } = req.params;

  try {
    const settlements = await Settlement.find({
      group: groupId,
      $or: [{ from: userId }, { to: userId }]
    }).populate('from', 'name').populate('to', 'name').sort({ date: -1 });

    const formatted = settlements.map(s => ({
      id: s._id,
      fromName: s.from.name,
      toName: s.to.name,
      amount: s.amount,
      date: s.date
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
