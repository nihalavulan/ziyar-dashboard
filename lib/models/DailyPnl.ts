import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * Per-day P&L figures that are entered manually (everything else — food cost,
 * fixed expenses, salary — is derived from other sections).
 */
const DailyPnlSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    // Food cost is derived from the food table (prepared × rate). Sales come
    // from three sources; Swiggy/Zomato are reduced by commission to get net
    // revenue. Total sales (revenue) is derived from these three.
    directSales: { type: Number, default: 0 }, // counter / direct (manual)
    swiggySales: { type: Number, default: 0 }, // gross Swiggy (manual)
    zomatoSales: { type: Number, default: 0 }, // gross Zomato (manual)
    staffFood: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type DailyPnlDoc = InferSchemaType<typeof DailyPnlSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DailyPnl =
  mongoose.models.DailyPnl || mongoose.model("DailyPnl", DailyPnlSchema);

export default DailyPnl;
