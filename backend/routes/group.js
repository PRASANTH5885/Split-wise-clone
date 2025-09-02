// backend/routes/group.js
const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// GET all groups for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId })
      .populate('members', 'name email')
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET group by ID (only if user is member)
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, members: req.userId })
      .populate('members', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found or access denied' });
    res.json(group);
  } catch (err) {
    console.error('Error fetching group by ID:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create a new group with improved validation and debug logging
router.post('/', auth, async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name required' });

    let memberEmailsOrIds = members || [];
    if (!memberEmailsOrIds.includes(req.userId.toString())) {
      memberEmailsOrIds.push(req.userId.toString());
    }

    const memberIds = memberEmailsOrIds.filter(m => mongoose.isValidObjectId(m));
    const memberEmails = memberEmailsOrIds.filter(m => !mongoose.isValidObjectId(m));

    const users = await User.find({
      $or: [
        { _id: { $in: memberIds } },
        { email: { $in: memberEmails } }
      ]
    });

    console.log('Requested members:', memberEmailsOrIds);
    console.log('Found users:', users.map(u => u.email));

    const foundEmails = users.map(u => u.email);
    const missingEmails = memberEmails.filter(email => !foundEmails.includes(email));
    if (missingEmails.length > 0) {
      return res.status(400).json({
        error: 'These emails are not registered users: ' + missingEmails.join(', ')
      });
    }

    const userIds = users.map(u => u._id);
    const newGroup = new Group({
      name,
      members: userIds,
      createdBy: req.userId,
    });

    const savedGroup = await newGroup.save();
    res.json(savedGroup);
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT update group (add/remove members, rename) with improved validation
router.put('/:id', auth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { name, members } = req.body;

    const group = await Group.findOne({ _id: groupId, members: req.userId });
    if (!group) return res.status(404).json({ error: 'Group not found or access denied' });

    if (name) group.name = name;
    if (members) {
      const memberIds = members.filter(m => mongoose.isValidObjectId(m));
      const memberEmails = members.filter(m => !mongoose.isValidObjectId(m));

      const users = await User.find({
        $or: [
          { _id: { $in: memberIds } },
          { email: { $in: memberEmails } }
        ]
      });

      group.members = users.map(u => u._id);
    }

    const updatedGroup = await group.save();
    res.json(updatedGroup);
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE remove group (only creator can delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findOne({ _id: groupId, createdBy: req.userId });
    if (!group) return res.status(404).json({ error: 'Group not found or you are not authorized' });

    await group.remove();
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
