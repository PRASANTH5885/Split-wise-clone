// backend/routes/groupTransactions.js
const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement'); // NEW!
const User = require('../models/User');
const router = express.Router();

router.get('/group/:groupId', auth, async (req, res) => {
  const userId = req.userId;
  const { groupId } = req.params;

  try {
    const expenses = await Expense.find({
      group: groupId,
      $or: [{ paidBy: userId }, { participants: userId }]
    });

    const settlements = await Settlement.find({ group: groupId });

    // Use maps to aggregate amounts per friend
    const youOweMap = new Map();
    const youAreOwedMap = new Map();

    expenses.forEach(expense => {
      const split = expense.amount / expense.participants.length;
      const paidById = expense.paidBy.toString();

      expense.participants.forEach(participantId => {
        const participantStr = participantId.toString();
        if (participantStr === paidById) return;

        if (userId.toString() === paidById && participantStr !== userId.toString()) {
          youAreOwedMap.set(
            participantStr,
            (youAreOwedMap.get(participantStr) || 0) + split
          );
        }
        else if (userId.toString() === participantStr && paidById !== userId.toString()) {
          youOweMap.set(
            paidById,
            (youOweMap.get(paidById) || 0) + split
          );
        }
      });
    });

    // Apply settlements
    settlements.forEach(settle => {
      if (settle.from.toString() === userId) {
        let current = youOweMap.get(settle.to.toString()) || 0;
        current -= settle.amount;
        if (current <= 0) youOweMap.delete(settle.to.toString());
        else youOweMap.set(settle.to.toString(), current);
      } else if (settle.to.toString() === userId) {
        let current = youAreOwedMap.get(settle.from.toString()) || 0;
        current -= settle.amount;
        if (current <= 0) youAreOwedMap.delete(settle.from.toString());
        else youAreOwedMap.set(settle.from.toString(), current);
      }
    });

    // Convert maps to arrays for response
    const youOwe = Array.from(youOweMap.entries()).map(([friendId, amount]) => ({
      friendId,
      amount
    }));

    const youAreOwed = Array.from(youAreOwedMap.entries()).map(([friendId, amount]) => ({
      friendId,
      amount
    }));

    const uniqueFriendIds = [
      ...new Set([...youOwe.map(t => t.friendId), ...youAreOwed.map(t => t.friendId)])
    ];

    const friends = await User.find({ _id: { $in: uniqueFriendIds } }).select('name');

    const addFriendNames = (arr) => arr.map(item => {
      const friend = friends.find(f => f._id.toString() === item.friendId);
      return { ...item, friendName: friend ? friend.name : 'Unknown' };
    });

    res.json({
      youOwe: addFriendNames(youOwe),
      youAreOwed: addFriendNames(youAreOwed)
    });
  } catch (error) {
    console.error('Error fetching group transactions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
