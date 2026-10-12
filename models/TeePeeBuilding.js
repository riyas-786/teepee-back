// const mongoose = require('mongoose');

// const teePeeroomSchema = new mongoose.Schema({
//   no: Number,
//   status: { type: String, default: 'vacant' },
//   remark: String,
//   note:String,
// });

// const teePeebuildingSchema = new mongoose.Schema({
//   name: String,
//   rooms: [teePeeroomSchema],
// });

// const teePeepropertySchema = new mongoose.Schema({
//   name: [teePeebuildingSchema],
// });

// module.exports = mongoose.model('TeePeeBuilding', teePeepropertySchema);
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  no: { type: Number, required: true },
  status: {
    type: String,
    enum: ['vacant', 'occupied', 'reserved', 'maintenance'],
    default: 'vacant',
  },
  note: { type: String, default: '' },
  remark: { type: String, default: '' },
});

const buildingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rooms: [roomSchema],
});

// Each building is now its own document, instead of one giant document
// whose `name` field held an array of every building.
module.exports = mongoose.models.TeePeeBuilding || mongoose.model('TeePeeBuilding', buildingSchema);
