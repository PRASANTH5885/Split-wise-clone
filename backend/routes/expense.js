// backend/routes/expense.js
const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const router = express.Router();

// POST /api/expenses - Create a new expense
router.post('/', auth, async (req, res) => {
  try {
    const { amount, description, groupId, participants } = req.body; // removed date from destructuring
    if (!amount || !description)
      return res.status(400).json({ error: 'Amount and description are required' });

    const participantList = participants && participants.length > 0 ? participants : [req.userId];
    const share = amount / participantList.length;

    // Create splits: payer has negative total amount, others positive shares
    const splitsData = participantList.map(user => ({
      user,
      amount: user === req.userId ? -share * (participantList.length - 1) : share
    }));

    // Save expense without date field from frontend; backend assigns current datetime
    const newExpense = new Expense({
      paidBy: req.userId,
      amount,
      description,
      date: new Date(), // always current date and time
      group: groupId || null,
      participants: participantList,
      splits: splitsData,
    });

    const expense = await newExpense.save();
    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/expenses - Get expenses for logged in user, optionally filtered by group
router.get('/', auth, async (req, res) => {
  try {
    const { groupId } = req.query;
    let query = { participants: req.userId };
    if (groupId) {
      query.group = groupId;
    }
    // Populate who paid the expense
    const expenses = await Expense.find(query)
      .sort({ createdAt: -1 })
      .populate('paidBy', 'name');
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
