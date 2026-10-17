const express = require('express');
const router = express.Router();
const TeePeeBuilding = require('../models/TeePeeBuilding');
const { verifyToken, requireAdmin } = require('../middleware/auth-middleware');
const crypto = require('crypto');

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
// PATCH a single room: status, note, remark or sqft
router.patch('/:id/rooms/:roomId', verifyToken, async (req, res) => {
  try {
    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) {
      return res.status(403).send('Not assigned to this building');
    }

    const room = building.rooms.id(req.params.roomId);
    if (!room) return res.status(404).send('Room not found');

    const { status, note, remark, sqft } = req.body;        // <-- added sqft
    if (status !== undefined) room.status = status;
    if (note !== undefined) room.note = note;
    if (remark !== undefined) room.remark = remark;
    if (sqft !== undefined) room.sqft = sqft;
    if (rentPaidMonth !== undefined) {
      if (rentPaidMonth !== '' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(rentPaidMonth)))
        return res.status(400).send('Month must look like 2026-10');
      room.rentPaidMonth = rentPaidMonth;
    }
    await building.save();
    res.send(room);
  } catch (err) {
    res.status(400).send('Error updating room: ' + err.message);
  }
});
// POST merge several vacant rooms into one.
router.post('/:id/rooms/merge', verifyToken, async (req, res) => {
  try {
    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) return res.status(403).send('Not assigned to this building');

    const { roomIds } = req.body;
    if (!Array.isArray(roomIds) || roomIds.length < 2)
      return res.status(400).send('Select at least 2 rooms to merge');

    const picked = building.rooms.filter(r => roomIds.includes(String(r._id)));
    if (picked.length !== roomIds.length) return res.status(400).send('One or more rooms not found');
    if (picked.some(r => r.mergedFrom?.length)) return res.status(400).send('Separate merged rooms first');
    if (picked.some(r => r.partitionGroup)) return res.status(400).send('Rejoin partitions first');
    if (picked.some(r => r.status !== 'vacant')) return res.status(400).send('Only vacant rooms can be merged');

    const merged = {
      no: picked.map(r => r.no).join('+'),
      status: 'vacant', note: '', remark: '',
      sqft: picked.reduce((sum, r) => sum + (r.sqft || 0), 0),
      mergedFrom: picked.map(r => r.toObject()),
    };
    building.rooms = building.rooms.filter(r => !roomIds.includes(String(r._id)));
    building.rooms.push(merged);
    await building.save();
    res.send(building);
  } catch (err) {
    res.status(400).send('Error merging rooms: ' + err.message);
  }
});

// POST separate a merged room back into its originals.
router.post('/:id/rooms/:roomId/separate', verifyToken, async (req, res) => {
  try {
    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) return res.status(403).send('Not assigned to this building');

    const room = building.rooms.id(req.params.roomId);
    if (!room?.mergedFrom?.length) return res.status(400).send('This room is not a merged room');

    const originals = room.mergedFrom;
    building.rooms = building.rooms.filter(r => String(r._id) !== req.params.roomId);
    building.rooms.push(...originals);
    await building.save();
    res.send(building);
  } catch (err) {
    res.status(400).send('Error separating room: ' + err.message);
  }
});
// POST split one vacant room into 2+ partitions
router.post('/:id/rooms/:roomId/split', verifyToken, async (req, res) => {
  try {
    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) return res.status(403).send('Not assigned to this building');

    const room = building.rooms.id(req.params.roomId);
    if (!room) return res.status(404).send('Room not found');
    if (room.mergedFrom?.length) return res.status(400).send('Separate this merged room first');
    if (room.partitionGroup) return res.status(400).send('This room is already a partition. Rejoin first');
    if (room.status !== 'vacant') return res.status(400).send('Only a vacant room can be split');

    const { parts } = req.body;
    if (!Array.isArray(parts) || parts.length < 2) return res.status(400).send('Add at least 2 partitions');

    const nos = parts.map(p => String(p.no ?? '').trim());
    if (nos.some(n => !n)) return res.status(400).send('Every partition needs a room number');
    if (new Set(nos).size !== nos.length) return res.status(400).send('Partition numbers must be different');

    const others = building.rooms.filter(r => String(r._id) !== String(room._id)).map(r => String(r.no));
    if (nos.some(n => others.includes(n))) return res.status(400).send('A room with that number already exists');

    const sizes = parts.map(p => Number(p.sqft) || 0);
    if (sizes.some(s => s < 0)) return res.status(400).send('Sqft cannot be negative');
    const total = sizes.reduce((a, b) => a + b, 0);
    if ((room.sqft || 0) > 0 && Math.abs(total - room.sqft) > 0.01)
      return res.status(400).send(`Partition sqft must add up to ${room.sqft}`);

    const snapshot = room.toObject();
    const group = crypto.randomUUID();
    const newParts = nos.map((no, i) => ({
      no, status: 'vacant', note: '', remark: '', sqft: sizes[i],
      partitionGroup: group, partitionOf: snapshot,
    }));

    const idx = building.rooms.indexOf(room);
    building.rooms.splice(idx, 1, ...newParts);   // partitions take the original's position
    await building.save();
    res.send(building);
  } catch (err) {
    res.status(400).send('Error splitting room: ' + err.message);
  }
});

// POST rejoin all partitions of a room back into the original
router.post('/:id/rooms/:roomId/rejoin', verifyToken, async (req, res) => {
  try {
    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) return res.status(403).send('Not assigned to this building');

    const part = building.rooms.id(req.params.roomId);
    if (!part?.partitionGroup) return res.status(400).send('This room is not a partition');

    const group = building.rooms.filter(r => r.partitionGroup === part.partitionGroup);
    if (group.some(r => r.status !== 'vacant')) return res.status(400).send('All partitions must be vacant to rejoin');

    const original = part.partitionOf;
    const ids = group.map(r => String(r._id));
    building.rooms = building.rooms.filter(r => !ids.includes(String(r._id)));
    building.rooms.push(original);
    await building.save();
    res.send(building);
  } catch (err) {
    res.status(400).send('Error rejoining room: ' + err.message);
  }
});
// PATCH mark one month as paid / unpaid for a room
router.patch('/:id/rooms/:roomId/rent', verifyToken, async (req, res) => {
  try {
    const { month, paid } = req.body;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month)))
      return res.status(400).send('Month must look like 2026-10');
    if (typeof paid !== 'boolean') return res.status(400).send('paid must be true or false');

    const building = await TeePeeBuilding.findById(req.params.id);
    if (!building) return res.status(404).send('Building not found');
    if (!canAccessBuilding(req.user, building)) return res.status(403).send('Not assigned to this building');
    if (!building.rooms.id(req.params.roomId)) return res.status(404).send('Room not found');

    // Atomic update, so fast ticks on different rooms never overwrite each other.
    const op = paid
      ? { $addToSet: { 'rooms.$.rentPaidMonths': month } }
      : { $pull: { 'rooms.$.rentPaidMonths': month } };
    await TeePeeBuilding.updateOne({ _id: req.params.id, 'rooms._id': req.params.roomId }, op);

    res.send({ month, paid });
  } catch (err) {
    res.status(400).send('Error updating rent: ' + err.message);
  }
});
module.exports = router;
