// routes/users.js — admin-only management of staff accounts.
// Register in index.js as: app.use('/api/users', usersRouter);
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken, requireAdmin } = require('../middleware/auth-middleware');

// List all users (password excluded).
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.send(users);
  } catch (err) {
    res.status(500).send('Error fetching users: ' + err.message);
  }
});

// Update a user's role and/or assigned buildings.
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role, assignedBuildings } = req.body;
    const update = {};
    if (role) update.role = role;
    if (assignedBuildings) update.assignedBuildings = assignedBuildings;

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      returnDocument: 'after',
    }).select('-password');

    if (!user) return res.status(404).send('User not found');
    res.send(user);
  } catch (err) {
    res.status(400).send('Error updating user: ' + err.message);
  }
});

module.exports = router;

/* index.js — register this route and protect your existing /api/teepee routes:

const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);

Also add verifyToken to your existing teePee router so every request must be logged in:

const { verifyToken } = require('./middleware/auth');
app.use('/api/teepee', verifyToken, teePeeRouter);
*/
