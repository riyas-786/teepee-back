const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRouter = require('./routes/auth');
// const teePeeBuildings = require('./routes/teePeeBuildings');
const blueBellsRouter = require('./routes/blueBells');


const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth',authRouter);
// app.use('/teePeeBuildings', teePeeBuildings);
app.use('/blueBells',blueBellsRouter);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB...'))
  .catch(err => console.error('Could not connect to MongoDB', err.message));

module.exports = app;

// Only listen locally — Vercel handles this itself
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Listening on port ${port}...`));
}