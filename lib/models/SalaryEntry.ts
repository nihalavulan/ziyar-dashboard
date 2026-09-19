import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * One salary record per staff member per day (and per part-time worker per day).
 * - present: whether they worked that day (earns `salary`)
 * - pending: salary is owed / deferred to be paid later
 * - isPartTime: an ad-hoc worker added just for that day (no permanent Staff)
 */
const SalaryEntrySchema = new Schema(
  {
    staff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    date: { type: String, required: true }, // YYYY-MM-DD
    // Denormalised so pending views + part-timers work without a join.
    name: { type: String, default: "" },
    section: { type: String, default: "" },
    salary: { type: Number, default: 0 },
    present: { type: Boolean, default: true },
    pending: { type: Boolean, default: false },
    isPartTime: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One permanent-staff entry per day. Part-timers (staff == null) are exempt.
SalaryEntrySchema.index(
  { staff: 1, date: 1 },
  { unique: true, partialFilterExpression: { staff: { $type: "objectId" } } }
);
SalaryEntrySchema.index({ date: 1 });
SalaryEntrySchema.index({ pending: 1 });

export type SalaryEntryDoc = InferSchemaType<typeof SalaryEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SalaryEntry =
  mongoose.models.SalaryEntry ||
  mongoose.model("SalaryEntry", SalaryEntrySchema);

export default SalaryEntry;
