// One-time migration: converts the old single document
//   { name: [ { name, rooms }, { name, rooms }, ... ] }
// into separate documents, one per building:
//   { name, rooms }
//
// Run with:  node migrate-buildings.js
// Make sure your .env (MONGO_URI) is set up the same way your server uses it.
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const oldCollection = db.collection('teepeebuildings');
  const rawDocs = await oldCollection.find().toArray();

  if (rawDocs.length === 0) {
    console.log('No documents found in teepeebuildings — nothing to migrate.');
    process.exit(0);
  }

  // Only documents using the OLD shape have `name` as an array.
  const oldShapeDocs = rawDocs.filter(d => Array.isArray(d.name));
  if (oldShapeDocs.length === 0) {
    console.log('No documents in the old array shape — looks like this has already been migrated.');
    process.exit(0);
  }

  // Back up the old documents before touching anything.
  await db.collection('teepeebuildings_backup_before_migration').insertMany(
    oldShapeDocs.map(d => ({ ...d }))
  );
  console.log(`Backed up ${oldShapeDocs.length} old document(s) to teepeebuildings_backup_before_migration`);

  const newBuildingDocs = [];
  for (const doc of oldShapeDocs) {
    for (const b of doc.name || []) {
      newBuildingDocs.push({
        name: b.name,
        rooms: (b.rooms || []).map(r => ({
          no: r.no,
          status: r.status || 'vacant',
          note: r.note || '',
          remark: r.remark || '',
        })),
      });
    }
  }

  // Remove the old-shape documents, then insert the new one-per-building documents.
  const oldIds = oldShapeDocs.map(d => d._id);
  await oldCollection.deleteMany({ _id: { $in: oldIds } });

  if (newBuildingDocs.length > 0) {
    await oldCollection.insertMany(newBuildingDocs);
  }

  console.log(`Migrated ${newBuildingDocs.length} building(s) into separate documents.`);
  console.log('Done. Check your data in Atlas before deleting the backup collection.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
