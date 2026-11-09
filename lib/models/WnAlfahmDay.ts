import mongoose, { Schema } from "mongoose";

/**
 * Hidden /wn dashboard: one alfahm daily entry (what sold that day).
 * `snapshot` holds the per-bird marinade rates used, so later recipe edits
 * don't change past days (see lib/alfahm.ts).
 */
const WnAlfahmDaySchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    chickenRatePerKg: { type: Number, default: 0 },
    sales: { type: Number, default: null },
    qty: { type: Schema.Types.Mixed, default: {} },
    snapshot: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

export const WnAlfahmDay =
  mongoose.models.WnAlfahmDay || mongoose.model("WnAlfahmDay", WnAlfahmDaySchema);

export default WnAlfahmDay;
