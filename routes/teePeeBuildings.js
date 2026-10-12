const express = require('express');
const router = express.Router();
const TeePeeBuilding = require('../models/TeePeeBuilding');
const { verifyToken, requireAdmin } = require('../middleware/auth-middleware');

router.get('/', verifyToken, async (req, res) => {
  try {
    const docs = await TeePeeBuilding.find();
    if (req.user.role === 'admin') {
      return res.send(docs);
    }

    // Filter each document's building list down to the ones this staff
    // member is assigned to.
    const filtered = docs.map(doc => ({
      ...doc.toObject(),
      name: (doc.name || []).filter(b => req.user.assignedBuildings.includes(b.name)),
    }));
    res.send(filtered);
  } catch (err) {
    res.status(500).send('Error fetching properties: ' + err.message);
  }
});
// GET one by id
router.get('/:id', async (req, res) => {
  try {
    const property = await TeePeeBuilding.findById(req.params.id);
    if (!property) return res.status(404).send('Property not found');
    res.send(property);
  } catch (err) {
    res.status(500).send('Error fetching property: ' + err.message);
  }
});


// POST new
// router.post('/', async (req, res) => {
//   try {
//     const property = new TeePeeBuilding(req.body);
//     const saved = await property.save();
//     res.send(saved);
//   } catch (err) {
//     res.status(400).send('Error saving property: ' + err.message);
//   }
// });
// POST — only admins can save/overwrite the building list.
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const property = new TeePeeBuilding(req.body);
    const saved = await property.save();
    res.send(saved);
  } catch (err) {
    res.status(400).send('Error saving property: ' + err.message);
  }
});

// PUT - update a whole property by id
router.put('/:id', async (req, res) => {
  try {
    const updated = await TeePeeBuilding.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return res.status(404).send('Property not found');
    res.send(updated);
  } catch (err) {
    res.status(400).send('Error updating property: ' + err.message);
  }
});

// DELETE by id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await TeePeeBuilding.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).send('Property not found');
    res.send(deleted);
  } catch (err) {
    res.status(500).send('Error deleting property: ' + err.message);
  }
});

module.exports = router;