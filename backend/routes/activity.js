// backend/routes/activity.js
const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ participants: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('paidBy', 'name');

    const activity = expenses.map(e => `${e.description} — ₹${e.amount} — Paid by ${e.paidBy.name}`);
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
