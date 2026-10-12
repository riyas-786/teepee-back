const express = require('express');
const router = express.Router();
const TeePeeBuilding = require('../models/TeePeeBuilding');
const { verifyToken, requireAdmin } = require('../middleware/auth-middleware');

function canAccessBuilding(user, building) {
  return user.role === 'admin' || (user.assignedBuildings || []).includes(building.name);
}

// GET all — admins get every building; staff only get their assigned ones.
router.get('/', verifyToken, async (req, res) => {
  try {
    const docs = await TeePeeBuilding.find();
    if (req.user.role === 'admin') return res.send(docs);
    const filtered = docs.filter(b => (req.user.assignedBuildings || []).includes(b.name));
    res.send(filtered);
  } catch (err) {
    res.status(500).send('Error fetching buildings: ' + err.message);
  }
});

// GET one building by id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) {
      return res.status(403).send('Not assigned to this building');
    }
    res.send(building);
  } catch (err) {
    res.status(500).send('Error fetching building: ' + err.message);
  }
});

// POST — create a new building. Admin only.
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const building = new TeePeeBuilding({
      name: req.body.name,
      rooms: req.body.rooms || [],
    });
    const saved = await building.save();
    res.send(saved);
  } catch (err) {
    res.status(400).send('Error creating building: ' + err.message);
  }
});

// PATCH — update a building's own fields (rename it, replace its room list
// wholesale when editing via the popup). Admin only.
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const updated = await TeePeeBuilding.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return res.status(404).send('Building not found');
    res.send(updated);
  } catch (err) {
    res.status(400).send('Error updating building: ' + err.message);
  }
});

// DELETE — admin only.
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await TeePeeBuilding.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).send('Building not found');
    res.send(deleted);
  } catch (err) {
    res.status(500).send('Error deleting building: ' + err.message);
  }
});

// PATCH a single room — the small endpoint for cycling status or saving a
// note, without resending the whole building. Staff can use this for any
// building they're assigned to; admins can use it for any building.
router.patch('/:id/rooms/:roomId', verifyToken, async (req, res) => {
  try {
    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) {
      return res.status(403).send('Not assigned to this building');
    }

    const room = building.rooms.id(req.params.roomId);
    if (!room) return res.status(404).send('Room not found');

    const { status, note, remark } = req.body;
    if (status !== undefined) room.status = status;
    if (note !== undefined) room.note = note;
    if (remark !== undefined) room.remark = remark;

    await building.save();
    res.send(room);
  } catch (err) {
    res.status(400).send('Error updating room: ' + err.message);
  }
});

module.exports = router;
