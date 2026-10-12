const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function makeToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      assignedBuildings: user.assignedBuildings,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function userPayload(user) {
  return {
    email: user.email,
    role: user.role,
    assignedBuildings: user.assignedBuildings,
  };
}

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('Email and password are required');
    if (password.length < 6) return res.status(400).send('Password must be at least 6 characters');

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).send('An account with this email already exists');

    // New signups are always 'staff' with no buildings yet — an admin
    // assigns their role and buildings afterward (see routes/users.js).
    const user = new User({ email, password });
    await user.save();

    res.send({ token: makeToken(user), user: userPayload(user) });
  } catch (err) {
    res.status(500).send('Signup failed: ' + err.message);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('Email and password are required');

    const user = await User.findOne({ email });
    if (!user) return res.status(400).send('Invalid email or password');

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).send('Invalid email or password');

    res.send({ token: makeToken(user), user: userPayload(user) });
  } catch (err) {
    res.status(500).send('Login failed: ' + err.message);
  }
});

module.exports = router;
