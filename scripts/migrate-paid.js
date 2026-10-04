/**
 * One-time migration: backfill the `paid` field on salary entries created
 * before the primary/today-paid split.
 *
 *   present & not pending  -> was paid in full   -> paid = salary
 *   present & pending(old) -> was deferred/owed   -> paid = 0
 *   absent                 -> not owed            -> paid = 0
 *
 * Run with DRY=1 to only report. MONGODB_URI must point at the target DB.
 *   node scripts/migrate-paid.js            # applies
 *   DRY=1 node scripts/migrate-paid.js      # dry run
 */
const { MongoClient } = require("mongodb");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  const dry = process.env.DRY === "1";
  const c = new MongoClient(uri);
  await c.connect();
  const col = c.db().collection("salaryentries");

  // Entries missing a real paid value (field absent).
  const toFix = await col.find({ paid: { $exists: false } }).toArray();
  let paidFull = 0, zero = 0;
  const ops = [];
  for (const e of toFix) {
    const paid = e.present === true && e.pending !== true ? e.salary ?? 0 : 0;
    if (paid > 0) paidFull++; else zero++;
    ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { paid } } } });
  }

  console.log(`DB: ${c.db().databaseName}`);
  console.log(`Entries needing backfill: ${toFix.length}`);
  console.log(`  -> paid = salary (were paid): ${paidFull}`);
  console.log(`  -> paid = 0 (were pending/absent): ${zero}`);

  if (dry) {
    console.log("DRY RUN — no changes written.");
  } else if (ops.length > 0) {
    const res = await col.bulkWrite(ops);
    console.log(`Applied. Modified: ${res.modifiedCount}`);
  } else {
    console.log("Nothing to migrate.");
  }
  await c.close();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
