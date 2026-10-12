const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // 'admin' sees and manages everything.
  // 'staff' only sees/edits buildings listed in assignedBuildings.
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },

  // Building names this staff user is allowed to see and edit.
  // Ignored for admins (they always see everything).
  assignedBuildings: { type: [String], default: [] },
});

// Hash the password before saving (only run this once to create a user,
// e.g. in a one-off script, since there's no signup page here yet).
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

module.exports = mongoose.model('User', userSchema);