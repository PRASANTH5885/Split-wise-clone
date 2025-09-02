// backend/routes/dashboard.js
const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement'); // ADD THIS
const User = require('../models/User');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const groups = await Group.find({ members: userId }).exec();
    const expenses = await Expense.find({ group: { $in: groups.map(g => g._id) } });

    const settlements = await Settlement.find({});

    let youOwe = 0;
    let youAreOwed = 0;

    expenses.forEach(expense => {
      expense.splits.forEach(split => {
        if (split.user.toString() === userId.toString()) {
          if (split.amount > 0) {
            youOwe += split.amount;
          } else if (split.amount < 0) {
            youAreOwed += Math.abs(split.amount);
          }
        }
      });
    });

    // Apply settlements
    settlements.forEach(settle => {
      if (settle.from.toString() === userId) {
        youOwe -= settle.amount;
      } else if (settle.to.toString() === userId) {
        youAreOwed -= settle.amount;
      }
    });

    if (youOwe < 0) youOwe = 0;
    if (youAreOwed < 0) youAreOwed = 0;

    res.json({ youOwe, youAreOwed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
