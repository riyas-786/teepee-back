const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  no: Number,
  status: { type: String, default: 'vacant' },
  remark: String,
});

const buildingSchema = new mongoose.Schema({
  name: String,
  rooms: [roomSchema],
});

const propertySchema = new mongoose.Schema({
  name: [buildingSchema],
});

module.exports = mongoose.model('Property', propertySchema);