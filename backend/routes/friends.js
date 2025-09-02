// backend/routes/friends.js
const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.userId;

    // 1. Get groups the user belongs to
    const groups = await Group.find({ members: userId });
    const groupIds = groups.map(g => g._id);

    // 2. Get unique user ids of all group members excluding self
    const memberIdsSet = new Set();
    groups.forEach(group => {
      group.members.forEach(m => {
        if (m.toString() !== userId.toString()) {
          memberIdsSet.add(m.toString());
        }
      });
    });
    const memberIds = Array.from(memberIdsSet);

    // 3. Find member user details
    const members = await User.find({ _id: { $in: memberIds } });

    // 4. Find all expenses involving user in those groups
    const expenses = await Expense.find({
      group: { $in: groupIds },
      $or: [{ paidBy: userId }, { participants: userId }]
    });

    // 5. Find all settlements involving user in those groups
    const settlements = await Settlement.find({
      group: { $in: groupIds },
      $or: [{ from: userId }, { to: userId }]
    });

    // 6. Prepare balances map by member id
    const balancesMap = new Map();
    members.forEach(m => {
      balancesMap.set(m._id.toString(), { youOwe: 0, youAreOwed: 0 });
    });

    // 7. Calculate balances from expenses (similar to your old logic)
    expenses.forEach(expense => {
      const payerId = expense.paidBy.toString();

      members.forEach(member => {
        const memberId = member._id.toString();
        if (memberId === userId.toString()) return;

        const userSplit = expense.splits.find(s => s.user.toString() === userId.toString());
        const memberSplit = expense.splits.find(s => s.user.toString() === memberId);

        if (!userSplit || !memberSplit) return;

        if (payerId === memberId && userId.toString() !== memberId && userSplit.amount > 0) {
          const current = balancesMap.get(memberId);
          current.youOwe += userSplit.amount;
          balancesMap.set(memberId, current);
        }

        if (payerId === userId.toString() && memberId !== userId.toString() && memberSplit.amount > 0) {
          const current = balancesMap.get(memberId);
          current.youAreOwed += memberSplit.amount;
          balancesMap.set(memberId, current);
        }
      });
    });

    // 8. Apply settlements
    settlements.forEach(settle => {
      const fromId = settle.from.toString();
      const toId = settle.to.toString();
      const amt = settle.amount;

      if (fromId === userId.toString()) {
        if (balancesMap.has(toId)) {
          balancesMap.get(toId).youOwe -= amt;
        }
      } else if (toId === userId.toString()) {
        if (balancesMap.has(fromId)) {
          balancesMap.get(fromId).youAreOwed -= amt;
        }
      }
    });

    // 9. Avoid negative balances
    members.forEach(member => {
      const bal = balancesMap.get(member._id.toString());
      if (bal.youOwe < 0) bal.youOwe = 0;
      if (bal.youAreOwed < 0) bal.youAreOwed = 0;
    });

    // 10. Format response
    const friendsWithBalances = members.map(m => ({
      id: m._id,
      name: m.name,
      email: m.email,
      youOwe: balancesMap.get(m._id.toString()).youOwe,
      youAreOwed: balancesMap.get(m._id.toString()).youAreOwed,
    }));

    res.json(friendsWithBalances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
