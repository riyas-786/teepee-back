const mongoose = require('mongoose');

const teePeeroomSchema = new mongoose.Schema({
  no: Number,
  status: { type: String, default: 'vacant' },
  remark: String,
  note:String,
});

const teePeebuildingSchema = new mongoose.Schema({
  name: String,
  rooms: [teePeeroomSchema],
});

const teePeepropertySchema = new mongoose.Schema({
  name: [teePeebuildingSchema],
});

module.exports = mongoose.model('TeePeeBuilding', teePeepropertySchema);